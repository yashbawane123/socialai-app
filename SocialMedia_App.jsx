import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Search, Home, Bell, Mail, Bookmark, User, More, X, Sparkles, Send, Image as ImageIcon, AtSign } from 'lucide-react';

export default function SocialMediaApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: { name: 'Sarah Chen', handle: 'sarahchen', avatar: '👩‍💻', verified: true },
      timestamp: '2 hours ago',
      content: 'Just launched my new AI-powered productivity tool! The response has been amazing 🚀',
      image: null,
      likes: 1245,
      liked: false,
      comments: 89,
      shares: 234,
      aiSummary: 'Product launch announcement'
    },
    {
      id: 2,
      author: { name: 'Dev Daily', handle: 'devdaily', avatar: '🔧', verified: true },
      timestamp: '4 hours ago',
      content: 'The future of web development: No more JavaScript? 🤔\n\nWebAssembly is coming in hot',
      image: null,
      likes: 2541,
      liked: false,
      comments: 456,
      shares: 789,
      aiSummary: 'Tech discussion about WebAssembly'
    },
    {
      id: 3,
      author: { name: 'Alex Rivera', handle: 'alexrivera', avatar: '🎨', verified: false },
      timestamp: '6 hours ago',
      content: 'Finally finished my design system. 2 months of work but it was worth every second! 💪',
      image: null,
      likes: 892,
      liked: false,
      comments: 123,
      shares: 156,
      aiSummary: 'Design project completion'
    }
  ]);

  const [newPostContent, setNewPostContent] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [notifications, setNotifications] = useState(8);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([
    { type: 'trend', text: 'React 19 adoption is trending', emoji: '📈' },
    { type: 'safety', text: 'This post looks spam-like (85% confidence)', emoji: '⚠️' },
    { type: 'reply', text: 'Suggested reply: "That\'s amazing! How did you..."', emoji: '💬' }
  ]);

  const handleLike = (postId) => {
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handlePostCreate = () => {
    if (newPostContent.trim()) {
      const newPost = {
        id: posts.length + 1,
        author: { name: 'You', handle: 'yourhandle', avatar: '😊', verified: false },
        timestamp: 'now',
        content: newPostContent,
        image: null,
        likes: 0,
        liked: false,
        comments: 0,
        shares: 0,
        aiSummary: 'Your post'
      };
      setPosts([newPost, ...posts]);
      setNewPostContent('');
    }
  };

  const users = [
    { name: 'Emma Wilson', handle: 'emmawilson', avatar: '👩‍🔬', following: false, bio: 'Data Scientist' },
    { name: 'Marcus Lee', handle: 'marcuslee', avatar: '🎯', following: true, bio: 'Growth Hacker' },
    { name: 'Nina Patel', handle: 'ninapatel', avatar: '🎪', following: false, bio: 'Event Organizer' },
    { name: 'James Bond', handle: 'jamesbond', avatar: '🕵️', following: true, bio: 'Security Expert' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white font-sans">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <div className="w-64 border-r border-slate-700/50 bg-slate-900/50 backdrop-blur-xl flex flex-col">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              <Sparkles className="w-6 h-6 text-blue-400" />
              SocialAI
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {[
              { icon: Home, label: 'Home', id: 'home' },
              { icon: Search, label: 'Explore', id: 'explore' },
              { icon: Bell, label: 'Notifications', id: 'notifications', badge: notifications },
              { icon: Mail, label: 'Messages', id: 'messages' },
              { icon: Bookmark, label: 'Saved', id: 'saved' },
              { icon: User, label: 'Profile', id: 'profile' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-full font-semibold transition-all ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-xs px-2 py-1 rounded-full">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>

          <button className="w-11/12 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-8 rounded-full w-full transition-all transform hover:scale-105">
            Post
          </button>

          <div className="p-4 border-t border-slate-700/50 space-y-2">
            <div className="text-xs text-slate-500">Made with AI ✨</div>
            <div className="text-xs text-slate-600">© 2024 SocialAI Platform</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          <div className="flex-1 max-w-2xl border-r border-slate-700/50">
            {/* Header */}
            <div className="sticky top-0 backdrop-blur-xl bg-slate-900/50 border-b border-slate-700/50 px-6 py-4 z-20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {activeTab === 'home' && 'Home'}
                  {activeTab === 'notifications' && 'Notifications'}
                  {activeTab === 'messages' && 'Messages'}
                  {activeTab === 'profile' && 'Profile'}
                </h2>
                <button className="p-2 hover:bg-slate-800 rounded-full transition-all">
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>
            </div>

            {activeTab === 'home' && (
              <div>
                {/* Compose Post */}
                <div className="border-b border-slate-700/50 p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-lg">😊</div>
                    <div className="flex-1">
                      <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="What's happening?!"
                        className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-500 outline-none resize-none"
                        rows="3"
                      />
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-slate-800 rounded-full transition-all text-blue-400">
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button className="p-2 hover:bg-slate-800 rounded-full transition-all text-blue-400">
                            <AtSign className="w-5 h-5" />
                          </button>
                          <button className="p-2 hover:bg-slate-800 rounded-full transition-all text-blue-400">
                            <Sparkles className="w-5 h-5" />
                          </button>
                        </div>
                        <button
                          onClick={handlePostCreate}
                          disabled={!newPostContent.trim()}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-full transition-all transform hover:scale-105"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Posts Feed */}
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border-b border-slate-700/50 p-6 hover:bg-slate-800/30 transition-all cursor-pointer group"
                  >
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-lg flex-shrink-0">
                        {post.author.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold hover:underline">{post.author.name}</span>
                            {post.author.verified && <span className="text-blue-400">✓</span>}
                            <span className="text-slate-500">@{post.author.handle}</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-500">{post.timestamp}</span>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-500/10 rounded-full transition-all">
                            <More className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                        <p className="mt-2 text-base leading-normal text-white whitespace-pre-line">{post.content}</p>
                        
                        {post.aiSummary && (
                          <div className="mt-3 flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-xs">
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            <span className="text-slate-300">AI: {post.aiSummary}</span>
                          </div>
                        )}

                        <div className="mt-3 flex justify-between text-slate-500 text-sm max-w-md">
                          <button className="flex items-center gap-2 hover:text-blue-400 group/comment">
                            <div className="p-2 group-hover/comment:bg-blue-400/10 rounded-full transition-all">
                              <MessageCircle className="w-4 h-4" />
                            </div>
                            {post.comments}
                          </button>
                          <button className="flex items-center gap-2 hover:text-green-400 group/share">
                            <div className="p-2 group-hover/share:bg-green-400/10 rounded-full transition-all">
                              <Share2 className="w-4 h-4" />
                            </div>
                            {post.shares}
                          </button>
                          <button
                            onClick={() => handleLike(post.id)}
                            className="flex items-center gap-2 hover:text-red-400 group/like"
                          >
                            <div className="p-2 group-hover/like:bg-red-400/10 rounded-full transition-all">
                              <Heart
                                className="w-4 h-4"
                                fill={post.liked ? 'currentColor' : 'none'}
                                color={post.liked ? '#f91880' : 'currentColor'}
                              />
                            </div>
                            <span className={post.liked ? 'text-red-400' : ''}>{post.likes}</span>
                          </button>
                          <button className="flex items-center gap-2 hover:text-blue-400 group/share">
                            <div className="p-2 group-hover/share:bg-blue-400/10 rounded-full transition-all">
                              <Share2 className="w-4 h-4" />
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { type: 'like', user: 'Sarah Chen', action: 'liked your post', time: '2h ago' },
                    { type: 'follow', user: 'Alex Rivera', action: 'started following you', time: '4h ago' },
                    { type: 'comment', user: 'Dev Daily', action: 'commented on your post', time: '6h ago' }
                  ].map((notif, i) => (
                    <div key={i} className="flex gap-4 p-4 hover:bg-slate-800/30 rounded-lg transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                        {notif.type === 'like' && '❤️'}
                        {notif.type === 'follow' && '👤'}
                        {notif.type === 'comment' && '💬'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm"><span className="font-bold">{notif.user}</span> {notif.action}</p>
                        <p className="text-xs text-slate-500 mt-1">{notif.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Recommendations & Trending */}
          <div className="w-80 border-l border-slate-700/50 p-6 space-y-6 overflow-y-auto max-h-screen">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search users, posts..."
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-full text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {/* AI Agent Panel */}
            <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <Sparkles className="w-5 h-5 text-blue-400" />
                AI Agent Insights
              </div>
              {aiRecommendations.map((rec, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-lg">{rec.emoji}</span>
                  <span className="text-slate-300">{rec.text}</span>
                </div>
              ))}
            </div>

            {/* What's Happening */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-lg">What's Happening</h3>
              {[
                { tag: '#React19', tweets: '245K posts' },
                { tag: '#WebAssembly', tweets: '89K posts' },
                { tag: '#AI Trends', tweets: '567K posts' },
                { tag: '#DevTools', tweets: '123K posts' }
              ].map((trend, i) => (
                <div key={i} className="p-3 hover:bg-slate-700/30 rounded-lg cursor-pointer transition-all">
                  <div className="font-bold text-sm">{trend.tag}</div>
                  <div className="text-xs text-slate-500">{trend.tweets}</div>
                </div>
              ))}
            </div>

            {/* Suggested Users */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-lg">Suggested Users</h3>
              {users.map((user, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-700/30 rounded-lg transition-all">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-sm">
                      {user.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{user.name}</div>
                      <div className="text-xs text-slate-500">@{user.handle}</div>
                    </div>
                  </div>
                  <button className={`px-4 py-1 rounded-full font-bold text-sm transition-all ${
                    user.following
                      ? 'bg-slate-700 hover:bg-red-500/20 text-white'
                      : 'bg-white text-black hover:bg-slate-200'
                  }`}>
                    {user.following ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="text-xs text-slate-500 space-y-1 pt-4">
              <p>Terms · Privacy · Cookies</p>
              <p>SocialAI © 2024 with AI Agent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}