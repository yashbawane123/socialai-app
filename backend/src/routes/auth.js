import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../services/db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforsocialaiplatform';

// REGISTER route
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, bio, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    // Alphanumeric + underscore validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters and contain only alphanumeric characters or underscores.' });
    }

    // Password length validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // Check duplicate
    const existingUser = db.collection('users').findOne(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = db.collection('users').insert({
      username,
      email,
      password_hash: passwordHash,
      full_name: fullName || username,
      bio: bio || '',
      profile_picture_url: avatar || '😊',
      is_verified: false,
      is_public: true
    });

    // Generate token
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        bio: newUser.bio,
        profile_picture_url: newUser.profile_picture_url,
        is_verified: newUser.is_verified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.collection('users').findOne(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        profile_picture_url: user.profile_picture_url,
        is_verified: user.is_verified
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
