import React, { useState, useEffect } from 'react';
import { Mail, Calendar, Users, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth, API_BASE } from '../hooks/useAuth';

export default function Profile({ userId, posts, onFollowStatusChange, onPostClick }) {
  const { user: currentUser, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = currentUser && currentUser.id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        const id = userId || currentUser.id;
        const res = await fetch(`${API_BASE}/api/users/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, currentUser, token]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${profile.id}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => ({
          ...prev,
          isFollowing: data.isFollowing,
          followersCount: data.followersCount
        }));
        if (onFollowStatusChange) onFollowStatusChange();
      }
    } catch (err) {
      console.error("Failed to toggle follow status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm font-semibold">User profile not found.</p>
      </div>
    );
  }

  // Filter posts created by this user
  const userPosts = posts.filter(p => p.user_id === profile.id);

  return (
    <div className="space-y-6">
      {/* Cover Header and Avatar card */}
      <div className="relative">
        <div className="h-44 bg-gradient-to-r from-blue-900/60 via-purple-900/60 to-slate-900 border-b border-slate-900"></div>
        <div className="px-6 flex items-end justify-between -mt-14 relative z-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 border-4 border-slate-950 flex items-center justify-center text-4xl shadow-2xl select-none">
            {profile.profile_picture_url || '👤'}
          </div>

          {!isOwnProfile && (
            <button
              onClick={handleFollowToggle}
              className={`px-6 py-2 rounded-full font-bold text-xs shadow-md transition-all duration-300 transform hover:scale-[1.03] ${
                profile.isFollowing
                  ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
                  : 'bg-white text-slate-950 hover:bg-slate-100'
              }`}
            >
              {profile.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Profile Bio Details */}
      <div className="px-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">{profile.full_name || profile.username}</h2>
            {profile.is_verified && <CheckCircle2 className="w-4.5 h-4.5 text-blue-400 fill-blue-500/10" />}
          </div>
          <p className="text-xs text-slate-500">@{profile.username}</p>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-lg">{profile.bio || "No biography added yet."}</p>

        {/* Dynamic Followers Info */}
        <div className="flex items-center gap-6 text-xs text-slate-400 pt-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="font-extrabold text-slate-200">{profile.followingCount}</span> Following
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="font-extrabold text-slate-200">{profile.followersCount}</span> Followers
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="font-extrabold text-slate-200">{userPosts.length}</span> Posts
          </div>
        </div>
      </div>

      {/* User Posts Timeline Divider */}
      <div className="border-t border-slate-900/80">
        <div className="px-6 py-4 border-b border-slate-900/80 bg-slate-950/20">
          <h3 className="font-extrabold text-sm text-slate-300">User Publications</h3>
        </div>

        {userPosts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm font-semibold">No posts uploaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-900/80">
            {userPosts.map(post => (
              <div
                key={post.id}
                onClick={() => onPostClick && onPostClick(post)}
                className="p-6 hover:bg-slate-900/20 transition-all duration-300 cursor-pointer border-b border-slate-900/80"
              >
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-lg flex-shrink-0">
                    {profile.profile_picture_url}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-200">{profile.full_name}</span>
                      <span className="text-slate-500">@{profile.username}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">
                        {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300 leading-normal whitespace-pre-line truncate max-h-16">
                      {post.content}
                    </p>
                    
                    {post.content_category && (
                      <span className="inline-flex mt-3 items-center gap-1 bg-slate-900/80 border border-slate-800 text-[10px] text-blue-400 px-2 py-0.5 rounded-full">
                        {post.content_category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
