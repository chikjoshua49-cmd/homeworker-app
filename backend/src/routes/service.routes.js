const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Get all service categories
router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, description, icon_url FROM service_categories ORDER BY name'
  );
  res.json(result.rows);
});

// Get service by ID
router.get('/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, description, icon_url FROM service_categories WHERE id = $1',
    [req.params.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Service not found' });
  }

  res.json(result.rows[0]);
});

// Create service category (admin only)
router.post('/', auth(['admin']), async (req, res) => {
  const { name, description, icon_url } = req.body;

  const result = await pool.query(
    `INSERT INTO service_categories (name, description, icon_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description || null, icon_url || null]
  );

  res.status(201).json(result.rows[0]);
});

// Get workers by service
router.get('/:id/workers', async (req, res) => {
  const { min_rating = 0, limit = 20, offset = 0 } = req.query;

  const result = await pool.query(
    `SELECT 
      u.id, u.first_name, u.last_name, u.profile_picture_url,
      wp.hourly_rate, wp.rating, wp.total_reviews, wp.is_verified
     FROM users u
     JOIN worker_profiles wp ON u.id = wp.user_id
     JOIN worker_services ws ON wp.id = ws.worker_id
     WHERE ws.service_category_id = $1 AND u.is_active = true AND wp.rating >= $2
     ORDER BY wp.rating DESC
     LIMIT $3 OFFSET $4`,
    [req.params.id, min_rating, limit, offset]
  );

  res.json(result.rows);
});

module.exports = router;
