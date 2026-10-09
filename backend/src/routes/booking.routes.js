const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const { COMMISSION_RATE, AUTO_RELEASE_HOURS } = require('../config/constants');

// Get all bookings for current user
router.get('/', auth(), async (req, res) => {
  const result = await pool.query(
    `SELECT b.*, sc.name as service_name,
            c.first_name as customer_first_name, c.last_name as customer_last_name,
            w.first_name as worker_first_name, w.last_name as worker_last_name
     FROM bookings b
     JOIN service_categories sc ON b.service_category_id = sc.id
     JOIN users c ON b.customer_id = c.id
     JOIN users w ON b.worker_id = w.id
     WHERE b.customer_id = $1 OR b.worker_id = $1
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );

  res.json(result.rows);
});

// Get booking by ID
router.get('/:id', auth(), async (req, res) => {
  const result = await pool.query(
    `SELECT b.*, sc.name as service_name,
            c.first_name as customer_first_name, c.last_name as customer_last_name,
            w.first_name as worker_first_name, w.last_name as worker_last_name
     FROM bookings b
     JOIN service_categories sc ON b.service_category_id = sc.id
     JOIN users c ON b.customer_id = c.id
     JOIN users w ON b.worker_id = w.id
     WHERE b.id = $1`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = result.rows[0];

  // Check if user is part of booking
  if (booking.customer_id !== req.user.id && booking.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  res.json(booking);
});

// Worker checks in
router.post('/:id/check-in', auth(['worker']), async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  const result = await pool.query(
    `UPDATE bookings
     SET status = 'in_progress', checked_in_at = now(), updated_at = now()
     WHERE id = $1 AND worker_id = $2 AND status = 'accepted'
     RETURNING *`,
    [bookingId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Cannot check in to this booking' });
  }

  res.json({ status: 'in_progress', booking: result.rows[0] });
});

// Worker checks out
router.post('/:id/check-out', auth(['worker']), async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  const result = await pool.query(
    `UPDATE bookings
     SET status = 'awaiting_customer_confirmation', checked_out_at = now(), updated_at = now()
     WHERE id = $1 AND worker_id = $2 AND status = 'in_progress' AND checked_out_at IS NULL
     RETURNING *`,
    [bookingId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Cannot finish this booking' });
  }

  res.json({
    status: 'awaiting_customer_confirmation',
    autoReleaseInHours: AUTO_RELEASE_HOURS,
    booking: result.rows[0],
  });
});

// Customer confirms and releases payment
router.post('/:id/confirm', auth(['customer']), async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  const bookingResult = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [bookingId]
  );

  if (bookingResult.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = bookingResult.rows[0];

  if (booking.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (booking.status !== 'awaiting_customer_confirmation' || !booking.checked_out_at) {
    return res.status(409).json({ error: 'Booking is not ready for confirmation' });
  }

  // Calculate commission
  const commissionAmount = booking.total_amount * COMMISSION_RATE;
  const workerAmount = booking.total_amount - commissionAmount;

  // Update booking
  const updateResult = await pool.query(
    `UPDATE bookings
     SET status = 'completed', confirmed_at = now(), commission_amount = $1, worker_amount = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [commissionAmount, workerAmount, bookingId]
  );

  // Add transaction record for payment release
  await pool.query(
    `INSERT INTO transactions (wallet_id, booking_id, type, amount, description, status)
     SELECT w.id, $2, 'release_to_worker', $3, 'Payment released for completed booking', 'completed'
     FROM wallets w WHERE w.user_id = $4`,
    [bookingId, bookingId, workerAmount, booking.worker_id]
  );

  // Update worker wallet
  await pool.query(
    `UPDATE wallets SET balance = balance + $1, available_balance = available_balance + $1, updated_at = now()
     WHERE user_id = $2`,
    [workerAmount, booking.worker_id]
  );

  res.json({ status: 'completed', booking: updateResult.rows[0] });
});

// Cancel booking
router.post('/:id/cancel', auth(['customer', 'worker']), async (req, res) => {
  const bookingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }

  const bookingResult = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [bookingId]
  );

  if (bookingResult.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = bookingResult.rows[0];

  const isParty = booking.customer_id === req.user.id || booking.worker_id === req.user.id;
  if (!isParty) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!['requested', 'accepted'].includes(booking.status)) {
    return res.status(409).json({ error: 'Too late to cancel; open a dispute instead' });
  }

  const result = await pool.query(
    'UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    ['cancelled', bookingId]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'Too late to cancel; open a dispute instead' });
  }

  res.json({ status: 'cancelled', booking: result.rows[0] });
});

module.exports = router;
