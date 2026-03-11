"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import StatsCards from '../components/StatsCards';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import ProfileModal from '../components/ProfileModal';
import { getAuthToken } from '../lib/auth';

// Dynamic imports with ssr:false — permanently prevents hydration errors
const TopicMasteryChart = dynamic(() => import('../components/TopicMasteryChart'), { ssr: false });
const DifficultyPieChart = dynamic(() => import('../components/DifficultyPieChart'), { ssr: false });
const ActivityHeatmap = dynamic(() => import('../components/ActivityHeatmap'), { ssr: false });
const ProblemsList = dynamic(() => import('../components/ProblemsList'), { ssr: false });
const RevisionQueue = dynamic(() => import('../components/RevisionQueue'), { ssr: false });

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

// ... (skipping interface definition for brevity, it's untouched) 
interface Problem {
  id: string;
  problem_name: string;
  topic: string;
  difficulty: string;
  language: string;
  platform: string;
  problem_url: string | null;
  code_snippet: string | null;
  solved_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Custom fetcher for React Query
  const fetchApi = async (endpoint: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('No auth token');
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Fetch failed for ${endpoint}`);
    return res.json();
  };

  // React Query Hooks (Enabled only when user exists)
  const { data: qStats, isLoading: loadStats } = useQuery({
    queryKey: ['stats', user?.id],
    queryFn: () => fetchApi('/stats'),
    enabled: !!user
  });

  const {
    data: qProblems,
    isLoading: loadProblems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['problems', user?.id],
    queryFn: async ({ pageParam }) => {
      const url = pageParam ? `/problems?cursor=${pageParam}&limit=20` : `/problems?limit=20`;
      return fetchApi(url);
    },
    initialPageParam: '' as string | null,
    getNextPageParam: (lastPage) => lastPage.has_next_page ? lastPage.next_cursor : undefined,
    enabled: !!user
  });

  const { data: qUserStats, isLoading: loadUserStats } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: () => fetchApi('/user/stats'),
    enabled: !!user
  });

  const { data: qVelocity, isLoading: loadVelocity } = useQuery({
    queryKey: ['velocity', user?.id],
    queryFn: () => fetchApi('/analytics/velocity'),
    enabled: !!user
  });

  // Provide fallback defaults for UI
  const stats = qStats || { solved: 0, easy: 0, medium: 0, hard: 0 };
  const userStats = qUserStats || { current_streak: 0, longest_streak: 0 };
  const velocity = qVelocity || { solves_last_7_days: 0, daily_velocity: 0 };

  // Flatten infinite query pages into a single array safely across Hydration
  const [problems, setProblems] = useState<Problem[]>([]);

  useEffect(() => {
    if (qProblems?.pages) {
      const flattened = qProblems.pages.flatMap(page => page.data || []);
      setProblems(flattened);
    }
  }, [qProblems]);

  const loading = loadStats || loadProblems || loadUserStats || loadVelocity;
  const connectionStatus = loading ? 'connecting' : (user ? 'online' : 'offline');

  // ────────────────────────────────────────────────
  // 1. AUTH GUARD
  // ────────────────────────────────────────────────
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setUser(session.user);
  };

  useEffect(() => {
    setMounted(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setUser(session.user);
        // FORCE REFRESH: Because we just fixed a backend RLS bug,
        // React Query might be aggressively caching the old empty [] arrays.
        // This ensures it actually reaches out to the API on load.
        queryClient.invalidateQueries({ queryKey: ['problems', session.user.id] });
        queryClient.invalidateQueries({ queryKey: ['stats', session.user.id] });
        queryClient.invalidateQueries({ queryKey: ['userStats', session.user.id] });
        queryClient.invalidateQueries({ queryKey: ['velocity', session.user.id] });
      }
      setAuthLoading(false);
    });

    // React to sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  // ────────────────────────────────────────────────
  // 2. REALTIME SUBSCRIPTIONS
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // React Query handles initial fetch. We just bind subscriptions here to invalidate caches.
    const channel = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'problems' }, () => {
        queryClient.invalidateQueries({ queryKey: ['problems', user.id] });
        queryClient.invalidateQueries({ queryKey: ['stats', user.id] });
        queryClient.invalidateQueries({ queryKey: ['velocity', user.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => {
        queryClient.invalidateQueries({ queryKey: ['userStats', user.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // --- Derived Stats (Solved Today) ---
  const solvedToday = problems.filter(p => {
    const solvedDate = new Date(p.solved_at).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    return solvedDate === today;
  }).length;

  // ────────────────────────────────────────────────
  // 3. LOGOUT
  // ────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // ────────────────────────────────────────────────
  // 4. RENDER GUARDS
  // ────────────────────────────────────────────────
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <p className="text-white/30 text-sm font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) return null; // Redirect is happening

  // ────────────────────────────────────────────────
  // 5. MAIN DASHBOARD
  // ────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8 md:p-12 lg:p-16 selection:bg-primary/30 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <header className="mb-10 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              DSAFlow
            </h1>

          </div>
          <p className="text-muted-foreground text-base">
            Welcome back,{' '}
            <span className="text-white/80 font-medium">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Coder'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Velocity Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Velocity</span>
              <span className="text-sm font-black text-white leading-none">{(velocity.daily_velocity || 0).toFixed(1)}/day</span>
            </div>
            <div className="p-1.5 bg-yellow-400/10 rounded-lg">
              <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
          </div>

          {/* Streak Badge */}
          <div className="flex items-center gap-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 px-5 py-2.5 rounded-2xl backdrop-blur-md shadow-lg shadow-orange-500/5">
            <span className="text-xl">🔥</span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-widest leading-none">Streak</span>
              <span className="text-lg font-black text-white leading-tight">{userStats.current_streak} Days</span>
            </div>
          </div>

          {/* API Status */}
          <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'online' ? 'bg-green-400' :
              connectionStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
            <span className="text-sm font-medium">
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </span>
          </div>

          {/* User Avatar + Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/60 to-blue-500/60 flex items-center justify-center text-sm font-bold text-white border border-white/10 overflow-hidden hover:scale-105 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Edit Profile Settings"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()
              )}
            </button>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['stats', user.id] });
                queryClient.invalidateQueries({ queryKey: ['problems', user.id] });
                queryClient.invalidateQueries({ queryKey: ['userStats', user.id] });
                queryClient.invalidateQueries({ queryKey: ['velocity', user.id] });
              }}
              className="px-3 py-2 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              title="Manual Refresh"
            >
              🔄
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="px-3 py-2 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-8">
        {/* 🌟 ROW 1: TODAY OVERVIEW 🌟 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: High-Priority Daily Stats */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border border-green-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-[40px] pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-1">Solved Today</h3>
                {loading ? <div className="h-10 w-16 bg-white/5 animate-pulse rounded" /> : <p className="text-5xl font-black text-white">{solvedToday}</p>}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-transparent flex items-center justify-center border border-green-500/10 shadow-lg relative z-10">
                <span className="text-2xl">🚀</span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 flex items-center justify-between border border-orange-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Current Streak</h3>
                {loading ? <div className="h-10 w-16 bg-white/5 animate-pulse rounded" /> : <p className="text-5xl font-black text-white">{userStats.current_streak || 0}</p>}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-transparent flex items-center justify-center border border-orange-500/10 shadow-lg relative z-10">
                <span className="text-2xl">🔥</span>
              </div>
            </div>
          </div>

          {/* Right Column: Revision Queue */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col h-full overflow-hidden border border-primary/20 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="text-primary">⚡</span> Revision Queue
              </h2>
              <span className="bg-primary/20 text-primary text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest border border-primary/20">DUE TODAY</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <RevisionQueue />
            </div>
          </div>
        </section>

        {/* 📊 ROW 2: HISTORICAL OVERVIEW 📊 */}
        <section>
          <StatsCards stats={stats} loading={loading} />
        </section>

        {/* 🗺️ ROW 3: HEATMAP 🗺️ */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col justify-center">
          <h2 className="text-xl font-semibold tracking-tight mb-6">Activity Heatmap</h2>
          {loading ? (
            <div className="h-28 bg-white/5 animate-pulse rounded-xl"></div>
          ) : (
            <ActivityHeatmap problems={problems} />
          )}
        </section>

        {/* 📈 ROW 4: ANALYTICS CHARTS 📈 */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Topic Mastery</h2>
            {loading ? (
              <div className="h-48 bg-white/5 animate-pulse rounded-xl"></div>
            ) : (
              <TopicMasteryChart problems={problems} />
            )}
          </div>

          <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Difficulty Split</h2>
            {loading ? (
              <div className="h-48 bg-white/5 animate-pulse rounded-xl"></div>
            ) : (
              <DifficultyPieChart stats={stats} />
            )}
          </div>
        </section>

        {/* 📜 ROW 5: RECENT SOLVES 📜 */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Recent Solves</h2>
            <span className="text-sm text-muted-foreground">{stats.solved} total</span>
          </div>
          <ProblemsList problems={problems} loading={loading} />

          {hasNextPage && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-white/80 transition-all disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More Problems'}
              </button>
            </div>
          )}
        </section>
      </main>

      <ProfileModal
        user={user}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onUpdate={refreshUser}
      />
    </div >
  );
}
