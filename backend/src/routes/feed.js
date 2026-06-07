import express from 'express';
import db from '../services/db.js';
import auth from '../middleware/auth.js';
import { generateRecommendations } from '../services/recommendations.js';

const router = express.Router();

// GET Recommended personalized feed (AI engine backed)
router.get('/recommended', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await generateRecommendations(req.user.id, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Explore (trending categories & high-engagement posts)
router.get('/explore', auth, (req, res) => {
  try {
    const posts = db.collection('posts')
      .find({ visibility: 'public' })
      .sort((a, b) => {
        // Simple popularity rank: likes + comments
        const engagementA = (db.collection('likes').count({ post_id: a.id }) * 2) + (db.collection('comments').count({ post_id: a.id }) * 3);
        const engagementB = (db.collection('likes').count({ post_id: b.id }) * 2) + (db.collection('comments').count({ post_id: b.id }) * 3);
        return engagementB - engagementA;
      })
      .limit(20)
      .exec();

    const populated = posts.map(post => {
      const author = db.collection('users').findOne({ id: post.user_id });
      const likesCount = db.collection('likes').count({ post_id: post.id });
      const commentsCount = db.collection('comments').count({ post_id: post.id });
      const liked = db.collection('likes').findOne({ user_id: req.user.id, post_id: post.id }) !== null;

      return {
        ...post,
        author: author ? {
          name: author.full_name || author.username,
          handle: author.username,
          avatar: author.profile_picture_url || '👤',
          verified: author.is_verified || false
        } : null,
        likes: likesCount,
        comments: commentsCount,
        liked
      };
    });

    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
