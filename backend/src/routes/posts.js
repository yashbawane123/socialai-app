import express from 'express';
import db from '../services/db.js';
import auth from '../middleware/auth.js';
import { moderateContent } from '../services/moderation.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

// HELPER: Get dynamic WebSocket manager
const getIO = (req) => req.app.get('io');

// GET feeds (chronological)
router.get('/', auth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    let posts = db.collection('posts')
      .find({ visibility: 'public' })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .exec();

    const total = posts.length;
    posts = posts.slice(offset, offset + limit);

    // Populate posts with author profiles, like counts, and comments count
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

    res.json({ posts: populated, total, offset, limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE post with AI Moderation
router.post('/', auth, async (req, res) => {
  try {
    const { content, visibility, images } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    // 1. Run Content Moderation AI
    const moderation = await moderateContent(content, req.user.id, 'post');
    if (!moderation.isSafe && moderation.suggestedAction === 'remove') {
      return res.status(400).json({ 
        error: 'Content violates community safety policies.',
        violation: moderation.violations[0],
        explanation: moderation.explanation
      });
    }

    // 2. Classify category (Simulated simple classifier)
    let category = 'Technology';
    const lowContent = content.toLowerCase();
    if (lowContent.includes('launch') || lowContent.includes('product') || lowContent.includes('tool')) {
      category = 'Product Launch';
    } else if (lowContent.includes('wasm') || lowContent.includes('webassembly') || lowContent.includes('javascript') || lowContent.includes('code')) {
      category = 'Software Engineering';
    } else if (lowContent.includes('design') || lowContent.includes('figma') || lowContent.includes('css')) {
      category = 'UI/UX Design';
    } else if (lowContent.includes('ai') || lowContent.includes('claude') || lowContent.includes('intelligence')) {
      category = 'AI & Machine Learning';
    }

    // Process uploaded photos and videos in images array
    const processedUrls = [];
    if (images && Array.isArray(images)) {
      for (const img of images) {
        if (img && img.startsWith('data:')) {
          const matches = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            let ext = 'png';
            const parts = mimeType.split('/');
            if (parts.length === 2) {
              ext = parts[1];
              if (ext.includes('+')) ext = ext.split('+')[0];
            }
            
            const typePrefix = parts[0] === 'video' ? 'video' : 'photo';
            const filename = `${typePrefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
            const filePath = path.resolve('./uploads', filename);
            await fs.writeFile(filePath, buffer);
            
            const host = req.get('host') || 'localhost:5000';
            const protocol = req.protocol || 'http';
            const fileUrl = `${protocol}://${host}/uploads/${filename}`;
            processedUrls.push(fileUrl);
          } else {
            processedUrls.push(img);
          }
        } else {
          processedUrls.push(img);
        }
      }
    }

    // 3. Save Post
    const newPost = db.collection('posts').insert({
      user_id: req.user.id,
      content,
      image_urls: processedUrls,
      visibility: visibility || 'public',
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      content_category: category,
      ai_generated_summary: category + ' announcement',
      is_flagged: !moderation.isSafe
    });

    // Populate new post with author details for response
    const author = db.collection('users').findOne({ id: req.user.id });
    const responsePost = {
      ...newPost,
      author: author ? {
        name: author.full_name || author.username,
        handle: author.username,
        avatar: author.profile_picture_url || '😊',
        verified: author.is_verified || false
      } : null,
      likes: 0,
      comments: 0,
      liked: false
    };

    // 4. WebSocket Broadcast to all connected clients
    const io = getIO(req);
    if (io) {
      io.emit('post:new', responsePost);
    }

    res.status(201).json(responsePost);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LIKE / UNLIKE posts
router.post('/:id/like', auth, (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = db.collection('posts').findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existingLike = db.collection('likes').findOne({ user_id: userId, post_id: postId });
    let liked = false;

    if (existingLike) {
      // Unlike post
      db.collection('likes').delete({ id: existingLike.id });
    } else {
      // Like post
      db.collection('likes').insert({ user_id: userId, post_id: postId });
      liked = true;

      // Trigger user notification if it's someone else's post
      if (post.user_id !== userId) {
        const liker = db.collection('users').findOne({ id: userId });
        const notification = db.collection('notifications').insert({
          user_id: post.user_id,
          from_user_id: userId,
          type: 'like',
          related_post_id: postId,
          message: `${liker.full_name || liker.username} liked your post.`,
          is_read: false
        });

        // Emit real-time notification
        const io = getIO(req);
        if (io) {
          io.emit(`notification:${post.user_id}`, {
            ...notification,
            fromUser: {
              name: liker.full_name || liker.username,
              avatar: liker.profile_picture_url
            }
          });
        }
      }
    }

    const likesCount = db.collection('likes').count({ post_id: postId });
    
    // Broadcast like count update
    const io = getIO(req);
    if (io) {
      io.emit('like:update', { postId, count: likesCount });
    }

    res.json({ liked, likesCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Comments on a post
router.get('/:id/comments', auth, (req, res) => {
  try {
    const postId = req.params.id;
    
    const comments = db.collection('comments')
      .find({ post_id: postId })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .exec();

    const populated = comments.map(c => {
      const commentator = db.collection('users').findOne({ id: c.user_id });
      return {
        ...c,
        author: commentator ? {
          name: commentator.full_name || commentator.username,
          handle: commentator.username,
          avatar: commentator.profile_picture_url || '👤'
        } : null
      };
    });

    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD Comment to a post
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, parentCommentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    const post = db.collection('posts').findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // AI Moderation for comments
    const moderation = await moderateContent(content, req.user.id, 'comment');
    if (!moderation.isSafe && moderation.suggestedAction === 'remove') {
      return res.status(400).json({ error: 'Comment violates community safety rules.' });
    }

    const newComment = db.collection('comments').insert({
      post_id: postId,
      user_id: req.user.id,
      content,
      parent_comment_id: parentCommentId || null
    });

    const commentator = db.collection('users').findOne({ id: req.user.id });
    const responseComment = {
      ...newComment,
      author: commentator ? {
        name: commentator.full_name || commentator.username,
        handle: commentator.username,
        avatar: commentator.profile_picture_url || '👤'
      } : null
    };

    // WebSocket notify other listeners on this post
    const io = getIO(req);
    if (io) {
      io.emit(`comment:new:${postId}`, responseComment);
    }

    // Trigger Notification for post owner
    if (post.user_id !== req.user.id) {
      const notification = db.collection('notifications').insert({
        user_id: post.user_id,
        from_user_id: req.user.id,
        type: 'comment',
        related_post_id: postId,
        message: `${commentator.full_name || commentator.username} commented on your post.`,
        is_read: false
      });

      if (io) {
        io.emit(`notification:${post.user_id}`, {
          ...notification,
          fromUser: {
            name: commentator.full_name || commentator.username,
            avatar: commentator.profile_picture_url
          }
        });
      }
    }

    res.status(201).json(responseComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE a new reel with AI moderation
router.post('/meta/reels', auth, async (req, res) => {
  try {
    const { caption, musicName, themeColor, video } = req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({ error: 'Reel caption cannot be empty.' });
    }

    // 1. Run Content Moderation AI
    const moderation = await moderateContent(caption, req.user.id, 'post');
    if (!moderation.isSafe && moderation.suggestedAction === 'remove') {
      return res.status(400).json({ 
        error: 'Content violates community safety policies.',
        violation: moderation.violations[0],
        explanation: moderation.explanation
      });
    }

    // Process uploaded Reel video
    let videoUrl = null;
    if (video && video.startsWith('data:')) {
      const matches = video.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        let ext = 'mp4';
        const parts = mimeType.split('/');
        if (parts.length === 2) {
          ext = parts[1];
          if (ext.includes('+')) ext = ext.split('+')[0];
        }
        
        const filename = `video-reel-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
        const filePath = path.resolve('./uploads', filename);
        await fs.writeFile(filePath, buffer);
        
        const host = req.get('host') || 'localhost:5000';
        const protocol = req.protocol || 'http';
        videoUrl = `${protocol}://${host}/uploads/${filename}`;
      }
    }

    // 2. Save Reel
    const newReel = db.collection('reels').insert({
      user_id: req.user.id,
      caption,
      likes_count: 0,
      comments_count: 0,
      music_name: musicName && musicName.trim() ? musicName.trim() : `${req.user.full_name || req.user.username} • Original Audio`,
      theme_color: themeColor || 'from-blue-500 to-purple-600',
      video_url: videoUrl
    });

    // Populate new reel with author details for response
    const author = db.collection('users').findOne({ id: req.user.id });
    const responseReel = {
      ...newReel,
      author: author ? {
        name: author.full_name || author.username,
        handle: author.username,
        avatar: author.profile_picture_url || '👤',
        verified: author.is_verified || false
      } : null,
      liked: false
    };

    // 3. WebSocket Broadcast to all connected clients
    const io = getIO(req);
    if (io) {
      io.emit('reel:new', responseReel);
    }

    res.status(201).json(responseReel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all reels
router.get('/meta/reels', auth, (req, res) => {
  try {
    const reels = db.collection('reels').find().exec();
    const populated = reels.map(r => {
      const author = db.collection('users').findOne({ id: r.user_id });
      const liked = db.collection('likes').findOne({ user_id: req.user.id, post_id: r.id }) !== null;
      
      return {
        ...r,
        author: author ? {
          name: author.full_name || author.username,
          handle: author.username,
          avatar: author.profile_picture_url || '👤',
          verified: author.is_verified || false
        } : null,
        liked
      };
    });
    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LIKE / UNLIKE a reel
router.post('/meta/reels/:id/like', auth, (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user.id;

    const reel = db.collection('reels').findOne({ id: reelId });
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    const existingLike = db.collection('likes').findOne({ user_id: userId, post_id: reelId });
    let liked = false;

    if (existingLike) {
      db.collection('likes').delete({ id: existingLike.id });
      db.collection('reels').update({ id: reelId }, { likes_count: Math.max(0, reel.likes_count - 1) });
    } else {
      db.collection('likes').insert({ user_id: userId, post_id: reelId });
      db.collection('reels').update({ id: reelId }, { likes_count: reel.likes_count + 1 });
      liked = true;
    }

    const updatedReel = db.collection('reels').findOne({ id: reelId });
    res.json({ liked, likesCount: updatedReel.likes_count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
