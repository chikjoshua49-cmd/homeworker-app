const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Get user profile by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT id, email, first_name, last_name, phone, profile_picture_url, bio, role, created_at
     FROM users WHERE id = $1 AND is_active = true`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  // If it's a worker, include profile data
  if (user.role === 'worker') {
    const workerResult = await pool.query(
      `SELECT hourly_rate, bio, years_of_experience, is_verified, rating, total_reviews, total_completed_jobs
       FROM worker_profiles WHERE user_id = $1`,
      [id]
    );

    if (workerResult.rows.length > 0) {
      user.worker_profile = workerResult.rows[0];

      // Get services
      const servicesResult = await pool.query(
        `SELECT sc.id, sc.name, sc.description, sc.icon_url
         FROM service_categories sc
         JOIN worker_services ws ON ws.service_category_id = sc.id
         JOIN worker_profiles wp ON wp.id = ws.worker_id
         WHERE wp.user_id = $1`,
        [id]
      );

      user.worker_profile.services = servicesResult.rows;
    }
  } else if (user.role === 'customer') {
    const customerResult = await pool.query(
      `SELECT address, city, state, postal_code, country, rating, total_reviews
       FROM customer_profiles WHERE user_id = $1`,
      [id]
    );

    if (customerResult.rows.length > 0) {
      user.customer_profile = customerResult.rows[0];
    }
  }

  res.json(user);
});

// List workers with filtering
router.get('/', async (req, res) => {
  const { service_id, min_rating, limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT 
      u.id, u.email, u.first_name, u.last_name, u.phone, u.profile_picture_url, u.bio,
      wp.hourly_rate, wp.rating, wp.total_reviews, wp.total_completed_jobs, wp.is_verified
    FROM users u
    JOIN worker_profiles wp ON u.id = wp.user_id
    WHERE u.is_active = true
  `;

  const params = [];

  if (service_id) {
    query += ` AND wp.id IN (
      SELECT worker_id FROM worker_services WHERE service_category_id = $${params.length + 1}
    )`;
    params.push(service_id);
  }

  if (min_rating) {
    query += ` AND wp.rating >= $${params.length + 1}`;
    params.push(min_rating);
  }

  query += ` ORDER BY wp.rating DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Get customer profile
router.get('/:id/customer-profile', async (req, res) => {
  const result = await pool.query(
    `SELECT cp.* FROM customer_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.user_id = $1 AND u.is_active = true`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Customer profile not found' });
  }

  res.json(result.rows[0]);
});

// Get worker profile
router.get('/:id/worker-profile', async (req, res) => {
  const result = await pool.query(
    `SELECT wp.* FROM worker_profiles wp
     JOIN users u ON u.id = wp.user_id
     WHERE wp.user_id = $1 AND u.is_active = true`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Worker profile not found' });
  }

  const workerProfile = result.rows[0];

  // Get services
  const servicesResult = await pool.query(
    `SELECT sc.id, sc.name, sc.description, sc.icon_url
     FROM service_categories sc
     JOIN worker_services ws ON ws.service_category_id = sc.id
     WHERE ws.worker_id = $1`,
    [workerProfile.id]
  );

  workerProfile.services = servicesResult.rows;
  res.json(workerProfile);
});

module.exports = router;
