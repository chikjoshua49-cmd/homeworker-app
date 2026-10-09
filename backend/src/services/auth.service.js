const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

class AuthService {
  async register(userData) {
    const { email, password, first_name, last_name, phone, role } = userData;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw {
        statusCode: 409,
        message: 'Email already registered',
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, first_name, last_name, phone || null, role]
    );

    const user = result.rows[0];

    // Create wallet for user
    await pool.query(
      'INSERT INTO wallets (user_id) VALUES ($1)',
      [user.id]
    );

    // Create profile based on role
    if (role === 'worker') {
      await pool.query(
        'INSERT INTO worker_profiles (user_id, hourly_rate) VALUES ($1, $2)',
        [user.id, 0]
      );
    } else if (role === 'customer') {
      await pool.query(
        'INSERT INTO customer_profiles (user_id) VALUES ($1)',
        [user.id]
      );
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      created_at: user.created_at,
    };
  }

  async login(email, password) {
    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 401,
        message: 'Invalid email or password',
      };
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw {
        statusCode: 403,
        message: 'Account is inactive',
      };
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw {
        statusCode: 401,
        message: 'Invalid email or password',
      };
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  async getCurrentUser(userId) {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone, profile_picture_url, bio, role, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        message: 'User not found',
      };
    }

    return result.rows[0];
  }

  async updateProfile(userId, updateData) {
    const { first_name, last_name, phone, bio, profile_picture_url } = updateData;

    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           bio = COALESCE($4, bio),
           profile_picture_url = COALESCE($5, profile_picture_url),
           updated_at = now()
       WHERE id = $6
       RETURNING id, email, first_name, last_name, phone, profile_picture_url, bio, role`,
      [first_name, last_name, phone, bio, profile_picture_url, userId]
    );

    if (result.rows.length === 0) {
      throw {
        statusCode: 404,
        message: 'User not found',
      };
    }

    return result.rows[0];
  }
}

module.exports = new AuthService();
