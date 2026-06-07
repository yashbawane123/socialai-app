import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageCircle, Heart, Bell, User, Flame, LogOut, Check, X, Play, Music, ImageIcon, Camera } from 'lucide-react';
import { AuthProvider, useAuth, API_BASE } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import Profile from './components/Profile';
import AIPanel from './components/AIPanel';
import Notifications from './components/Notifications';
import Post from './components/Post';
import Reels from './components/Reels';
import PoseCoachCamera from './components/PoseCoachCamera';


function SocialMediaAppContent() {
  const { user, token, loading, login, register, logout } = useAuth();
  const { socket, connected } = useSocket(token);

  // App Layout States
  const [showPoseCoach, setShowPoseCoach] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // home, explore, notifications, profile
  const [feedMode, setFeedMode] = useState('recommended'); // recommended (AI) vs latest (chronological)
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // Navigation & Detail States
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [refreshAiTrigger, setRefreshAiTrigger] = useState(0);
  const [aiInferredInterests, setAiInferredInterests] = useState(null);

  // Authentication Forms States
  const [authMode, setAuthMode] = useState('login'); // login vs register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('😊');
  const [authError, setAuthError] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeError, setComposeError] = useState(null);
  const [composeType, setComposeType] = useState('post'); // 'post' or 'reel'
  const [composeMusicName, setComposeMusicName] = useState('');
  const [composeThemeColor, setComposeThemeColor] = useState('from-blue-500 to-purple-600');
  const [refreshReelsTrigger, setRefreshReelsTrigger] = useState(0);
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [showComposeImageInput, setShowComposeImageInput] = useState(false);
  
  const composeFileInputRef = useRef(null);
  const [composeAttachedImage, setComposeAttachedImage] = useState(null);
  const [composeImageError, setComposeImageError] = useState(null);

  const composeReelVideoInputRef = useRef(null);
  const [composeReelVideo, setComposeReelVideo] = useState(null);
  const [composeReelVideoError, setComposeReelVideoError] = useState(null);

  const handleComposeReelVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setComposeReelVideoError("File is too large. Please select a video smaller than 15MB.");
      return;
    }

    setComposeReelVideoError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setComposeReelVideo(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleComposeFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setComposeImageError("File is too large. Please select a photo or video smaller than 15MB.");
      return;
    }

    setComposeImageError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setComposeAttachedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const PRESET_THEMES = [
    { name: 'Midnight Neon', value: 'from-blue-600 to-purple-900', preview: 'bg-gradient-to-br from-blue-600 to-purple-900' },
    { name: 'Sunset Glow', value: 'from-orange-500 to-red-600', preview: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { name: 'Cyberpunk Pulse', value: 'from-purple-600 to-pink-500', preview: 'bg-gradient-to-br from-purple-600 to-pink-500' },
    { name: 'Emerald Flow', value: 'from-emerald-500 to-teal-600', preview: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
    { name: 'Dark Noir', value: 'from-slate-800 to-slate-950', preview: 'bg-gradient-to-br from-slate-800 to-slate-950' }
  ];



  const handleReelCreate = async (caption, musicName, themeColor, video = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/posts/meta/reels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ caption, musicName, themeColor, video })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error, explanation: data.explanation };
      }
      
      // Successfully created reel!
      setShowComposeModal(false);
      setComposeText('');
      setComposeMusicName('');
      setComposeThemeColor('from-blue-500 to-purple-600');
      setComposeReelVideo(null);
      setComposeReelVideoError(null);
      if (composeReelVideoInputRef.current) composeReelVideoInputRef.current.value = '';
      setComposeType('post'); // Reset default
      setRefreshReelsTrigger(prev => prev + 1); // Remount & refetch Reels
      return data;
    } catch (err) {
      console.error("Reel creation error:", err);
      return { error: "Failed to connect to backend server." };
    }
  };

  // 1. Fetch Post Feeds
  const fetchPosts = async () => {
    if (!token) return;
    setLoadingPosts(true);
    try {
      const endpoint = feedMode === 'recommended' 
        ? `${API_BASE}/api/feed/recommended` 
        : `${API_BASE}/api/posts`;
        
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (feedMode === 'recommended') {
          setPosts(data.posts || []);
          setAiInferredInterests(data.recommendations || null);
        } else {
          setPosts(data.posts || data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load feed:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  // 2. Fetch Notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadNotifications(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  // Fetch data on session startups
  useEffect(() => {
    if (token) {
      fetchPosts();
      fetchNotifications();
    }
  }, [token, feedMode]);

  // Re-fetch posts on custom trigger updates
  const handleFollowChange = () => {
    setRefreshAiTrigger(prev => prev + 1);
    fetchPosts();
  };

  // 3. WebSocket Real-time binds
  useEffect(() => {
    if (!socket || !user) return;

    // Listen for new posts globally
    socket.on('post:new', (newPost) => {
      // Append if it's public feed and not already locally present
      setPosts(prev => {
        if (prev.some(p => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    });

    // Listen for post like increments
    socket.on('like:update', ({ postId, count }) => {
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, likes: count } : p
      ));
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(prev => ({ ...prev, likes: count }));
      }
    });

    // Listen for selective user notifications
    socket.on(`notification:${user.id}`, (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadNotifications(prev => prev + 1);
      
      // Play a tiny subtle modern notification sound if desired or toast alert
      console.log("🔔 Real-time alert:", notif.message);
    });

    return () => {
      socket.off('post:new');
      socket.off('like:update');
      socket.off(`notification:${user.id}`);
    };
  }, [socket, user, selectedPost]);

  // 4. API Operations
  const handleLikeToggle = async (postId) => {
    try {
      // Optimistic like toggle locally first for premium responsive UI feel
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const liked = !p.liked;
          return {
            ...p,
            liked,
            likes: liked ? p.likes + 1 : p.likes - 1
          };
        }
        return p;
      }));

      const res = await fetch(`${API_BASE}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Sync exact database values
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, liked: data.liked, likes: data.likesCount } : p
        ));
        setRefreshAiTrigger(prev => prev + 1); // Refresh safety score & interests
      }
    } catch (err) {
      console.error("Failed to toggle post like:", err);
    }
  };

  const handlePostCreate = async (text, images = []) => {
    try {
      const res = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: text, visibility: 'public', images })
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error, explanation: data.explanation };
      }
      
      // Always append the post locally to guarantee instant visual feedback for the author
      setPosts(prev => {
        if (prev.some(p => p.id === data.id)) return prev;
        return [data, ...prev];
      });
      
      setShowComposeModal(false);
      setComposeText('');
      setComposeImageUrl('');
      setComposeAttachedImage(null);
      setComposeImageError(null);
      setShowComposeImageInput(false);
      setRefreshAiTrigger(prev => prev + 1); // trigger AI update
      return data;
    } catch (err) {
      console.error("Post creation error:", err);
      return { error: "Failed to connect to backend server." };
    }
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
        setUnreadNotifications(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'login') {
        await login(email, password);
      } else {
        await register({
          username,
          email,
          password,
          fullName,
          bio,
          avatar
        });
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const navigateToProfile = (userId) => {
    setSelectedUserId(userId);
    setActiveTab('profile');
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 select-none">
        <div className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
          <Sparkles className="w-8 h-8 text-blue-400" />
          SocialAI
        </div>
        <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 w-1/2 rounded-full animate-[loading_1.5s_infinite_ease-in-out]"></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  // Not Logged In - Frosted glass Auth landing screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Spheres */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[120px] opacity-25 animate-pulse-slow"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[120px] opacity-25 animate-pulse-slow" style={{ animationDelay: '3s' }}></div>
        </div>

        {/* Auth form container */}
        <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/40 border border-slate-900 rounded-3xl backdrop-blur-2xl shadow-2xl space-y-6">
          <div className="flex flex-col items-center space-y-2 select-none">
            <div className="flex items-center gap-2 text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              <Sparkles className="w-8 h-8 text-blue-400" />
              SocialAI
            </div>
            <p className="text-xs text-slate-500 text-center">
              Enterprise Social Media backed by Dual-Mode AI Orchestration
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Username (Unique handle)</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Alphanumeric unique handle"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Bio Description</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short details about you"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Profile Emoji Avatar</label>
                  <div className="flex gap-2.5 select-none">
                    {['😊', '👩‍💻', '🔧', '🎨', '🎯', '👩‍🔬'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className={`w-10 h-10 text-lg rounded-xl border flex items-center justify-center transition-all ${
                          avatar === emoji ? 'border-blue-500 bg-blue-500/10 scale-105' : 'border-slate-900 hover:border-slate-800 bg-slate-950'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Security Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-400 leading-normal select-none">⚠️ {authError}</p>
            )}

            <button
              type="submit"
              className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-blue-500/15"
            >
              {authMode === 'login' ? 'Sign In' : 'Register Account'}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-900 select-none">
            {authMode === 'login' ? (
              <p>
                New to SocialAI?{' '}
                <button onClick={() => { setAuthMode('register'); setAuthError(null); }} className="text-blue-400 font-bold hover:underline">
                  Create account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button onClick={() => { setAuthMode('login'); setAuthError(null); }} className="text-blue-400 font-bold hover:underline">
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Logged In Shell Workspace Layout
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden relative">
      {/* Background Animated spheres */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full glow-sphere"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full glow-sphere" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="relative z-10 flex w-full h-screen overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'profile') setSelectedUserId(user.id);
          }}
          notificationsCount={unreadNotifications}
          onComposeClick={() => {
            setComposeType('post');
            setShowComposeModal(true);
          }}
        />

        {/* Middle Main Workspace Feed */}
        <div className="flex-1 flex flex-col h-full overflow-hidden max-w-2xl border-r border-slate-900">
          {/* Main timeline header */}
          {activeTab !== 'reels' && (
            <div className="sticky top-0 bg-slate-950/70 backdrop-blur-2xl border-b border-slate-900/60 p-6 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider select-none">
                {activeTab === 'home' && (feedMode === 'recommended' ? 'AI For You Feed' : 'Chronological Timeline')}
                {activeTab === 'explore' && 'Global Explores'}
                {activeTab === 'notifications' && 'Activity Logs'}
                {activeTab === 'profile' && 'Author Profiles'}
              </h2>

              {/* Toggle Feed mode for Home Feed */}
              {activeTab === 'home' && (
                <div className="flex bg-slate-900/60 p-0.5 rounded-full border border-slate-800/80 text-[10px] font-extrabold select-none">
                  <button
                    onClick={() => setFeedMode('recommended')}
                    className={`px-3 py-1.5 rounded-full transition-all duration-300 ${
                      feedMode === 'recommended' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    ✨ Recommended
                  </button>
                  <button
                    onClick={() => setFeedMode('latest')}
                    className={`px-3 py-1.5 rounded-full transition-all duration-300 ${
                      feedMode === 'latest' ? 'bg-slate-950 text-slate-300 border border-slate-800/50' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Latest
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Recommended Inferred explanation ticker */}
          {activeTab === 'home' && feedMode === 'recommended' && aiInferredInterests && (
            <div className="mx-6 mt-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-2xl p-3 text-[10px] text-slate-400 select-none leading-normal">
              💡 <strong>AI Interest Analytics:</strong> Claude inferred your interests are matching: {' '}
              <span className="text-blue-400 font-bold">{aiInferredInterests.recommendedCategories?.join(', ')}</span>.
              Personalizing feed timeline...
            </div>
          )}

          {/* Central Scrollable Feed container */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === 'home' && (
              <Feed
                posts={posts}
                onLikeToggle={handleLikeToggle}
                onPostCreate={handlePostCreate}
                onPostClick={(post) => setSelectedPost(post)}
                onPoseCoachClick={() => setShowPoseCoach(true)}
                socket={socket}
                activeTab={activeTab}
                onSearchProfile={navigateToProfile}
              />
            )}

            {activeTab === 'explore' && (
              <Feed
                posts={posts}
                onLikeToggle={handleLikeToggle}
                onPostClick={(post) => setSelectedPost(post)}
                onPoseCoachClick={() => setShowPoseCoach(true)}
                socket={socket}
                activeTab={activeTab}
                onSearchProfile={navigateToProfile}
              />
            )}

            {activeTab === 'reels' && (
              <Reels 
                key={refreshReelsTrigger}
                onCreateReelClick={() => {
                  setComposeType('reel');
                  setShowComposeModal(true);
                }}
                socket={socket}
              />
            )}

            {activeTab === 'notifications' && (
              <Notifications
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
              />
            )}

            {activeTab === 'profile' && (
              <Profile
                userId={selectedUserId}
                posts={posts}
                onFollowStatusChange={handleFollowChange}
                onPostClick={(post) => setSelectedPost(post)}
              />
            )}
          </div>
        </div>

        {/* Right AIPanel insights ticker */}
        <AIPanel
          refreshTrigger={refreshAiTrigger}
          onFollowChange={handleFollowChange}
        />

        {/* Modal: Write post dialog */}
        {showComposeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 select-none animate-fade-in">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-900/60 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-900/80 pb-3">
                <span className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
                  {composeType === 'post' ? 'Compose AI Post' : 'Craft Short Reel'}
                </span>
                <button
                  onClick={() => {
                    setShowComposeModal(false);
                    setComposeText('');
                    setComposeMusicName('');
                    setComposeError(null);
                    setComposeType('post');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Segmented control for Post vs Reel */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 text-[10px] font-extrabold select-none mb-2">
                <button
                  onClick={() => { setComposeType('post'); setComposeError(null); }}
                  className={`flex-1 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    composeType === 'post' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Text Post
                </button>
                <button
                  onClick={() => { setComposeType('reel'); setComposeError(null); }}
                  className={`flex-1 py-2 rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
                    composeType === 'reel' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Short Reel
                </button>
              </div>

              {composeType === 'post' ? (
                /* Text Post Fields */
                <div className="space-y-3">
                  <textarea
                    value={composeText}
                    onChange={(e) => { setComposeText(e.target.value); setComposeError(null); }}
                    placeholder="What's on your mind?..."
                    className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none resize-none font-medium leading-relaxed font-sans"
                    rows="4"
                  />
                  
                  {/* Hidden File Picker Input */}
                  <input
                    type="file"
                    ref={composeFileInputRef}
                    onChange={handleComposeFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                  />

                  {/* Photo/Image Preview Container */}
                  {composeAttachedImage && (
                    <div className="mt-3.5 relative rounded-2xl overflow-hidden border border-slate-800/80 max-h-60 bg-slate-950/40 w-max max-w-full group">
                      {composeAttachedImage.startsWith('data:video/') ? (
                        <video src={composeAttachedImage} controls className="max-h-60 object-contain rounded-2xl animate-fade-in" />
                      ) : (
                        <img src={composeAttachedImage} alt="Uploaded attachment preview" className="max-h-60 object-contain rounded-2xl animate-fade-in" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setComposeAttachedImage(null);
                          if (composeFileInputRef.current) composeFileInputRef.current.value = '';
                        }}
                        className="absolute top-2.5 right-2.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-800/60 p-1.5 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer shadow-xl"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {composeImageError && (
                    <div className="mt-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 select-none text-left leading-normal">
                      ⚠️ {composeImageError}
                    </div>
                  )}

                  {/* Action row container with toggle */}
                  <div className="flex items-center gap-2.5 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        composeFileInputRef.current.click();
                        setComposeImageError(null);
                      }}
                      className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full border w-max transition-all cursor-pointer ${
                        composeAttachedImage 
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' 
                          : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      {composeAttachedImage ? 'Change Photo/Video' : 'Add Photo/Video'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowComposeModal(false);
                        setShowPoseCoach(true);
                      }}
                      className="flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer w-max"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      AI Pose Coach
                    </button>
                  </div>
                </div>
              ) : (
                /* Short Reel Fields */
                <div className="space-y-4 text-left">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Reel Caption</label>
                    <textarea
                      value={composeText}
                      onChange={(e) => { setComposeText(e.target.value); setComposeError(null); }}
                      placeholder="Enter a catchy caption... #AILife #Refactoring"
                      className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none font-medium leading-relaxed font-sans"
                      rows="3"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Music className="w-3 h-3 text-blue-400" />
                      Audio Track Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={composeMusicName}
                      onChange={(e) => setComposeMusicName(e.target.value)}
                      placeholder="e.g. Chill Beats, Synthetic Waves (defaults to Original Audio)"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all text-slate-100"
                    />
                  </div>

                  {/* Hidden Reel Video input */}
                  <input
                    type="file"
                    ref={composeReelVideoInputRef}
                    onChange={handleComposeReelVideoChange}
                    accept="video/*"
                    className="hidden"
                  />

                  {/* Reel Video upload/preview option */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Reel Video Attachment (Optional)</label>
                    {composeReelVideo ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 max-h-40 bg-slate-950/40 w-max max-w-full group">
                        <video src={composeReelVideo} controls className="max-h-40 object-contain rounded-2xl" />
                        <button
                          type="button"
                          onClick={() => {
                            setComposeReelVideo(null);
                            if (composeReelVideoInputRef.current) composeReelVideoInputRef.current.value = '';
                          }}
                          className="absolute top-2 right-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-800/60 p-1 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer shadow-xl"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          composeReelVideoInputRef.current.click();
                          setComposeReelVideoError(null);
                        }}
                        className="flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300 transition-all cursor-pointer w-max"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Add Local Video
                      </button>
                    )}

                    {composeReelVideoError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                        ⚠️ {composeReelVideoError}
                      </div>
                    )}
                  </div>

                  {!composeReelVideo && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Visualizer Background Theme</label>
                      <div className="grid grid-cols-5 gap-2">
                        {PRESET_THEMES.map((theme) => (
                          <button
                            key={theme.name}
                            type="button; cursor-pointer"
                            onClick={() => setComposeThemeColor(theme.value)}
                            title={theme.name}
                            className={`h-11 rounded-xl relative overflow-hidden transition-all duration-300 border flex items-center justify-center cursor-pointer ${
                              composeThemeColor === theme.value
                                ? 'border-blue-400 scale-105 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                : 'border-slate-900 hover:border-slate-800 hover:scale-[1.02]'
                            }`}
                          >
                            <div className={`absolute inset-0 ${theme.preview}`} />
                            {composeThemeColor === theme.value && (
                              <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white font-bold" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {composeError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                  ⚠️ <strong>AI Content Policy:</strong> {composeError}
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-900">
                <button
                  onClick={async () => {
                    if (composeType === 'post') {
                      const imagesArray = composeAttachedImage ? [composeAttachedImage] : [];
                      const result = await handlePostCreate(composeText, imagesArray);
                      if (result && result.error) {
                        setComposeError(result.error + (result.explanation ? `: ${result.explanation}` : ''));
                      }
                    } else {
                      const result = await handleReelCreate(composeText, composeMusicName, composeThemeColor, composeReelVideo);
                      if (result && result.error) {
                        setComposeError(result.error + (result.explanation ? `: ${result.explanation}` : ''));
                      }
                    }
                  }}
                  disabled={composeType === 'post' ? (!composeText.trim() && !composeAttachedImage) : !composeText.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-2.5 px-6 rounded-full text-xs shadow-lg shadow-blue-500/15 cursor-pointer disabled:opacity-40 transition-all active:scale-95"
                >
                  {composeType === 'post' ? 'Broadcast Post' : 'Share Short Reel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Detailed post comments view */}
        {selectedPost && (
          <Post
            post={selectedPost}
            isDetailedView={true}
            onCloseDetail={() => setSelectedPost(null)}
            onLikeToggle={handleLikeToggle}
            socket={socket}
          />
        )}

        {/* Modal: AI Pose Coach Camera View */}
        {showPoseCoach && (
          <PoseCoachCamera
            onClose={() => setShowPoseCoach(false)}
            onPostCreate={handlePostCreate}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocialMediaAppContent />
    </AuthProvider>
  );
}
