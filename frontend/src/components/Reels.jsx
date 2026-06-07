import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Music, Play, Pause, CheckCircle2 } from 'lucide-react';
import { useAuth, API_BASE } from '../hooks/useAuth';

// Reactive subcomponent to play/pause Reel video files dynamically
function ReelVideo({ src, isPlaying }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(err => console.log("Reel video autoplay blocked:", err));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      preload="metadata"
    />
  );
}

export default function Reels({ onCreateReelClick, socket }) {
  const { token } = useAuth();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const fetchReels = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/posts/meta/reels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReels(data);
        if (data.length > 0) setPlayingId(data[0].id); // Auto play first reel
      }
    } catch (err) {
      console.error("Failed to load reels feed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const handleNewReel = (newReel) => {
      setReels(prev => {
        if (prev.some(r => r.id === newReel.id)) return prev;
        return [newReel, ...prev];
      });
    };

    socket.on('reel:new', handleNewReel);

    return () => {
      socket.off('reel:new', handleNewReel);
    };
  }, [socket]);

  const handleLike = async (reelId, e) => {
    e.stopPropagation();
    try {
      // Optimistic toggle locally first
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const liked = !r.liked;
          return {
            ...r,
            liked,
            likes_count: liked ? r.likes_count + 1 : r.likes_count - 1
          };
        }
        return r;
      }));

      const res = await fetch(`${API_BASE}/api/posts/meta/reels/${reelId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Sync exact backend counts
        setReels(prev => prev.map(r =>
          r.id === reelId ? { ...r, liked: data.liked, likes_count: data.likesCount } : r
        ));
      }
    } catch (error) {
      console.error("Reel like toggle failed:", error);
    }
  };

  const togglePlay = (reelId) => {
    setPlayingId(prev => prev === reelId ? null : reelId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-2 py-4 h-[85vh] flex flex-col min-h-0 select-none">
      {/* Sleek Reels Header */}
      <div className="flex justify-between items-center mb-6 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg animate-bounce">🎬</span>
          <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-wider">
            Short Reels
          </span>
        </div>
        <button
          onClick={onCreateReelClick}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-xs font-bold py-2.5 px-4 rounded-full flex items-center gap-1.5 transition-all transform active:scale-95 shadow-md shadow-blue-500/10 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Create Reel
        </button>
      </div>

      {reels.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-3 bg-slate-900/20 border border-slate-900 rounded-3xl backdrop-blur-xl flex-1 flex flex-col items-center justify-center">
          <span className="text-4xl">🎬</span>
          <p className="text-sm font-semibold text-slate-400">No reels available.</p>
          <p className="text-xs text-slate-600">Be the first to post a custom Reel!</p>
        </div>
      ) : (
        /* Snap-scrolling vertical list */
        <div className="flex-1 overflow-y-auto space-y-10 snap-y snap-mandatory scroll-smooth pb-12 pr-1 scrollbar-thin">
          {reels.map((reel) => {
            const isPlaying = playingId === reel.id;
            
            return (
              <div
                key={reel.id}
                onClick={() => togglePlay(reel.id)}
                className="snap-start relative w-full h-[600px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col group select-none cursor-pointer transform hover:scale-[1.01] transition-all duration-300 flex-shrink-0 mb-6"
              >
                {/* Visualizer Background or Real Video */}
                {reel.video_url ? (
                  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
                    <ReelVideo src={reel.video_url} isPlaying={isPlaying} />
                    {/* Action Pause/Play overlay */}
                    {!isPlaying && (
                      <div className="absolute bg-slate-950/60 p-5 rounded-full border border-white/10 shadow-2xl scale-95 group-hover:scale-100 transition-all duration-300 z-10">
                        <Play className="w-8 h-8 text-white fill-white translate-x-0.5" />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Visualizer Video Simulation Background */
                  <div className={`absolute inset-0 bg-gradient-to-br ${reel.theme_color || 'from-slate-900 to-slate-950'} transition-all duration-1000 flex items-center justify-center overflow-hidden`}>
                    {/* Dynamic canvas waves simulation */}
                    <div className="absolute inset-0 opacity-30 flex items-center justify-center">
                      <div className={`w-80 h-80 rounded-full border-4 border-dashed border-white/10 ${isPlaying ? 'animate-[spin_40s_linear_infinite]' : ''}`} />
                      <div className={`absolute w-60 h-60 rounded-full border-4 border-dashed border-white/5 ${isPlaying ? 'animate-[spin_30s_linear_infinite]' : ''}`} style={{ animationDirection: 'reverse' }} />
                    </div>

                    {/* Glowing visualizer beams pulsing with play state */}
                    <div className="flex items-end gap-1.5 h-32 select-none pointer-events-none">
                      {[4, 10, 8, 12, 6, 14, 9, 15, 7, 11, 5, 13, 8, 10, 4].map((h, i) => (
                        <div
                          key={i}
                          className={`w-1.5 bg-white/40 rounded-full transition-all duration-300 ${
                            isPlaying ? 'animate-pulse' : 'h-2'
                          }`}
                          style={{
                            height: isPlaying ? `${h * 6}px` : '8px',
                            animationDelay: `${i * 0.1}s`,
                            animationDuration: '0.6s'
                          }}
                        />
                      ))}
                    </div>

                    {/* Action Pause/Play overlay */}
                    {!isPlaying && (
                      <div className="absolute bg-slate-950/60 p-5 rounded-full border border-white/10 shadow-2xl scale-95 group-hover:scale-100 transition-all duration-300">
                        <Play className="w-8 h-8 text-white fill-white translate-x-0.5" />
                      </div>
                    )}
                  </div>
                )}

                {/* Smartphone layout overlay borders */}
                <div className="absolute inset-0 border-[6px] border-slate-950/40 rounded-3xl pointer-events-none" />

                {/* Right side floating button overlays */}
                <div className="absolute right-4 bottom-20 z-20 flex flex-col items-center gap-5 select-none">
                  {/* Like */}
                  <button
                    onClick={(e) => handleLike(reel.id, e)}
                    className={`p-3 bg-slate-950/45 border border-white/10 hover:border-red-500/30 backdrop-blur-md rounded-full shadow-lg transition-all duration-300 flex flex-col items-center group/like ${
                      reel.liked ? 'text-red-500 bg-red-500/5' : 'text-white hover:text-red-400'
                    }`}
                  >
                    <Heart className={`w-5 h-5 transition-transform duration-200 active:scale-150 ${reel.liked ? 'fill-red-500' : 'none'}`} />
                    <span className="text-[10px] font-extrabold mt-1 text-white">{reel.likes_count || 0}</span>
                  </button>

                  {/* Comment */}
                  <button
                    className="p-3 bg-slate-950/45 border border-white/10 hover:border-blue-500/30 backdrop-blur-md rounded-full shadow-lg text-white hover:text-blue-400 transition-all duration-300 flex flex-col items-center"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[10px] font-extrabold mt-1 text-white">{reel.comments_count || 0}</span>
                  </button>

                  {/* Share */}
                  <button
                    className="p-3 bg-slate-950/45 border border-white/10 hover:border-green-500/30 backdrop-blur-md rounded-full shadow-lg text-white hover:text-green-400 transition-all duration-300 flex flex-col items-center"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Bottom details overlays */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-6 pt-16 z-10 flex flex-col gap-3">
                  {/* Author header */}
                  {reel.author && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 border border-white/20 flex items-center justify-center text-sm flex-shrink-0">
                        {reel.author.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100 hover:underline">{reel.author.name}</span>
                          {reel.author.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-500/10" />}
                        </div>
                        <span className="text-[9px] text-slate-400 block">@{reel.author.handle}</span>
                      </div>
                    </div>
                  )}

                  {/* Caption */}
                  <p className="text-xs text-slate-200 leading-relaxed font-medium line-clamp-2 select-text">
                    {reel.caption}
                  </p>

                  {/* Music Marquee */}
                  <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5 w-max max-w-[200px] overflow-hidden select-none">
                    <Music className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
                    <div className="overflow-hidden relative w-full h-3">
                      <div className="absolute whitespace-nowrap animate-[marquee_8s_linear_infinite] pl-[100%]">
                        {reel.music_name || "Original audio"}
                      </div>
                    </div>
                  </div>
                </div>
                
                <style>{`
                  @keyframes marquee {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-100%, 0, 0); }
                  }
                `}</style>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
