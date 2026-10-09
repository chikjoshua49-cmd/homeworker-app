const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { auth } = require('../middleware/auth');
const {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
} = require('../validators/auth.validator');

// Register
router.post('/register', validate(registerSchema), async (req, res) => {
  const user = await authService.register(req.validatedData);
  res.status(201).json({
    message: 'User registered successfully',
    user,
  });
});

// Login
router.post('/login', validate(loginSchema), async (req, res) => {
  const result = await authService.login(req.validatedData.email, req.validatedData.password);
  res.json(result);
});

// Get current user
router.get('/me', auth(), async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json(user);
});

// Update profile
router.put('/profile', auth(), validate(updateProfileSchema), async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.validatedData);
  res.json({
    message: 'Profile updated successfully',
    user,
  });
});

module.exports = router;
