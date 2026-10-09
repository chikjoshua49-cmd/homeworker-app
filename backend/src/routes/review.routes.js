const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const Joi = require('joi');

const createReviewSchema = Joi.object({
  booking_id: Joi.number().required(),
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().optional(),
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

// Create review
router.post('/', auth(), validate(createReviewSchema), async (req, res) => {
  const { booking_id, rating, comment } = req.validatedData;

  // Get booking
  const bookingResult = await pool.query(
    'SELECT * FROM bookings WHERE id = $1',
    [booking_id]
  );

  if (bookingResult.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = bookingResult.rows[0];

  // Check if user is part of booking
  if (booking.customer_id !== req.user.id && booking.worker_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Determine reviewer and reviewee
  const reviewerId = req.user.id;
  const revieweeId = booking.customer_id === req.user.id ? booking.worker_id : booking.customer_id;

  // Create review
  const result = await pool.query(
    `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [booking_id, reviewerId, revieweeId, rating, comment || null]
  );

  // Update reviewee's rating
  const ratingsResult = await pool.query(
    'SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM reviews WHERE reviewee_id = $1',
    [revieweeId]
  );

  const avgRating = parseFloat(ratingsResult.rows[0].avg_rating) || 0;
  const totalReviews = parseInt(ratingsResult.rows[0].total, 10);

  // Update worker or customer profile
  const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [revieweeId]);

  if (userResult.rows.length > 0) {
    if (userResult.rows[0].role === 'worker') {
      await pool.query(
        'UPDATE worker_profiles SET rating = $1, total_reviews = $2 WHERE user_id = $3',
        [avgRating, totalReviews, revieweeId]
      );
    } else if (userResult.rows[0].role === 'customer') {
      await pool.query(
        'UPDATE customer_profiles SET rating = $1, total_reviews = $2 WHERE user_id = $3',
        [avgRating, totalReviews, revieweeId]
      );
    }
  }

  res.status(201).json({ message: 'Review created', review: result.rows[0] });
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  const result = await pool.query(
    `SELECT r.*, u.first_name, u.last_name
     FROM reviews r
     JOIN users u ON r.reviewer_id = u.id
     WHERE r.reviewee_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.userId, limit, offset]
  );

  res.json(result.rows);
});

module.exports = router;
