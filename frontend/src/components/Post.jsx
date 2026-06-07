import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Sparkles, Send, X } from 'lucide-react';
import { useAuth, API_BASE } from '../hooks/useAuth';

export default function Post({ post, onLikeToggle, onPostClick, socket, isDetailedView = false, onCloseDetail }) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  
  const typingTimeoutRef = useRef(null);

  // Load comments and smart replies on detailed modal expansion
  useEffect(() => {
    if (!isDetailedView || !token) return;

    const fetchCommentsAndReplies = async () => {
      setLoadingComments(true);
      try {
        // Fetch Comments
        const res = await fetch(`${API_BASE}/api/posts/${post.id}/comments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const commentsData = await res.json();
          setComments(commentsData);
        }

        // Fetch AI Smart Replies
        setLoadingReplies(true);
        const replyRes = await fetch(`${API_BASE}/api/ai/smart-replies/${post.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (replyRes.ok) {
          const repliesData = await replyRes.json();
          setSmartReplies(repliesData);
        }
      } catch (err) {
        console.error("Failed to load comment feed:", err);
      } finally {
        setLoadingComments(false);
        setLoadingReplies(false);
      }
    };

    fetchCommentsAndReplies();

    // Join room for real-time updates of this post
    if (socket) {
      socket.emit('join:post', post.id);

      // Listen for incoming comments
      socket.on(`comment:new:${post.id}`, (comment) => {
        setComments(prev => [...prev, comment]);
      });

      // Listen for typing indicators
      socket.on('typing:status', ({ postId, username, isTyping }) => {
        if (postId === post.id && username !== user?.username) {
          setTypingUser(isTyping ? username : null);
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave:post', post.id);
        socket.off(`comment:new:${post.id}`);
        socket.off('typing:status');
      }
    };
  }, [isDetailedView, post.id, token, socket, user?.username]);

  // Handle typing status broadcast
  const handleCommentChange = (e) => {
    setNewComment(e.target.value);
    
    if (socket && user) {
      socket.emit('typing:start', { postId: post.id, username: user.username });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { postId: post.id, username: user.username });
      }, 1500);
    }
  };

  const handlePostComment = async (commentText) => {
    const textToSend = commentText || newComment;
    if (!textToSend.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: textToSend })
      });
      if (res.ok) {
        const comment = await res.json();
        // Socket broadcast automatically appends the comment for us if connected. 
        // If not connected, we append it manually.
        if (!socket) {
          setComments(prev => [...prev, comment]);
        }
        setNewComment('');
        if (socket && user) {
          socket.emit('typing:stop', { postId: post.id, username: user.username });
        }
      }
    } catch (err) {
      console.error("Failed to upload comment:", err);
    }
  };

  const applySmartReply = (text) => {
    handlePostComment(text);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    onLikeToggle(post.id);
  };

  const isVideoFile = (url) => {
    if (!url) return false;
    if (url.startsWith('data:video/')) return true;
    const cleanUrl = url.split(/[#?]/)[0];
    const ext = cleanUrl.split('.').pop().trim().toLowerCase();
    return ['mp4', 'webm', 'ogg', 'mov', 'quicktime'].includes(ext) || cleanUrl.includes('video-');
  };

  // Populate formatted post timestamp
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins <= 0 ? 'just now' : `${diffMins}m ago`;
      }
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'some time ago';
    }
  };

  // Card view layout
  if (!isDetailedView) {
    return (
      <div
        onClick={() => onPostClick(post)}
        className="p-6 border-b border-slate-900/80 hover:bg-slate-900/10 transition-all duration-300 cursor-pointer group"
      >
        <div className="flex gap-4">
          {/* Avatar sphere */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-lg flex-shrink-0 select-none">
            {post.author?.avatar || '👤'}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header info */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-slate-200 truncate hover:underline">{post.author?.name}</span>
                {post.author?.verified && <span className="text-blue-400 flex-shrink-0">✓</span>}
                <span className="text-slate-500 truncate">@{post.author?.handle}</span>
                <span className="text-slate-600 flex-shrink-0">·</span>
                <span className="text-slate-500 flex-shrink-0">{formatTime(post.created_at)}</span>
              </div>
            </div>

            {/* Post text */}
            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed whitespace-pre-line select-text">
              {post.content}
            </p>

            {/* Post attachment (photo or video) */}
            {post.image_urls && post.image_urls.length > 0 && (
              <div className="mt-3.5 rounded-2xl overflow-hidden border border-slate-900/60 max-h-80 bg-slate-950/40 relative">
                {isVideoFile(post.image_urls[0]) ? (
                  <video 
                    src={post.image_urls[0]} 
                    controls 
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-full object-cover max-h-80" 
                    preload="metadata"
                  />
                ) : (
                  <img 
                    src={post.image_urls[0]} 
                    alt="Post attachment" 
                    className="w-full h-full object-cover max-h-80 transform hover:scale-[1.01] transition-transform duration-500" 
                    loading="lazy"
                  />
                )}
              </div>
            )}

            {/* Category tag */}
            {post.content_category && (
              <span className="inline-flex mt-3.5 items-center gap-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/10 hover:border-blue-500/20 text-[10px] text-blue-400 font-extrabold px-2.5 py-0.5 rounded-full select-none">
                {post.content_category}
              </span>
            )}

            {/* AI summaries */}
            {post.ai_generated_summary && (
              <div className="mt-3 flex items-center gap-2 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl px-3.5 py-2 text-[10px] select-none">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400 font-medium truncate">AI Summary: {post.ai_generated_summary}</span>
              </div>
            )}

            {/* Actions counter footer */}
            <div className="mt-4 flex justify-between text-slate-500 text-xs max-w-sm select-none">
              {/* Comment trigger */}
              <button className="flex items-center gap-1.5 hover:text-blue-400 group/comment transition-colors duration-200">
                <div className="p-2 group-hover/comment:bg-blue-500/10 rounded-full">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span>{post.comments || 0}</span>
              </button>

              {/* Like trigger */}
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 group/like transition-colors duration-200 ${
                  post.liked ? 'text-red-500' : 'hover:text-red-500'
                }`}
              >
                <div className={`p-2 rounded-full ${post.liked ? 'bg-red-500/10' : 'group-hover/like:bg-red-500/10'}`}>
                  <Heart
                    className={`w-4 h-4 transition-transform duration-200 group-active/like:scale-125 ${
                      post.liked ? 'fill-red-500' : 'none'
                    }`}
                  />
                </div>
                <span className={post.liked ? 'font-semibold' : ''}>{post.likes || 0}</span>
              </button>

              {/* Share button */}
              <button className="flex items-center gap-1.5 hover:text-green-400 group/share transition-colors duration-200">
                <div className="p-2 group-hover/share:bg-green-400/10 rounded-full">
                  <Share2 className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detailed Modal detailed view layout
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-950/90 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center gap-2 font-bold text-xs text-blue-400">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
            Post Conversations
          </div>
          <button
            onClick={onCloseDetail}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-full transition-all"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Scroll area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main post description */}
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-xl flex-shrink-0 select-none">
              {post.author?.avatar}
            </div>
            <div className="flex-1">
              <div className="text-xs">
                <span className="font-extrabold text-slate-200">{post.author?.name}</span>
                <span className="text-slate-500 block">@{post.author?.handle}</span>
              </div>
              <p className="mt-3 text-base text-slate-200 leading-relaxed whitespace-pre-line select-text">
                {post.content}
              </p>
              {post.image_urls && post.image_urls.length > 0 && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-slate-900/60 max-h-[400px] bg-slate-950/40 relative">
                  {isVideoFile(post.image_urls[0]) ? (
                    <video 
                      src={post.image_urls[0]} 
                      controls 
                      className="w-full h-full object-cover max-h-[400px]" 
                      preload="metadata"
                    />
                  ) : (
                    <img 
                      src={post.image_urls[0]} 
                      alt="Post attachment" 
                      className="w-full h-full object-cover max-h-[400px]" 
                      loading="lazy"
                    />
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mt-4 text-[10px] text-slate-500">
                <span>{new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>·</span>
                <span>{new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {post.content_category && (
                  <>
                    <span>·</span>
                    <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">
                      {post.content_category}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* AI Smart Replies Suggestions Section */}
          {!loadingReplies && smartReplies.length > 0 && (
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/15 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 select-none">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Smart Reply suggestions:
              </div>
              <div className="flex flex-wrap gap-2">
                {smartReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => applySmartReply(reply.text)}
                    className="text-left text-xs bg-slate-950 border border-slate-900 hover:border-blue-500/50 hover:bg-blue-500/5 px-3 py-2 rounded-xl text-slate-300 hover:text-white transition-all duration-300 flex items-center gap-2"
                  >
                    <span>{reply.emoji}</span>
                    <span>{reply.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment list divider */}
          <div className="border-t border-slate-900/80 pt-4 space-y-4">
            <h4 className="font-extrabold text-xs text-slate-400">Discussion Feed</h4>
            
            {loadingComments ? (
              <div className="py-8 text-center text-slate-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 italic">No comments yet. Start the conversation!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comm) => (
                  <div key={comm.id} className="flex gap-3 text-xs bg-slate-900/10 p-3 rounded-2xl border border-slate-900/40">
                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-sm flex-shrink-0">
                      {comm.author?.avatar || '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-200">{comm.author?.name}</span>
                        <span className="text-slate-500">@{comm.author?.handle}</span>
                      </div>
                      <p className="mt-1 text-slate-300 leading-normal whitespace-pre-line">{comm.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Comment Composition panel */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/70 backdrop-blur-md">
          {typingUser && (
            <p className="text-[10px] text-blue-400 mb-1.5 animate-pulse">
              💬 {typingUser} is typing...
            </p>
          )}

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newComment}
              onChange={handleCommentChange}
              onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
              placeholder="Post your reply..."
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            <button
              onClick={() => handlePostComment()}
              disabled={!newComment.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 p-2.5 rounded-full text-white transition-all transform active:scale-95 flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
