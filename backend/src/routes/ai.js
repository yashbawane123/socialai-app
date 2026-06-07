import express from 'express';
import auth from '../middleware/auth.js';
import db from '../services/db.js';
import { generateSmartReplies } from '../services/smartReplies.js';
import { analyzeTrends } from '../services/trendAnalysis.js';
import { analyzeUserSafety } from '../services/userSafety.js';

const router = express.Router();

// GET Smart reply suggestions for a post
router.get('/smart-replies/:postId', auth, async (req, res) => {
  try {
    const suggestions = await generateSmartReplies(req.params.postId, req.user.id);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Global Trend Analysis Insights
router.get('/trends', auth, async (req, res) => {
  try {
    const window = req.query.window || '24h';
    const trends = await analyzeTrends(window);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET User Safety Ratings & toxicity checks
router.get('/safety-rating', auth, async (req, res) => {
  try {
    const rating = await analyzeUserSafety(req.user.id);
    res.json(rating);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET User Notifications
router.get('/notifications', auth, (req, res) => {
  try {
    const notifications = db.collection('notifications')
      .find({ user_id: req.user.id })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .exec();

    const populated = notifications.map(n => {
      const fromUser = db.collection('users').findOne({ id: n.from_user_id });
      return {
        ...n,
        fromUser: fromUser ? {
          name: fromUser.full_name || fromUser.username,
          avatar: fromUser.profile_picture_url || '👤'
        } : { name: 'System', avatar: '🤖' }
      };
    });

    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MARK notification as read
router.put('/notifications/:id/read', auth, (req, res) => {
  try {
    db.collection('notifications').update(
      { id: req.params.id, user_id: req.user.id },
      { is_read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
