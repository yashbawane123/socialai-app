# AI Agent Implementation Guide for Social Media Platform

## Table of Contents
1. [Setup & Configuration](#setup--configuration)
2. [Content Moderation Agent](#content-moderation-agent)
3. [Recommendation Engine](#recommendation-engine)
4. [Smart Reply Generator](#smart-reply-generator)
5. [Trend Analysis Agent](#trend-analysis-agent)
6. [User Safety Monitor](#user-safety-monitor)
7. [Rate Limiting & Cost Management](#rate-limiting--cost-management)
8. [Monitoring & Logging](#monitoring--logging)

---

## Setup & Configuration

### Installation

```bash
npm install @anthropic-ai/sdk dotenv axios bull redis express-rate-limit
```

### Environment Variables (.env)

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:password@localhost/social_media
REDIS_URL=redis://localhost:6379
NODE_ENV=production
AI_MODEL=claude-opus-4-6
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600000
```

### Initialize Claude Client

```javascript
// src/services/aiClient.js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default client;
```

### Queue Setup for Background Jobs

```javascript
// src/services/queue.js
import Queue from "bull";
import Redis from "redis";

const redisClient = {
  host: "localhost",
  port: 6379,
};

export const contentModerationQueue = new Queue("content-moderation", redisClient);
export const recommendationQueue = new Queue("recommendations", redisClient);
export const trendAnalysisQueue = new Queue("trend-analysis", redisClient);

// Process queues
contentModerationQueue.process(async (job) => {
  return await moderateContentJob(job.data);
});

recommendationQueue.process(async (job) => {
  return await generateRecommendationsJob(job.data);
});

trendAnalysisQueue.process(async (job) => {
  return await analyzeTrendsJob(job.data);
});
```

---

## Content Moderation Agent

### Overview
Real-time content analysis to detect spam, harassment, hate speech, and policy violations.

### Implementation

```javascript
// src/services/contentModeration.js
import client from "./aiClient.js";
import { contentModerationQueue } from "./queue.js";
import db from "./database.js";

const MODERATION_CACHE = new Map(); // Simple in-memory cache
const CACHE_TTL = 3600000; // 1 hour

export async function moderateContent(content, userId, contentType = "post") {
  // Check cache first
  const cacheKey = `mod:${contentType}:${content.substring(0, 50)}`;
  if (MODERATION_CACHE.has(cacheKey)) {
    const cached = MODERATION_CACHE.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 500,
      system: `You are a content moderation AI for a social media platform. Analyze the provided content and respond ONLY with valid JSON (no markdown, no code blocks).

Your response must be valid JSON with this exact structure:
{
  "isSafe": boolean,
  "violations": [],
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": number between 0 and 1,
  "categories": [],
  "suggestedAction": "allow" | "flag" | "hide" | "remove",
  "explanation": "brief explanation"
}

Check for:
- Hate speech and discrimination
- Harassment and bullying
- Spam and misleading content
- Violence and self-harm
- Sexual content
- Misinformation
- Copyright violations
- Doxxing and privacy violations`,
      messages: [
        {
          role: "user",
          content: `Please moderate this ${contentType}:\n\n"${content}"`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    // Clean up markdown if present
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleanText);

    // Cache the result
    MODERATION_CACHE.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Store in database
    await db.query(
      `INSERT INTO ai_interactions 
       (user_id, interaction_type, ai_response, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [userId, "moderation", JSON.stringify(result)]
    );

    // If violated, create flag
    if (!result.isSafe && result.suggestedAction !== "allow") {
      await db.query(
        `INSERT INTO content_flags 
         (user_id, content_type, content_preview, violation_type, severity, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, 'pending_review', NOW())`,
        [
          userId,
          contentType,
          content.substring(0, 200),
          result.categories.join(", "),
          result.severity,
        ]
      );
    }

    return result;
  } catch (error) {
    console.error("Content moderation error:", error);
    // Fail safe: flag for manual review
    return {
      isSafe: null,
      violations: ["Moderation service error"],
      severity: "critical",
      confidence: 0,
      categories: [],
      suggestedAction: "flag",
      explanation: "Automatic moderation failed, flagged for manual review",
    };
  }
}

// Middleware for express
export async function moderationMiddleware(req, res, next) {
  if (req.body.content) {
    const modResult = await moderateContent(
      req.body.content,
      req.user.id,
      "post"
    );

    if (!modResult.isSafe && modResult.suggestedAction === "remove") {
      return res.status(403).json({
        error: "Content violates platform policy",
        violation: modResult.categories[0],
      });
    }

    if (modResult.suggestedAction === "flag") {
      req.flaggedContent = true;
      req.moderationResult = modResult;
    }
  }
  next();
}

// Batch moderation for existing content
export async function batchModerateContent(contentIds) {
  for (const id of contentIds) {
    await contentModerationQueue.add({ contentId: id });
  }
}

async function moderateContentJob(data) {
  const { contentId } = data;
  const content = await db.query(`SELECT * FROM posts WHERE id = $1`, [
    contentId,
  ]);
  if (content.rows.length === 0) return;

  const post = content.rows[0];
  const result = await moderateContent(post.content, post.user_id, "post");

  // Update post with moderation result
  await db.query(
    `UPDATE posts SET is_flagged = $1, moderation_result = $2 WHERE id = $3`,
    [!result.isSafe, JSON.stringify(result), contentId]
  );
}
```

### Usage in Routes

```javascript
// src/routes/posts.js
import express from "express";
import { moderateContent, moderationMiddleware } from "../services/contentModeration.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Create post with moderation
router.post("/", auth, moderationMiddleware, async (req, res) => {
  try {
    const { content, images } = req.body;

    // Insert post
    const result = await db.query(
      `INSERT INTO posts (user_id, content, image_urls, created_at) 
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [req.user.id, content, images || []]
    );

    const post = result.rows[0];

    // If flagged, notify moderators
    if (req.flaggedContent) {
      await notifyModerators({
        postId: post.id,
        userId: req.user.id,
        reason: req.moderationResult.categories[0],
      });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## Recommendation Engine

### Overview
Personalized feed recommendations based on user behavior, interests, and content similarity.

### Implementation

```javascript
// src/services/recommendations.js
import client from "./aiClient.js";
import db from "./database.js";
import { recommendationQueue } from "./queue.js";

const RECOMMENDATION_CACHE = new Map();
const CACHE_TTL = 300000; // 5 minutes

export async function generateRecommendations(userId, limit = 20) {
  const cacheKey = `rec:${userId}`;
  if (RECOMMENDATION_CACHE.has(cacheKey)) {
    const cached = RECOMMENDATION_CACHE.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
  }

  try {
    // Fetch user profile and activity history
    const user = await db.query(`SELECT * FROM users WHERE id = $1`, [
      userId,
    ]);
    const userActivity = await db.query(
      `SELECT DISTINCT category, COUNT(*) as interactions 
       FROM (
         SELECT p.content_category as category FROM posts p 
         WHERE p.id IN (SELECT post_id FROM likes WHERE user_id = $1)
         UNION ALL
         SELECT p.content_category as category FROM posts p 
         WHERE p.id IN (SELECT post_id FROM comments WHERE user_id = $1)
       ) t 
       GROUP BY category 
       ORDER BY interactions DESC 
       LIMIT 5`,
      [userId]
    );

    const followingUsers = await db.query(
      `SELECT user_id FROM follows WHERE follower_id = $1 LIMIT 10`,
      [userId]
    );

    const prompt = `Based on the following user profile and activity, recommend the types of content this user would find most engaging.

User Profile:
- Bio: ${user.rows[0]?.bio || "Not provided"}
- Name: ${user.rows[0]?.full_name || "Unknown"}
- Following: ${followingUsers.rows.length} users

User Interests (derived from activity):
${userActivity.rows.map((r) => `- ${r.category}: ${r.interactions} interactions`).join("\n")}

Provide ONLY a JSON response with this structure (no markdown):
{
  "recommendedCategories": ["category1", "category2", ...],
  "recommendedTags": ["tag1", "tag2", ...],
  "contentTypes": ["posts", "images", "videos"],
  "reasoning": "brief explanation"
}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const recommendations = JSON.parse(cleanText);

    // Fetch posts matching recommendations
    const matchingPosts = await db.query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
       FROM posts p 
       WHERE p.content_category = ANY($1) 
       AND p.user_id != $2
       AND p.visibility = 'public'
       AND p.id NOT IN (
         SELECT post_id FROM likes WHERE user_id = $2
       )
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [recommendations.recommendedCategories, userId, limit]
    );

    const result = {
      recommendations,
      posts: matchingPosts.rows,
      timestamp: new Date(),
    };

    // Cache result
    RECOMMENDATION_CACHE.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Track recommendation event
    await db.query(
      `INSERT INTO ai_interactions 
       (user_id, interaction_type, ai_response, created_at) 
       VALUES ($1, 'recommendation', $2, NOW())`,
      [userId, JSON.stringify(recommendations)]
    );

    return result;
  } catch (error) {
    console.error("Recommendation error:", error);
    // Fallback: return trending posts
    const trending = await db.query(
      `SELECT p.* FROM posts p 
       ORDER BY p.likes_count DESC 
       LIMIT $1`,
      [limit]
    );
    return {
      recommendations: { reasoning: "Fallback to trending" },
      posts: trending.rows,
    };
  }
}

// Schedule daily recommendation updates
export async function scheduleRecommendationUpdates() {
  const users = await db.query(`SELECT id FROM users`);
  for (const user of users.rows) {
    await recommendationQueue.add({ userId: user.id });
  }
}

async function generateRecommendationsJob(data) {
  const { userId } = data;
  await generateRecommendations(userId);
}
```

### API Endpoint

```javascript
// In routes/feed.js
router.get("/recommended", auth, async (req, res) => {
  try {
    const result = await generateRecommendations(req.user.id, 20);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Smart Reply Generator

### Overview
Context-aware reply suggestions to help users engage faster.

### Implementation

```javascript
// src/services/smartReplies.js
import client from "./aiClient.js";
import db from "./database.js";

export async function generateSmartReplies(postId, userId, numSuggestions = 3) {
  try {
    // Fetch post context
    const post = await db.query(`SELECT * FROM posts WHERE id = $1`, [
      postId,
    ]);
    const comments = await db.query(
      `SELECT c.*, u.full_name FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.post_id = $1 
       ORDER BY c.created_at DESC 
       LIMIT 5`,
      [postId]
    );

    const postData = post.rows[0];
    const userProfile = await db.query(`SELECT * FROM users WHERE id = $1`, [
      userId,
    ]);

    const recentComments = comments.rows
      .map((c) => `${c.full_name}: ${c.content}`)
      .join("\n");

    const prompt = `Generate ${numSuggestions} natural, engaging reply suggestions for this post.

Post Content: "${postData.content}"

Recent Comments:
${recentComments || "No comments yet"}

User Profile:
- Name: ${userProfile.rows[0]?.full_name}
- Writing style: casual and friendly

Generate ONLY a JSON array with this structure (no markdown):
[
  {
    "text": "suggested reply text",
    "tone": "tone description",
    "emoji": "relevant emoji"
  },
  ...
]`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const suggestions = JSON.parse(cleanText);

    // Track smart reply usage
    await db.query(
      `INSERT INTO ai_interactions 
       (user_id, interaction_type, post_id, ai_response, created_at) 
       VALUES ($1, 'smart_reply', $2, $3, NOW())`,
      [userId, postId, JSON.stringify(suggestions)]
    );

    return suggestions;
  } catch (error) {
    console.error("Smart reply error:", error);
    return [];
  }
}

export async function acceptSmartReply(postId, userId, replyText) {
  // Create comment from smart reply
  const result = await db.query(
    `INSERT INTO comments (post_id, user_id, content, created_at) 
     VALUES ($1, $2, $3, NOW()) 
     RETURNING *`,
    [postId, userId, replyText]
  );

  // Track successful smart reply
  await db.query(
    `INSERT INTO ai_interactions 
     (user_id, interaction_type, post_id, ai_response, created_at) 
     VALUES ($1, 'smart_reply_accepted', $2, $3, NOW())`,
    [userId, postId, JSON.stringify({ accepted: true, text: replyText })]
  );

  return result.rows[0];
}
```

### API Routes

```javascript
// src/routes/ai.js
import express from "express";
import { generateSmartReplies, acceptSmartReply } from "../services/smartReplies.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get smart reply suggestions
router.get("/smart-replies/:postId", auth, async (req, res) => {
  try {
    const suggestions = await generateSmartReplies(
      req.params.postId,
      req.user.id
    );
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Use suggested reply
router.post("/smart-replies/accept/:postId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await acceptSmartReply(
      req.params.postId,
      req.user.id,
      text
    );
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## Trend Analysis Agent

### Overview
Identify trending topics, hashtags, and content patterns in real-time.

### Implementation

```javascript
// src/services/trendAnalysis.js
import client from "./aiClient.js";
import db from "./database.js";
import { trendAnalysisQueue } from "./queue.js";

const TRENDS_CACHE = new Map();
const CACHE_TTL = 1800000; // 30 minutes

export async function analyzeTrends(timeWindow = "24h") {
  const cacheKey = `trends:${timeWindow}`;

  if (TRENDS_CACHE.has(cacheKey)) {
    const cached = TRENDS_CACHE.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
  }

  try {
    // Calculate time window
    const hours = timeWindow === "24h" ? 24 : timeWindow === "7d" ? 168 : 1;
    const since = new Date(Date.now() - hours * 3600000);

    // Get trending posts and hashtags
    const trendingContent = await db.query(
      `SELECT 
        p.content_category,
        COUNT(p.id) as post_count,
        AVG(p.likes_count) as avg_engagement,
        MAX(p.likes_count) as peak_engagement
       FROM posts p
       WHERE p.created_at > $1
       AND p.visibility = 'public'
       GROUP BY p.content_category
       ORDER BY post_count DESC
       LIMIT 10`,
      [since]
    );

    // Extract hashtags
    const hashtagQuery = await db.query(
      `SELECT 
        UNNEST(regexp_matches(p.content, '#\\w+', 'g')) as hashtag,
        COUNT(*) as mentions
       FROM posts p
       WHERE p.created_at > $1
       GROUP BY hashtag
       ORDER BY mentions DESC
       LIMIT 15`,
      [since]
    );

    const categories = trendingContent.rows.map(
      (r) => `${r.content_category} (${r.post_count} posts)`
    );
    const hashtags = hashtagQuery.rows.map(
      (r) => `${r.hashtag} (${r.mentions} mentions)`
    );

    const prompt = `Analyze these trending patterns on a social media platform and provide insights.

Trending Categories (last ${timeWindow}):
${categories.join("\n")}

Trending Hashtags:
${hashtags.join("\n")}

Provide ONLY a JSON response (no markdown):
{
  "topTrends": ["trend1", "trend2", ...],
  "emergingTopics": ["topic1", "topic2", ...],
  "sentiment": "positive" | "neutral" | "negative",
  "predictions": ["what might trend next"],
  "recommendation": "suggested content ideas",
  "riskFlags": ["potential issues to watch"]
}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const trends = JSON.parse(cleanText);

    const result = {
      trends,
      categories: trendingContent.rows,
      hashtags: hashtagQuery.rows,
      timestamp: new Date(),
    };

    // Cache results
    TRENDS_CACHE.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Store in database for historical analysis
    await db.query(
      `INSERT INTO trend_analysis (data, analyzed_at) 
       VALUES ($1, NOW())`,
      [JSON.stringify(trends)]
    );

    return result;
  } catch (error) {
    console.error("Trend analysis error:", error);
    return null;
  }
}

// Schedule hourly trend analysis
export function scheduleTrendAnalysis() {
  setInterval(async () => {
    await trendAnalysisQueue.add({ timeWindow: "24h" });
    await trendAnalysisQueue.add({ timeWindow: "7d" });
  }, 3600000); // Every hour
}

async function analyzeTrendsJob(data) {
  const { timeWindow } = data;
  await analyzeTrends(timeWindow);
}
```

### API Endpoint

```javascript
// In routes/trends.js
router.get("/", async (req, res) => {
  try {
    const timeWindow = req.query.window || "24h";
    const trends = await analyzeTrends(timeWindow);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## User Safety Monitor

### Overview
Detect and prevent harassment, toxicity, and user safety threats.

### Implementation

```javascript
// src/services/userSafety.js
import client from "./aiClient.js";
import db from "./database.js";

export async function analyzeUserSafety(userId) {
  try {
    // Get user's interactions over past 7 days
    const interactions = await db.query(
      `SELECT 
        u.id, u.username,
        COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_comments,
        COUNT(CASE WHEN l.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_likes,
        COUNT(CASE WHEN cf.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_reports
       FROM users u
       LEFT JOIN comments c ON u.id = c.user_id
       LEFT JOIN likes l ON u.id = l.user_id
       LEFT JOIN content_flags cf ON u.id = cf.reported_by
       WHERE u.id = $1
       GROUP BY u.id, u.username`,
      [userId]
    );

    // Get recent comments to analyze tone
    const recentComments = await db.query(
      `SELECT content, created_at FROM comments WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get reports about this user
    const reports = await db.query(
      `SELECT reason, created_at FROM user_reports WHERE reported_user_id = $1
       AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const commentTexts = recentComments.rows
      .map((c) => `"${c.content}"`)
      .join("\n");
    const reportReasons = reports.rows.map((r) => r.reason).join(", ");

    const prompt = `Analyze user safety concerns based on this user's activity.

User Activity:
- Recent comments: ${interactions.rows[0]?.recent_comments || 0}
- Recent reports: ${interactions.rows[0]?.recent_reports || 0}

Recent Comments:
${commentTexts || "No comments"}

Reports Filed Against User:
${reportReasons || "No reports"}

Provide ONLY a JSON response (no markdown):
{
  "safetyScore": number between 0 and 100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "concerns": ["concern1", "concern2"],
  "patterns": ["pattern1", "pattern2"],
  "recommendations": ["action1", "action2"],
  "shouldReview": boolean
}`;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const analysis = JSON.parse(cleanText);

    // Alert moderators if high risk
    if (analysis.riskLevel === "high" || analysis.riskLevel === "critical") {
      await notifyModerators({
        type: "user_safety_alert",
        userId,
        riskLevel: analysis.riskLevel,
        concerns: analysis.concerns,
      });

      // Temporarily limit user interactions
      if (analysis.riskLevel === "critical") {
        await db.query(
          `UPDATE users SET is_restricted = true WHERE id = $1`,
          [userId]
        );
      }
    }

    // Store analysis
    await db.query(
      `INSERT INTO user_safety_analysis (user_id, analysis, risk_level, created_at) 
       VALUES ($1, $2, $3, NOW())`,
      [userId, JSON.stringify(analysis), analysis.riskLevel]
    );

    return analysis;
  } catch (error) {
    console.error("User safety analysis error:", error);
    return null;
  }
}

// Daily user safety scan
export function scheduleUserSafetyScan() {
  setInterval(async () => {
    const users = await db.query(
      `SELECT id FROM users WHERE is_active = true`
    );
    for (const user of users.rows) {
      await analyzeUserSafety(user.id);
    }
  }, 86400000); // Every 24 hours
}
```

---

## Rate Limiting & Cost Management

### Implementation

```javascript
// src/middleware/aiRateLimit.js
import rateLimit from "express-rate-limit";
import db from "../services/database.js";

const apiCalls = new Map();

export const aiRateLimit = (maxCallsPerDay = 100) => {
  return async (req, res, next) => {
    const userId = req.user.id;
    const today = new Date().toDateString();
    const key = `${userId}:${today}`;

    if (!apiCalls.has(key)) {
      // Load from database
      const result = await db.query(
        `SELECT api_calls FROM user_ai_usage 
         WHERE user_id = $1 AND date = $2`,
        [userId, today]
      );
      apiCalls.set(key, result.rows[0]?.api_calls || 0);
    }

    const currentCalls = apiCalls.get(key);

    if (currentCalls >= maxCallsPerDay) {
      return res.status(429).json({
        error: "AI API rate limit exceeded",
        remaining: 0,
        resetAt: new Date(Date.now() + 86400000),
      });
    }

    // Increment counter
    const newCount = currentCalls + 1;
    apiCalls.set(key, newCount);

    // Update database
    await db.query(
      `INSERT INTO user_ai_usage (user_id, date, api_calls) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date) DO UPDATE SET api_calls = api_calls + 1`,
      [userId, today, 1]
    );

    res.locals.aiCallsRemaining = maxCallsPerDay - newCount;
    next();
  };
};

// Cost tracking
export async function trackAICost(type, tokens) {
  const costPerMTok = 0.015; // $0.015 per 1M input tokens
  const cost = (tokens / 1000000) * costPerMTok;

  await db.query(
    `INSERT INTO ai_costs (type, tokens, cost, created_at) 
     VALUES ($1, $2, $3, NOW())`,
    [type, tokens, cost]
  );

  return cost;
}

// Monthly cost report
export async function getMonthCostReport(month = new Date()) {
  const result = await db.query(
    `SELECT 
      type,
      SUM(tokens) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(*) as call_count
     FROM ai_costs
     WHERE EXTRACT(YEAR FROM created_at) = $1
     AND EXTRACT(MONTH FROM created_at) = $2
     GROUP BY type`,
    [month.getFullYear(), month.getMonth() + 1]
  );

  return result.rows;
}
```

---

## Monitoring & Logging

### Implementation

```javascript
// src/services/aiMonitoring.js
import db from "./database.js";

export async function logAICall(userId, service, input, output, tokens, duration) {
  await db.query(
    `INSERT INTO ai_call_logs 
     (user_id, service, input_preview, output_preview, tokens_used, duration_ms, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      userId,
      service,
      input.substring(0, 200),
      output.substring(0, 200),
      tokens,
      duration,
    ]
  );
}

export async function getAIMetrics(timeRange = "24h") {
  const hours = timeRange === "24h" ? 24 : 7 * 24;

  const metrics = await db.query(
    `SELECT 
      service,
      COUNT(*) as call_count,
      AVG(duration_ms) as avg_duration,
      MAX(duration_ms) as max_duration,
      SUM(tokens_used) as total_tokens
     FROM ai_call_logs
     WHERE created_at > NOW() - INTERVAL '${hours} hours'
     GROUP BY service`,
    []
  );

  const errors = await db.query(
    `SELECT 
      error_type,
      COUNT(*) as count
     FROM ai_errors
     WHERE created_at > NOW() - INTERVAL '${hours} hours'
     GROUP BY error_type`,
    []
  );

  return {
    callMetrics: metrics.rows,
    errors: errors.rows,
    timeRange,
  };
}

export async function alertOnAnomalies() {
  // Check for unusual patterns
  const anomalies = await db.query(
    `SELECT 
      service,
      AVG(duration_ms) as avg_duration
     FROM ai_call_logs
     WHERE created_at > NOW() - INTERVAL '1 hour'
     GROUP BY service
     HAVING AVG(duration_ms) > 5000`,
    []
  );

  if (anomalies.rows.length > 0) {
    console.warn("AI Performance Anomalies Detected:", anomalies.rows);
    // Send alert to monitoring system
  }
}

// Periodic health check
export function scheduleHealthCheck() {
  setInterval(async () => {
    try {
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 10,
        messages: [{ role: "user", content: "OK" }],
      });

      await db.query(
        `INSERT INTO ai_health_check (status, response_time, checked_at) 
         VALUES ('healthy', $1, NOW())`,
        [response.$response.headers["x-response-time"]]
      );
    } catch (error) {
      await db.query(
        `INSERT INTO ai_health_check (status, error, checked_at) 
         VALUES ('error', $1, NOW())`,
        [error.message]
      );

      // Send alert
      console.error("AI Service Health Check Failed:", error.message);
    }
  }, 300000); // Every 5 minutes
}
```

---

## Summary

This comprehensive AI agent implementation provides:

✅ **Content Moderation** - Real-time policy violation detection  
✅ **Recommendations** - Personalized feed generation  
✅ **Smart Replies** - Context-aware reply suggestions  
✅ **Trend Analysis** - Real-time trend identification  
✅ **User Safety** - Harassment and safety threat detection  
✅ **Cost Management** - Rate limiting and usage tracking  
✅ **Monitoring** - Performance metrics and alerts  

All services use **Claude's API** for intelligent analysis with proper error handling, caching, and database integration.