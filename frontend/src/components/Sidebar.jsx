import React from 'react';
import { Home, Search, Play, Bell, Mail, Bookmark, User, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ activeTab, setActiveTab, notificationsCount, onComposeClick }) {
  const { user, logout } = useAuth();

  const menuItems = [
    { icon: Home, label: 'Home', id: 'home' },
    { icon: Search, label: 'Explore', id: 'explore' },
    { icon: Play, label: 'Reels', id: 'reels' },
    { icon: Bell, label: 'Notifications', id: 'notifications', badge: notificationsCount },
    { icon: Mail, label: 'Messages', id: 'messages' },
    { icon: Bookmark, label: 'Saved', id: 'saved' },
    { icon: User, label: 'Profile', id: 'profile' }
  ];

  return (
    <div className="w-64 border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-2xl flex flex-col h-full flex-shrink-0">
      {/* Header Logo */}
      <div className="p-6 border-b border-slate-900/80">
        <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
          SocialAI
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-full font-semibold transition-all duration-300 relative group overflow-hidden ${
              activeTab === item.id
                ? 'bg-gradient-to-r from-blue-600/90 to-purple-600/90 text-white shadow-[0_0_15px_rgba(59,130,246,0.25)]'
                : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-slate-400'}`} />
            <span className="text-sm font-medium">{item.label}</span>
            {item.badge > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center justify-center animate-bounce">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Compose Trigger */}
        <button
          onClick={onComposeClick}
          className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Compose Post
        </button>
      </nav>

      {/* Profile summary footer */}
      {user && (
        <div className="p-4 border-t border-slate-900/80 bg-slate-950/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold flex-shrink-0 select-none">
              {user.profile_picture_url || '😊'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.full_name || user.username}</div>
              <div className="text-[10px] text-slate-500 truncate">@{user.username}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900/50 rounded-full transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
