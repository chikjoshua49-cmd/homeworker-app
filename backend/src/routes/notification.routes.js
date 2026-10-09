const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Get notifications
router.get('/', auth(), async (req, res) => {
  const { is_read, limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM notifications WHERE user_id = $1';
  const params = [req.user.id];

  if (is_read !== undefined) {
    query += ` AND is_read = $${params.length + 1}`;
    params.push(is_read === 'true');
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Mark notification as read
router.patch('/:id/read', auth(), async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json(result.rows[0]);
});

// Mark all as read
router.patch('/read-all', auth(), async (req, res) => {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [req.user.id]
  );

  res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
