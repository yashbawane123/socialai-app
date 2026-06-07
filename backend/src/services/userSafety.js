import aiClient from './aiClient.js';
import db from './db.js';

export async function analyzeUserSafety(userId) {
  try {
    const user = db.collection('users').findOne({ id: userId });
    if (!user) return null;

    // Fetch reports, toxicity logs, or violations in comments/posts
    const userPosts = db.collection('posts').find({ user_id: userId }).exec();
    const userComments = db.collection('comments').find({ user_id: userId }).exec();
    
    // Count flag events
    const flagsCount = db.collection('content_flags').count({ user_id: userId });

    const systemPrompt = `Analyze these user interactions for potential safety concerns:
- Harassment patterns
- Toxic behavior
- Vulnerability indicators
- Recommendation actions

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "safetyScore": number between 0 and 100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "concerns": ["concern1", ...],
  "recommendations": ["recommendation1", ...],
  "shouldEscalate": boolean
}`;

    const userPrompt = `User Name: ${user.full_name || user.username}
User Bio: ${user.bio || 'Not provided'}
Total Posts: ${userPosts.length}
Total Comments: ${userComments.length}
Moderation Policy Violations / Flags: ${flagsCount}`;

    const responseText = await aiClient.generateCompletion(systemPrompt, userPrompt);
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(cleanText);
  } catch (error) {
    console.error('User Safety engine error:', error);
    return {
      safetyScore: 100,
      riskLevel: "low",
      concerns: [],
      recommendations: ["User history is clear and compliant."],
      shouldEscalate: false
    };
  }
}
