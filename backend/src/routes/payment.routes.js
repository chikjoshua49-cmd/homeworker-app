const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Get wallet balance
router.get('/wallet', auth(), async (req, res) => {
  const result = await pool.query(
    'SELECT id, user_id, balance, hold_amount, available_balance FROM wallets WHERE user_id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  res.json(result.rows[0]);
});

// Get payment history
router.get('/history', auth(), async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  const result = await pool.query(
    `SELECT t.id, t.type, t.amount, t.description, t.status, t.created_at
     FROM transactions t
     JOIN wallets w ON t.wallet_id = w.id
     WHERE w.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );

  res.json(result.rows);
});

// Get transaction by ID
router.get('/transaction/:id', auth(), async (req, res) => {
  const result = await pool.query(
    `SELECT t.* FROM transactions t
     JOIN wallets w ON t.wallet_id = w.id
     WHERE t.id = $1 AND w.user_id = $2`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json(result.rows[0]);
});

module.exports = router;
