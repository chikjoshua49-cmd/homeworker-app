const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { ROLES } = require('../config/constants');

const auth = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { userId, role } = decoded;

      // Check if user exists and is active
      const result = await pool.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const user = result.rows[0];

      // Check role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};

module.exports = { auth };
