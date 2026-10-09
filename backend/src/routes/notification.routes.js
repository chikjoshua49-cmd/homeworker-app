const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const Joi = require('joi');

const createDisputeSchema = Joi.object({
  booking_id: Joi.number().required(),
  reason: Joi.string().required(),
});

const resolveDisputeSchema = Joi.object({
  resolution: Joi.string().required(),
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

// Create dispute
router.post('/', auth(), validate(createDisputeSchema), async (req, res) => {
  const { booking_id, reason } = req.validatedData;

  const bookingResult = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [booking_id]
  );

  if (bookingResult.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = bookingResult.rows[0];

  if (booking.customer_id !== req.user.id && booking.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const result = await pool.query(
    `INSERT INTO disputes (booking_id, opened_by_id, reason, status)
     VALUES ($1, $2, $3, 'open')
     RETURNING *`,
    [booking_id, req.user.id, reason]
  );

  await pool.query(
    'UPDATE bookings SET status = $1 WHERE id = $2',
    ['disputed', booking_id]
  );

  res.status(201).json({ message: 'Dispute created', dispute: result.rows[0] });
});

// Get all disputes (admin only)
router.get('/', auth(['admin']), async (req, res) => {
  const { status = 'open', limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM disputes WHERE status = $1';
  const params = [status];

  if (status !== 'all') {
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Get dispute by ID
router.get('/:id', auth(), async (req, res) => {
  const result = await pool.query(
    `SELECT d.*, b.customer_id, b.worker_id
     FROM disputes d
     JOIN bookings b ON d.booking_id = b.id
     WHERE d.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Dispute not found' });
  }

  const dispute = result.rows[0];

  if (req.user.role !== 'admin' && dispute.customer_id !== req.user.id && dispute.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  res.json(dispute);
});

// Resolve dispute (admin only)
router.patch('/:id/resolve', auth(['admin']), validate(resolveDisputeSchema), async (req, res) => {
  const { resolution } = req.validatedData;

  const result = await pool.query(
    `UPDATE disputes
     SET status = 'resolved', resolution = $1, resolved_at = now()
     WHERE id = $2
     RETURNING *`,
    [resolution, req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Dispute not found' });
  }

  res.json({ message: 'Dispute resolved', dispute: result.rows[0] });
});

module.exports = router;
