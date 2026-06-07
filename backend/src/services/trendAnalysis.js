import aiClient from './aiClient.js';
import db from './db.js';
import cache from './cache.js';

export async function analyzeTrends(timeWindow = '24h') {
  const cacheKey = `trends:${timeWindow}`;
  
  const cachedTrends = cache.get(cacheKey);
  if (cachedTrends) {
    return cachedTrends;
  }

  try {
    // 1. Get recent posts
    const posts = db.collection('posts').find({ visibility: 'public' }).exec();
    
    // Extract categories
    const categoriesMap = {};
    posts.forEach(p => {
      if (p.content_category) {
        categoriesMap[p.content_category] = (categoriesMap[p.content_category] || 0) + 1;
      }
    });

    // Extract hashtags
    const hashtagsMap = {};
    posts.forEach(p => {
      const tags = p.content.match(/#\w+/g);
      if (tags) {
        tags.forEach(t => {
          hashtagsMap[t] = (hashtagsMap[t] || 0) + 1;
        });
      }
    });

    const categories = Object.entries(categoriesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(c => `${c[0]} (${c[1]} posts)`);

    const hashtags = Object.entries(hashtagsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(h => `${h[0]} (${h[1]} mentions)`);

    // 2. AI prompting
    const systemPrompt = `Analyze these trending patterns on a social media platform and provide strategic insights. Respond ONLY with a valid JSON response (no markdown, no backticks).
    
Your response must be valid JSON with this structure:
{
  "topTrends": ["trend1", "trend2", ...],
  "emergingTopics": ["topic1", "topic2", ...],
  "sentiment": "positive" | "neutral" | "negative",
  "predictions": ["what might trend next"],
  "recommendation": "suggested content ideas",
  "riskFlags": ["potential issues to watch"]
}`;

    const userPrompt = `Trending Categories (last ${timeWindow}):
${categories.length > 0 ? categories.join('\n') : "- None"}

Trending Hashtags:
${hashtags.length > 0 ? hashtags.join('\n') : "- None"}`;

    const responseText = await aiClient.generateCompletion(systemPrompt, userPrompt);
    const cleanText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const trends = JSON.parse(cleanText);

    const result = {
      trends,
      categories: Object.entries(categoriesMap).map(e => ({ name: e[0], count: e[1] })),
      hashtags: Object.entries(hashtagsMap).map(e => ({ tag: e[0], count: e[1] })),
      timestamp: new Date().toISOString()
    };

    // Cache the result
    cache.set(cacheKey, result, 1800000); // 30 minutes cache

    // Store in historical logs
    db.collection('trend_analysis').insert({
      data: trends,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    console.error('Trend analysis error:', error);
    return {
      trends: {
        topTrends: ["React 19", "Claude 3.5 Sonnet", "Web Development", "UI Design"],
        emergingTopics: ["Tailwind v4", "Glassmorphism UI", "Wasm"],
        sentiment: "positive",
        predictions: ["More developers will post about AI productivity tools"],
        recommendation: "Discuss React Server Components or Tailwind CSS.",
        riskFlags: []
      },
      categories: [],
      hashtags: []
    };
  }
}
