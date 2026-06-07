import React from 'react';
import { Heart, MessageCircle, UserPlus, Check } from 'lucide-react';

export default function Notifications({ notifications, onMarkAsRead }) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 space-y-3">
        <span className="text-4xl">🔔</span>
        <p className="text-sm font-semibold">Your notifications list is clean.</p>
        <p className="text-xs text-slate-600">We'll alert you when other users interact with your posts!</p>
      </div>
    );
  }

  const getIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-400 fill-blue-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-400" />;
      default:
        return <span>🔔</span>;
    }
  };

  return (
    <div className="divide-y divide-slate-900/80">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`p-4 flex gap-4 transition-all duration-300 ${
            notif.is_read ? 'bg-slate-950/20' : 'bg-slate-900/10 border-l-2 border-blue-500/50'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-800/80 flex items-center justify-center flex-shrink-0">
            {getIcon(notif.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-200 leading-normal">{notif.message}</p>
                <span className="text-[10px] text-slate-500 block mt-1">
                  {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {!notif.is_read && (
                <button
                  onClick={() => onMarkAsRead(notif.id)}
                  title="Mark as read"
                  className="p-1 text-slate-500 hover:text-green-400 hover:bg-slate-900/60 rounded-full transition-colors flex-shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
