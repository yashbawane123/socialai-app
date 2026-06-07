import aiClient from './aiClient.js';
import db from './db.js';

export async function moderateContent(content, userId, contentType = 'post') {
  try {
    const systemPrompt = `You are a content moderation AI for a social media platform. Analyze the provided content and respond ONLY with valid JSON (no markdown, no code blocks).

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
- Doxxing and privacy violations`;

    const userPrompt = `Please moderate this ${contentType}:\n\n"${content}"`;
    const responseText = await aiClient.generateCompletion(systemPrompt, userPrompt);
    
    // Clean up markdown wrapping if any
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    
    const result = JSON.parse(cleanText);

    // Save this AI interaction log
    db.collection('ai_interactions').insert({
      user_id: userId,
      interaction_type: 'moderation',
      ai_response: result
    });

    // If content is not safe, insert into content_flags for admin view
    if (!result.isSafe && result.suggestedAction !== 'allow') {
      db.collection('content_flags').insert({
        user_id: userId,
        content_type: contentType,
        content_preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        violation_type: result.categories.join(', ') || 'Policy Violation',
        severity: result.severity,
        status: 'pending_review',
        ai_details: result
      });
    }

    return result;
  } catch (error) {
    console.error('Content moderation engine error:', error);
    // Fail-safe mode
    return {
      isSafe: true,
      violations: [],
      severity: 'low',
      confidence: 1.0,
      categories: [],
      suggestedAction: 'allow',
      explanation: 'Content moderation engine experienced an issue, defaulting to safe.'
    };
  }
}
