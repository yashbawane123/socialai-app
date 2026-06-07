import bcrypt from 'bcryptjs';
import db from '../services/db.js';

async function runSeed() {
  console.log('🌱 Seeding SocialAI Database...');
  
  // Clear previous data
  db.reset();
  
  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  
  // 1. Create Core Users
  const user1 = db.collection('users').insert({
    username: 'sarahchen',
    email: 'sarah@socialai.com',
    password_hash: defaultPasswordHash,
    full_name: 'Sarah Chen',
    bio: 'Software engineer and startup founder. Building the future of AI productivity tools. 👩‍💻✨',
    profile_picture_url: '👩‍💻',
    is_verified: true,
    is_public: true
  });

  const user2 = db.collection('users').insert({
    username: 'devdaily',
    email: 'devdaily@socialai.com',
    password_hash: defaultPasswordHash,
    full_name: 'Dev Daily',
    bio: 'Your daily dose of tech stack updates, web engineering blogs, and developer tools. 🔧💻',
    profile_picture_url: '🔧',
    is_verified: true,
    is_public: true
  });

  const user3 = db.collection('users').insert({
    username: 'alexrivera',
    email: 'alex@socialai.com',
    password_hash: defaultPasswordHash,
    full_name: 'Alex Rivera',
    bio: 'UI/UX Lead designer. Passionate about glassmorphism, visual hierarchies, and sleek design systems. 🎨🌈',
    profile_picture_url: '🎨',
    is_verified: false,
    is_public: true
  });

  const user4 = db.collection('users').insert({
    username: 'marcuslee',
    email: 'marcus@socialai.com',
    password_hash: defaultPasswordHash,
    full_name: 'Marcus Lee',
    bio: 'Growth Hacker & B2B networking strategist. Scaling SaaS products to $10M+ ARR. 🎯🔥',
    profile_picture_url: '🎯',
    is_verified: true,
    is_public: true
  });

  const user5 = db.collection('users').insert({
    username: 'emmawilson',
    email: 'emma@socialai.com',
    password_hash: defaultPasswordHash,
    full_name: 'Emma Wilson',
    bio: 'Data Scientist. Researching neural models, LLM prompts, and hybrid collaborative filters. 👩‍🔬📊',
    profile_picture_url: '👩‍🔬',
    is_verified: false,
    is_public: true
  });

  // 2. Create Core Follow Relationships
  db.collection('follows').insert({ follower_id: user1.id, following_id: user2.id });
  db.collection('follows').insert({ follower_id: user1.id, following_id: user3.id });
  db.collection('follows').insert({ follower_id: user2.id, following_id: user1.id });
  db.collection('follows').insert({ follower_id: user3.id, following_id: user1.id });
  db.collection('follows').insert({ follower_id: user4.id, following_id: user1.id });
  db.collection('follows').insert({ follower_id: user5.id, following_id: user1.id });

  // 3. Create Seed Posts
  const post1 = db.collection('posts').insert({
    user_id: user1.id,
    content: 'Just launched my new AI-powered productivity tool! The response has been amazing 🚀 Check it out and let me know your thoughts on our layout!',
    image_urls: [],
    visibility: 'public',
    likes_count: 0,
    comments_count: 0,
    shares_count: 14,
    content_category: 'Product Launch',
    ai_generated_summary: 'Product launch announcement',
    is_flagged: false,
    created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
  });

  const post2 = db.collection('posts').insert({
    user_id: user2.id,
    content: 'The future of web development: No more JavaScript? 🤔 WebAssembly is coming in hot, powered by Rust compiling directly to fast CPU instructions. What are your plans for Wasm adoption?',
    image_urls: [],
    visibility: 'public',
    likes_count: 0,
    comments_count: 0,
    shares_count: 48,
    content_category: 'Software Engineering',
    ai_generated_summary: 'Tech discussion about WebAssembly',
    is_flagged: false,
    created_at: new Date(Date.now() - 14400000).toISOString() // 4 hours ago
  });

  const post3 = db.collection('posts').insert({
    user_id: user3.id,
    content: 'Finally finished my design system. 2 months of work but it was worth every second! Supporting dynamic dark modes, sleek neon gradient highlights, and a clean glassmorphism theme. 💅🎨 #DesignSystem #WebDesign',
    image_urls: [],
    visibility: 'public',
    likes_count: 0,
    comments_count: 0,
    shares_count: 8,
    content_category: 'UI/UX Design',
    ai_generated_summary: 'Design project completion',
    is_flagged: false,
    created_at: new Date(Date.now() - 21600000).toISOString() // 6 hours ago
  });

  // 4. Create Interactivity (Likes & Comments)
  // Likes on Post 1
  db.collection('likes').insert({ user_id: user2.id, post_id: post1.id });
  db.collection('likes').insert({ user_id: user3.id, post_id: post1.id });
  db.collection('likes').insert({ user_id: user4.id, post_id: post1.id });

  // Likes on Post 2
  db.collection('likes').insert({ user_id: user1.id, post_id: post2.id });
  db.collection('likes').insert({ user_id: user5.id, post_id: post2.id });

  // Comments on Post 1
  db.collection('comments').insert({
    post_id: post1.id,
    user_id: user2.id,
    content: 'This looks incredibly clean Sarah! What UI framework did you use for the cards?',
    created_at: new Date(Date.now() - 5400000).toISOString()
  });

  db.collection('comments').insert({
    post_id: post1.id,
    user_id: user3.id,
    content: 'Love the layout! The glassmorphism borders and glowing animations are state of the art.',
    created_at: new Date(Date.now() - 3600000).toISOString()
  });

  // Comments on Post 2
  db.collection('comments').insert({
    post_id: post2.id,
    user_id: user1.id,
    content: 'Interesting! I think JS will still be the wrapper, but heavy computations will definitely move to Wasm compiles.',
    created_at: new Date(Date.now() - 10800000).toISOString()
  });

  // 5. Create Seed Reels
  db.collection('reels').insert({
    user_id: user1.id,
    caption: 'Refactoring my AI agent workspace at 2 AM... ☕💻 #DevLife #Coding #AIAgent',
    likes_count: 324,
    comments_count: 58,
    music_name: 'Sarah Chen • Original Audio',
    theme_color: 'from-blue-500 to-purple-600'
  });

  db.collection('reels').insert({
    user_id: user2.id,
    caption: 'Why WebAssembly compiles are 10x faster than traditional JS... ⚙️🔥 #Rust #Wasm #WebDev',
    likes_count: 852,
    comments_count: 142,
    music_name: 'Dev Daily • Coding Beats',
    theme_color: 'from-purple-600 to-pink-500'
  });

  db.collection('reels').insert({
    user_id: user3.id,
    caption: 'Behind the scenes: Crafting the perfect glassmorphic glowing border in Tailwind CSS 🎨✨ #UIUX #DesignSystem #WebDesign',
    likes_count: 489,
    comments_count: 73,
    music_name: 'Alex Rivera • Synthwave Loop',
    theme_color: 'from-pink-500 to-blue-500'
  });

  console.log('✅ Database seeded successfully with 5 users, 3 posts, and interactive relations!');
}

runSeed().catch(console.error);
