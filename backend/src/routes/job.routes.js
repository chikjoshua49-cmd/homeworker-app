const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const Joi = require('joi');

const createJobSchema = Joi.object({
  service_category_id: Joi.number().required(),
  title: Joi.string().max(255).required(),
  description: Joi.string().required(),
  budget: Joi.number().positive().required(),
  scheduled_date: Joi.date().iso().required(),
  scheduled_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  duration_hours: Joi.number().positive().required(),
  location: Joi.string().required(),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      error.isJoi = true;
      return next(error);
    }

    req.validatedData = value;
    next();
  };
};

// Create job (customer only)
router.post('/', auth(['customer']), validate(createJobSchema), async (req, res) => {
  const { service_category_id, title, description, budget, scheduled_date, scheduled_time, duration_hours, location } = req.validatedData;

  const result = await pool.query(
    `INSERT INTO jobs (customer_id, service_category_id, title, description, budget, scheduled_date, scheduled_time, duration_hours, location, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
     RETURNING *`,
    [req.user.id, service_category_id, title, description, budget, scheduled_date, scheduled_time, duration_hours, location]
  );

  res.status(201).json(result.rows[0]);
});

// Get all jobs with filtering
router.get('/', async (req, res) => {
  const { service_category_id, status = 'open', limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM jobs WHERE status = $1';
  const params = [status];

  if (service_category_id) {
    query += ` AND service_category_id = $${params.length + 1}`;
    params.push(service_category_id);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Get job by ID
router.get('/:id', async (req, res) => {
  const result = await pool.query(
    `SELECT j.*, sc.name as service_name, u.first_name, u.last_name
     FROM jobs j
     JOIN service_categories sc ON j.service_category_id = sc.id
     JOIN users u ON j.customer_id = u.id
     WHERE j.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(result.rows[0]);
});

// Get applications for a job
router.get('/:id/applications', auth(['customer']), async (req, res) => {
  const jobResult = await pool.query('SELECT customer_id FROM jobs WHERE id = $1', [req.params.id]);

  if (jobResult.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (jobResult.rows[0].customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const result = await pool.query(
    `SELECT 
      ja.id, ja.status, ja.applied_at,
      u.id as worker_id, u.first_name, u.last_name, u.profile_picture_url,
      wp.hourly_rate, wp.rating, wp.total_reviews
     FROM job_applications ja
     JOIN worker_profiles wp ON ja.worker_id = wp.id
     JOIN users u ON wp.user_id = u.id
     WHERE ja.job_id = $1
     ORDER BY ja.applied_at DESC`,
    [req.params.id]
  );

  res.json(result.rows);
});

// Worker applies to job
router.post('/:id/apply', auth(['worker']), async (req, res) => {
  const workerResult = await pool.query(
    'SELECT id FROM worker_profiles WHERE user_id = $1',
    [req.user.id]
  );

  if (workerResult.rows.length === 0) {
    return res.status(404).json({ error: 'Worker profile not found' });
  }

  const workerId = workerResult.rows[0].id;

  try {
    const result = await pool.query(
      `INSERT INTO job_applications (job_id, worker_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.params.id, workerId]
    );

    res.status(201).json({ message: 'Application submitted', application: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already applied to this job' });
    }
    throw err;
  }
});

// Customer accepts a worker (creates booking)
router.post('/:id/accept-worker', auth(['customer']), async (req, res) => {
  const { application_id } = req.body;

  if (!application_id) {
    return res.status(400).json({ error: 'application_id is required' });
  }

  // Get job and verify customer
  const jobResult = await pool.query(
    'SELECT * FROM jobs WHERE id = $1',
    [req.params.id]
  );

  if (jobResult.rows.length === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = jobResult.rows[0];

  if (job.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Get application
  const appResult = await pool.query(
    `SELECT ja.*, wp.user_id as worker_user_id
     FROM job_applications ja
     JOIN worker_profiles wp ON ja.worker_id = wp.id
     WHERE ja.id = $1 AND ja.job_id = $2`,
    [application_id, req.params.id]
  );

  if (appResult.rows.length === 0) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const application = appResult.rows[0];

  // Create booking
  const bookingResult = await pool.query(
    `INSERT INTO bookings (job_id, customer_id, worker_id, service_category_id, status, total_amount)
     VALUES ($1, $2, $3, $4, 'requested', $5)
     RETURNING *`,
    [req.params.id, job.customer_id, application.worker_user_id, job.service_category_id, job.budget]
  );

  // Update application status
  await pool.query(
    'UPDATE job_applications SET status = $1 WHERE id = $2',
    ['accepted', application_id]
  );

  // Update job status
  await pool.query(
    'UPDATE jobs SET status = $1 WHERE id = $2',
    ['assigned', req.params.id]
  );

  res.status(201).json({ message: 'Worker accepted, booking created', booking: bookingResult.rows[0] });
});

module.exports = router;
