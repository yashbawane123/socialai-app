import aiClient from './aiClient.js';
import db from './db.js';

export async function generateSmartReplies(postId, userId, numSuggestions = 3) {
  try {
    // 1. Fetch post context
    const post = db.collection('posts').findOne({ id: postId });
    if (!post) return [];

    // 2. Fetch recent comments on this post for context
    let comments = db.collection('comments')
      .find({ post_id: postId })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .limit(5)
      .exec();

    const recentComments = comments.map(c => {
      const commentator = db.collection('users').findOne({ id: c.user_id });
      const name = commentator ? (commentator.full_name || commentator.username) : 'User';
      return `${name}: ${c.content}`;
    }).join('\n');

    // 3. Fetch user profile writing this reply
    const userProfile = db.collection('users').findOne({ id: userId });

    // 4. Construct prompt
    const systemPrompt = `Generate ${numSuggestions} natural, engaging reply suggestions for this post. Generate ONLY a valid JSON array, do not add markdown or backticks.
    
Your response must follow this exact structure:
[
  {
    "text": "suggested reply text",
    "tone": "tone description",
    "emoji": "relevant emoji"
  },
  ...
]`;

    const userPrompt = `Post Content: "${post.content}"

Recent Comments:
${recentComments || "No comments yet"}

User Profile:
- Name: ${userProfile ? (userProfile.full_name || userProfile.username) : 'Self'}
- Writing style: casual, friendly, professional`;

    const responseText = await aiClient.generateCompletion(systemPrompt, userPrompt);
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const suggestions = JSON.parse(cleanText);

    // Save interaction
    db.collection('ai_interactions').insert({
      user_id: userId,
      interaction_type: 'smart_reply',
      post_id: postId,
      ai_response: suggestions
    });

    return suggestions;
  } catch (error) {
    console.error('Smart Replies service error:', error);
    // Fallback options
    return [
      { text: "Great post! Thanks for sharing this.", tone: "friendly", emoji: "👍" },
      { text: "This is really interesting! Keen to learn more.", tone: "curious", emoji: "🤔" },
      { text: "Awesome work! Keep it up.", tone: "supportive", emoji: "🔥" }
    ];
  }
}
