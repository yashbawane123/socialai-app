import React, { useState, useRef } from 'react';
import { Sparkles, ImageIcon, AtSign, Search, Plus, X, Camera } from 'lucide-react';
import Post from './Post';
import { useAuth, API_BASE } from '../hooks/useAuth';

export default function Feed({ posts, onLikeToggle, onPostCreate, onPostClick, onPoseCoachClick, socket, activeTab, onSearchProfile }) {
  const { user } = useAuth();
  const [composeText, setComposeText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [moderationError, setModerationError] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  const fileInputRef = useRef(null);
  const [attachedImage, setAttachedImage] = useState(null); // stores data URL (image or video)
  const [imageError, setImageError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setImageError("File is too large. Please select a photo or video smaller than 15MB.");
      return;
    }

    setImageError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleComposeSubmit = async () => {
    if (!composeText.trim() && !attachedImage) return;
    setModerationError(null);
    setImageError(null);
    try {
      const imagesArray = attachedImage ? [attachedImage] : [];
      const result = await onPostCreate(composeText, imagesArray);
      if (result && result.error) {
        setModerationError(result.error + (result.explanation ? `: ${result.explanation}` : ''));
      } else {
        setComposeText('');
        setAttachedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setLoadingSearch(true);
    try {
      const token = localStorage.getItem('social_ai_token');
      const res = await fetch(`${API_BASE}/api/users/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error("Failed to query user search:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectUser = (userId) => {
    setSearchQuery('');
    setShowSearchResults(false);
    onSearchProfile(userId);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar Panel */}
      <div className="relative sticky top-0 bg-slate-950/70 backdrop-blur-2xl z-20 pb-2 border-b border-slate-900/60 pt-4 px-6 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search users on SocialAI..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
          />

          {/* Search Dropdown Panel */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-12 left-0 w-full bg-slate-950/95 border border-slate-900 rounded-2xl shadow-2xl p-2 z-50 divide-y divide-slate-900">
              {searchResults.map(result => (
                <div
                  key={result.id}
                  onClick={() => selectUser(result.id)}
                  className="flex items-center gap-3 p-2.5 hover:bg-slate-900/50 rounded-xl cursor-pointer transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-sm">
                    {result.profile_picture_url || '👤'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">{result.full_name || result.username}</div>
                    <div className="text-[10px] text-slate-500">@{result.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composition Block */}
      {activeTab === 'home' && (
        <div className="p-6 border-b border-slate-900/80 space-y-4">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-lg flex-shrink-0 select-none">
              {user?.profile_picture_url || '😊'}
            </div>
            <div className="flex-1">
              <textarea
                value={composeText}
                onChange={(e) => {
                  setComposeText(e.target.value);
                  setModerationError(null);
                }}
                placeholder="What's happening?!"
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none resize-none font-medium leading-relaxed"
                rows="3.5"
              />

              {/* Hidden File Picker Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />

              {/* Photo/Image Preview Container */}
              {attachedImage && (
                <div className="mt-3.5 relative rounded-2xl overflow-hidden border border-slate-800/80 max-h-60 bg-slate-950/40 w-max max-w-full group">
                  {attachedImage.startsWith('data:video/') ? (
                    <video src={attachedImage} controls className="max-h-60 object-contain rounded-2xl animate-fade-in" />
                  ) : (
                    <img src={attachedImage} alt="Uploaded attachment preview" className="max-h-60 object-contain rounded-2xl animate-fade-in" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2.5 right-2.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-800/60 p-1.5 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer shadow-xl"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {imageError && (
                <div className="mt-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 select-none leading-normal">
                  ⚠️ {imageError}
                </div>
              )}

              {moderationError && (
                <div className="mt-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 select-none leading-normal">
                  ⚠️ <strong>AI Content Policy Violation:</strong> {moderationError}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-1.5 select-none">
                  <button 
                    type="button"
                    onClick={() => {
                      fileInputRef.current.click();
                      setImageError(null);
                    }}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      attachedImage ? 'text-blue-400 bg-blue-500/10' : 'text-blue-400 hover:bg-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-4.5 h-4.5" />
                  </button>
                  <button type="button" className="p-2 text-blue-400 hover:bg-slate-900 rounded-full transition-all">
                    <AtSign className="w-4.5 h-4.5" />
                  </button>
                  <button type="button" className="p-2 text-blue-400 hover:bg-slate-900 rounded-full transition-all">
                    <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                  </button>
                  <button 
                    type="button" 
                    onClick={onPoseCoachClick}
                    className="p-2 text-emerald-400 hover:bg-slate-900 rounded-full transition-all"
                    title="AI Pose Coach Camera"
                  >
                    <Camera className="w-4.5 h-4.5" />
                  </button>
                </div>
                <button
                  onClick={handleComposeSubmit}
                  disabled={!composeText.trim() && !attachedImage}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 text-white font-bold py-2.5 px-6 rounded-full transition-all duration-300 transform active:scale-95 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed listing */}
      <div className="divide-y divide-slate-900/80">
        {posts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3 select-none">
            <span className="text-4xl">📬</span>
            <p className="text-sm font-semibold">Your feed is currently empty.</p>
            <p className="text-xs text-slate-600">Follow suggested creators to see updates appear here!</p>
          </div>
        ) : (
          posts.map(post => (
            <Post
              key={post.id}
              post={post}
              onLikeToggle={onLikeToggle}
              onPostClick={onPostClick}
              socket={socket}
            />
          ))
        )}
      </div>
    </div>
  );
}
