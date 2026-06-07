import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, UserPlus, Heart, Award, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth, API_BASE } from '../hooks/useAuth';

export default function AIPanel({ refreshTrigger, onFollowChange }) {
  const { token } = useAuth();
  const [trends, setTrends] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [safety, setSafety] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAIData = async () => {
    if (!token) return;
    try {
      // 1. Fetch AI Trends
      const trendsRes = await fetch(`${API_BASE}/api/ai/trends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData);
      }

      // 2. Fetch User Safety Audit
      const safetyRes = await fetch(`${API_BASE}/api/ai/safety-rating`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (safetyRes.ok) {
        const safetyData = await safetyRes.json();
        setSafety(safetyData);
      }

      // 3. Fetch Follow suggestions
      const suggRes = await fetch(`${API_BASE}/api/users/meta/suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (suggRes.ok) {
        const suggestionsData = await suggRes.json();
        setSuggestions(suggestionsData);
      }
    } catch (err) {
      console.error("Failed to load AI panel insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIData();
  }, [token, refreshTrigger]);

  const handleFollow = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Toggle optimistic follow state locally
        setSuggestions(prev => prev.filter(u => u.id !== userId));
        if (onFollowChange) onFollowChange();
      }
    } catch (error) {
      console.error("Failed to follow recommended user:", error);
    }
  };

  return (
    <div className="w-80 border-l border-slate-800/80 p-6 space-y-6 overflow-y-auto h-full flex-shrink-0 bg-slate-950/40 backdrop-blur-3xl">
      {/* 1. AI Safety Metrics Dashboard */}
      {safety && (
        <div className="bg-gradient-to-br from-slate-900/90 to-blue-950/20 border border-blue-500/20 rounded-2xl p-4 space-y-3 relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl group-hover:bg-blue-500/10 transition-all"></div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Safety Rating Audited
            </div>
            <span className="text-[10px] bg-blue-500/15 text-blue-400 font-extrabold px-1.5 py-0.5 rounded-full">
              Score: {safety.safetyScore}/100
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Risk Profile</span>
              <span className={`capitalize font-bold ${
                safety?.riskLevel === 'low' ? 'text-green-400' : safety?.riskLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'
              }`}>{safety?.riskLevel || 'low'}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              {safety?.recommendations?.[0] || "No security flags raised. Account safe."}
            </p>
          </div>
        </div>
      )}

      {/* 2. Global AI Trend Analysis */}
      {trends && (
        <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            <Sparkles className="w-4 h-4 text-blue-400" />
            AI Trend Forecast
          </div>

          <div className="space-y-3">
            {trends?.trends?.topTrends?.slice(0, 3).map((trend, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-900/30 hover:bg-slate-900/60 border border-slate-900/50 hover:border-slate-800/80 cursor-pointer transition-all duration-300 flex items-start gap-3">
                <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 font-extrabold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">{trend}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Growing trajectory</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sentiment Tracker */}
          <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              Community Sentiment:
            </span>
            <span className="text-green-400 font-extrabold uppercase">{trends?.trends?.sentiment || 'positive'}</span>
          </div>
        </div>
      )}

      {/* 3. Follow Suggestions */}
      <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-slate-200">People to Follow</h3>
        {suggestions.length === 0 ? (
          <p className="text-[10px] text-slate-500">You are following everyone on our platform! 🚀</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((sugg) => (
              <div key={sugg.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900/20 transition-all duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-sm flex-shrink-0 select-none">
                    {sugg.profile_picture_url || '👤'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 hover:underline cursor-pointer truncate">
                      {sugg.full_name || sugg.username}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">@{sugg.username}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleFollow(sugg.id)}
                  className="p-1.5 text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500 rounded-full transition-all duration-300"
                  title="Follow"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-[10px] text-slate-600 space-y-1 pt-4 text-center">
        <p>Terms · Privacy · Cookies</p>
        <p>SocialAI © 2026 Dual-AI Agent</p>
      </div>
    </div>
  );
}
