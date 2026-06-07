import express from 'express';
import db from '../services/db.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const getIO = (req) => req.app.get('io');

// SEARCH users
router.get('/search', auth, (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    
    if (!query) {
      return res.json([]);
    }

    const matches = db.collection('users')
      .find(u => u.username.toLowerCase().includes(query) || (u.full_name && u.full_name.toLowerCase().includes(query)))
      .limit(10)
      .exec()
      .map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        profile_picture_url: u.profile_picture_url,
        bio: u.bio,
        is_verified: u.is_verified
      }));

    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET active user details (Self)
router.get('/me', auth, (req, res) => {
  try {
    const user = db.collection('users').findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const followers = db.collection('follows').count({ following_id: req.user.id });
    const following = db.collection('follows').count({ follower_id: req.user.id });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      bio: user.bio,
      profile_picture_url: user.profile_picture_url,
      is_verified: user.is_verified,
      followersCount: followers,
      followingCount: following
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET specific user profile
router.get('/:id', auth, (req, res) => {
  try {
    const user = db.collection('users').findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const followers = db.collection('follows').count({ following_id: user.id });
    const following = db.collection('follows').count({ follower_id: user.id });
    const isFollowing = db.collection('follows').findOne({ follower_id: req.user.id, following_id: user.id }) !== null;

    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      bio: user.bio,
      profile_picture_url: user.profile_picture_url,
      is_verified: user.is_verified,
      followersCount: followers,
      followingCount: following,
      isFollowing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FOLLOW / UNFOLLOW a user
router.post('/:id/follow', auth, (req, res) => {
  try {
    const targetUserId = req.params.id;
    const followerId = req.user.id;

    if (targetUserId === followerId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const targetUser = db.collection('users').findOne({ id: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingFollow = db.collection('follows').findOne({ follower_id: followerId, following_id: targetUserId });
    let isFollowing = false;

    if (existingFollow) {
      // Unfollow
      db.collection('follows').delete({ id: existingFollow.id });
    } else {
      // Follow
      db.collection('follows').insert({ follower_id: followerId, following_id: targetUserId });
      isFollowing = true;

      // Notify the target user
      const follower = db.collection('users').findOne({ id: followerId });
      const notification = db.collection('notifications').insert({
        user_id: targetUserId,
        from_user_id: followerId,
        type: 'follow',
        message: `${follower.full_name || follower.username} started following you.`,
        is_read: false
      });

      // Emit WebSocket notification
      const io = getIO(req);
      if (io) {
        io.emit(`notification:${targetUserId}`, {
          ...notification,
          fromUser: {
            name: follower.full_name || follower.username,
            avatar: follower.profile_picture_url
          }
        });
      }
    }

    res.json({
      isFollowing,
      followersCount: db.collection('follows').count({ following_id: targetUserId }),
      followingCount: db.collection('follows').count({ follower_id: targetUserId })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET user suggestions (People to follow)
router.get('/meta/suggestions', auth, (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Get users that current user is NOT already following
    const followingIds = db.collection('follows')
      .find({ follower_id: currentUserId })
      .exec()
      .map(f => f.following_id);

    const suggestions = db.collection('users')
      .find(u => u.id !== currentUserId && !followingIds.includes(u.id))
      .limit(5)
      .exec()
      .map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        profile_picture_url: u.profile_picture_url,
        bio: u.bio,
        is_verified: u.is_verified,
        following: false
      }));

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
