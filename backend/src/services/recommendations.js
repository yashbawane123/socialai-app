import aiClient from './aiClient.js';
import db from './db.js';
import cache from './cache.js';

export async function generateRecommendations(userId, limit = 20) {
  const cacheKey = `rec:${userId}`;
  
  // Try to load cached recommendations
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    // 1. Fetch user data
    const user = db.collection('users').findOne({ id: userId });
    if (!user) {
      // Return general timeline if user doesn't exist
      const posts = db.collection('posts').find({ visibility: 'public' }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).limit(limit).exec();
      return { recommendations: { reasoning: "General Feed" }, posts };
    }

    // 2. Fetch user activity topics (aggregated from likes/comments)
    // Gather all posts liked/commented by this user
    const likedPostIds = db.collection('likes').find(l => l.user_id === userId && l.post_id).exec().map(l => l.post_id);
    const commentedPostIds = db.collection('comments').find(c => c.user_id === userId).exec().map(c => c.post_id);
    const interactedPostIds = Array.from(new Set([...likedPostIds, ...commentedPostIds]));

    const interestsMap = {};
    interactedPostIds.forEach(postId => {
      const post = db.collection('posts').findOne({ id: postId });
      if (post && post.content_category) {
        interestsMap[post.content_category] = (interestsMap[post.content_category] || 0) + 1;
      }
    });

    const userInterests = Object.entries(interestsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => `${entry[0]}: ${entry[1]} interactions`);

    // 3. Query follow details
    const followingCount = db.collection('follows').count({ follower_id: userId });

    // 4. Construct AI prompt
    const systemPrompt = `Based on the user profile and activity, recommend content types they would find most engaging. Provide ONLY a JSON response (no markdown, no backticks).
    
Your response must be valid JSON with this structure:
{
  "recommendedCategories": ["category1", "category2", ...],
  "recommendedTags": ["tag1", "tag2", ...],
  "contentTypes": ["posts", "images", "videos"],
  "reasoning": "brief explanation"
}`;

    const userPrompt = `User Profile:
- Bio: ${user.bio || "Not provided"}
- Name: ${user.full_name || user.username}
- Following: ${followingCount} users

User Interests (derived from activity):
${userInterests.length > 0 ? userInterests.join('\n') : "- No interactions recorded yet (New User)"}`;

    const responseText = await aiClient.generateCompletion(systemPrompt, userPrompt);
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const recommendations = JSON.parse(cleanText);

    // 5. Fetch posts matching recommended categories
    let matchingPosts = db.collection('posts')
      .find(post => {
        // Exclude own posts
        if (post.user_id === userId) return false;
        // Public posts only
        if (post.visibility !== 'public') return false;
        // Post category matches recommendations or user has not already liked it
        const matchesCategory = recommendations.recommendedCategories.some(
          cat => post.content_category && post.content_category.toLowerCase().includes(cat.toLowerCase())
        );
        const alreadyLiked = db.collection('likes').findOne({ user_id: userId, post_id: post.id });
        
        return matchesCategory && !alreadyLiked;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .limit(limit)
      .exec();

    // Attach authors, likes, comments count to posts
    matchingPosts = matchingPosts.map(post => {
      const author = db.collection('users').findOne({ id: post.user_id });
      const likesCount = db.collection('likes').count({ post_id: post.id });
      const commentsCount = db.collection('comments').count({ post_id: post.id });
      const liked = db.collection('likes').findOne({ user_id: userId, post_id: post.id }) !== null;

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

    const result = {
      recommendations,
      posts: matchingPosts,
      timestamp: new Date().toISOString()
    };

    // Cache the recommendations
    cache.set(cacheKey, result, 300000); // Cache for 5 minutes

    // Log AI interaction
    db.collection('ai_interactions').insert({
      user_id: userId,
      interaction_type: 'recommendation',
      ai_response: recommendations
    });

    return result;
  } catch (error) {
    console.error('AI Recommendations Engine error:', error);
    // Fallback: return top trending posts
    const posts = db.collection('posts')
      .find({ visibility: 'public' })
      .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
      .limit(limit)
      .exec()
      .map(post => {
        const author = db.collection('users').findOne({ id: post.user_id });
        return {
          ...post,
          author: author ? {
            name: author.full_name || author.username,
            handle: author.username,
            avatar: author.profile_picture_url || '👤',
            verified: author.is_verified || false
          } : null
        };
      });
      
    return {
      recommendations: { reasoning: "Fallback to popular feed due to error" },
      posts
    };
  }
}
