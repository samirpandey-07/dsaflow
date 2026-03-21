'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { motion, Variants } from 'framer-motion';
import {
    Activity,
    ArrowUpRight,
    CalendarRange,
    Flame,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    Target,
    Settings as SettingsIcon,
} from 'lucide-react';
import ProfileModal from '../components/ProfileModal';
import PlatformBreakdown from '../components/PlatformBreakdown';
import InsightsPanel from '../components/InsightsPanel';
import AchievementsGrid from '../components/AchievementsGrid';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

const TopicMasteryChart = dynamic(() => import('../components/TopicMasteryChart'), { ssr: false });
const DifficultyPieChart = dynamic(() => import('../components/DifficultyPieChart'), { ssr: false });
const ActivityHeatmap = dynamic(() => import('../components/ActivityHeatmap'), { ssr: false });
const ProblemsList = dynamic(() => import('../components/ProblemsList'), { ssr: false });
const RevisionQueue = dynamic(() => import('../components/RevisionQueue'), { ssr: false });

interface ProblemLite {
    id: string;
    problem_name: string;
    topic: string;
    solved_at: string;
}

const containerVars: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVars: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0, 
        transition: { 
            duration: 0.5, 
            ease: [0.22, 1, 0.36, 1] 
        } 
    },
};

export default function Dashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        setMounted(true);

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.replace('/login');
            } else {
                setUser(session.user);
            }
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.replace('/login');
            } else {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        const invalidateKeys = (keys: string[]) => Promise.all(
            keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
        );

        const channel = supabase
            .channel('dashboard-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'problems' }, (payload) => {
                const oldRow = (payload.old ?? {}) as Record<string, unknown>;
                const newRow = (payload.new ?? {}) as Record<string, unknown>;
                const changedSolveShape = payload.eventType !== 'UPDATE'
                    || oldRow.solved_at !== newRow.solved_at
                    || oldRow.topic !== newRow.topic
                    || oldRow.platform !== newRow.platform
                    || oldRow.difficulty !== newRow.difficulty;
                const changedRevisionShape = payload.eventType !== 'UPDATE'
                    || oldRow.next_revision_at !== newRow.next_revision_at
                    || oldRow.revision_count !== newRow.revision_count;

                const keys = ['problems-table'];
                if (changedSolveShape) {
                    keys.push('overview', 'activity', 'topics', 'platforms', 'achievements', 'insights', 'problem-lite');
                }
                if (changedRevisionShape) {
                    keys.push('overview', 'revisions');
                }

                void invalidateKeys([...new Set(keys)]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, user]);

    const overviewQuery = useQuery({
        queryKey: ['overview', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<{
            total_solved: number;
            solved_today: number;
            weekly_progress: number;
            monthly_progress: number;
            easy: number;
            medium: number;
            hard: number;
            revision_due: number;
            current_streak: number;
            longest_streak: number;
        }>('/analytics/overview'),
    });

    const activityQuery = useQuery({
        queryKey: ['activity', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<{ date: string; count: number }[]>('/analytics/activity?days=84'),
    });

    const topicsQuery = useQuery({
        queryKey: ['topics', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<Record<string, unknown>[]>('/analytics/topics'),
    });

    const platformsQuery = useQuery({
        queryKey: ['platforms', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<{ platform: string; count: number }[]>('/analytics/platforms'),
    });

    const revisionsQuery = useQuery({
        queryKey: ['revisions', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<Record<string, unknown>>('/revision-queue'),
    });

    const achievementsQuery = useQuery({
        queryKey: ['achievements', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<Record<string, unknown>[]>('/achievements'),
    });

    const insightsQuery = useQuery({
        queryKey: ['insights', user?.id],
        enabled: !!user,
        queryFn: () => apiFetch<Record<string, unknown>>('/analytics/insights'),
    });

    const problemLiteQuery = useQuery({
        queryKey: ['problem-lite', user?.id],
        enabled: !!user,
        queryFn: async () => {
            const response = await apiFetch<{ items: ProblemLite[] }>('/problems?limit=200&sort_by=solved_at&sort_order=desc');
            return response.items;
        },
    });

    const difficultyStats = useMemo(() => ({
        easy: overviewQuery.data?.easy || 0,
        medium: overviewQuery.data?.medium || 0,
        hard: overviewQuery.data?.hard || 0,
    }), [overviewQuery.data]);

    const heroCards = [
        {
            title: 'Solved today',
            value: overviewQuery.data?.solved_today || 0,
            copy: 'Files logged from practice flow.',
            icon: <Sparkles className="h-5 w-5 text-emerald-400" />,
            tone: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/20 shadow-emerald-500/10',
        },
        {
            title: 'Weekly progress',
            value: overviewQuery.data?.weekly_progress || 0,
            copy: 'Solved in the last 7 days.',
            icon: <CalendarRange className="h-5 w-5 text-sky-400" />,
            tone: 'from-sky-500/20 via-sky-500/5 to-transparent border-sky-500/20 shadow-sky-500/10',
        },
        {
            title: 'Revision pressure',
            value: overviewQuery.data?.revision_due || 0,
            copy: 'Problems due for spaced repetition.',
            icon: <Target className="h-5 w-5 text-amber-400" />,
            tone: 'from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/20 shadow-amber-500/10',
        },
        {
            title: 'Current streak',
            value: overviewQuery.data?.current_streak || 0,
            copy: `Longest streak: ${overviewQuery.data?.longest_streak || 0} days`,
            icon: <Flame className="h-5 w-5 text-rose-400" />,
            tone: 'from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/20 shadow-rose-500/10',
        },
    ];

    const healthQuery = useQuery({
        queryKey: ['health'],
        queryFn: () => apiFetch<{ status: string }>('/health'),
        refetchInterval: 10000, // Check every 10 seconds
    });

    const connectionStatus = authLoading
        ? 'syncing'
        : healthQuery.data?.status === 'ok'
            ? 'Healthy'
            : 'Unstable';

    const refreshAll = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['overview'] }),
            queryClient.invalidateQueries({ queryKey: ['activity'] }),
            queryClient.invalidateQueries({ queryKey: ['topics'] }),
            queryClient.invalidateQueries({ queryKey: ['platforms'] }),
            queryClient.invalidateQueries({ queryKey: ['revisions'] }),
            queryClient.invalidateQueries({ queryKey: ['achievements'] }),
            queryClient.invalidateQueries({ queryKey: ['insights'] }),
            queryClient.invalidateQueries({ queryKey: ['problem-lite'] }),
            queryClient.invalidateQueries({ queryKey: ['problems-table'] }),
            queryClient.invalidateQueries({ queryKey: ['health'] }),
        ]);
    };
// ... (later in the JSX)
                            {[
                                { label: 'Total Solves', value: overviewQuery.data?.total_solved || 0, sub: 'All-time practice volume' },
                                { label: 'Monthly Output', value: overviewQuery.data?.monthly_progress || 0, sub: 'Activity last 30 days' },
                                { label: 'System Status', value: connectionStatus, sub: healthQuery.isError ? 'API Connection Lost' : 'Realtime data pipeline', icon: ShieldCheck, color: connectionStatus === 'Healthy' ? 'text-emerald-400' : 'text-rose-400' },
                            ].map((stat, i) => (
                                <div key={i} className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]">
                                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{stat.label}</p>
                                    <div className="mt-3 flex items-end justify-between">
                                        <p className={`text-4xl font-black text-white ${stat.label === 'System Status' ? 'text-2xl capitalize' : ''}`}>
                                            {stat.value}
                                        </p>
                                        {stat.icon && <stat.icon className={`mb-1 h-5 w-5 ${stat.color || 'text-emerald-400'}`} />}
                                    </div>
                                    <p className="mt-2 text-xs font-medium text-white/30">{stat.sub}</p>
                                </div>
                            ))}

    if (!mounted || authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#03080c]">
                <div className="flex flex-col items-center gap-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                        className="h-12 w-12 rounded-full border-4 border-sky-500/20 border-t-sky-500"
                    />
                    <p className="font-outfit text-lg font-medium tracking-wide text-white/50">Initializing DSAFlow...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#03080c] selection:bg-sky-500/30">
            {/* Ambient Background */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-sky-500/10 blur-[120px]" />
                <div className="absolute top-[20%] -right-[10%] h-[35%] w-[35%] rounded-full bg-indigo-500/5 blur-[100px]" />
                <div className="absolute -bottom-[10%] left-[20%] h-[30%] w-[30%] rounded-full bg-rose-500/5 blur-[100px]" />
            </div>

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVars}
                className="relative mx-auto max-w-[1500px] px-6 py-10 md:px-10 xl:px-14"
            >
                <motion.header variants={itemVars} className="mb-10 grid gap-8 xl:grid-cols-[1.4fr_0.8fr]">
                    <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-white/[0.03] p-10 backdrop-blur-3xl shadow-2xl">
                        <div className="absolute top-0 right-0 p-8 opacity-20">
                            <Sparkles className="h-32 w-32 text-sky-400" />
                        </div>

                        <div className="relative flex flex-wrap items-start justify-between gap-6">
                            <div className="max-w-2xl">
                                <p className="font-outfit text-xs font-bold uppercase tracking-[0.4em] text-sky-400/90">Command Center</p>
                                <h1 className="mt-4 font-outfit text-4xl font-black tracking-tight text-white md:text-5xl lg:text-6xl leading-[1.1]">
                                    Master your <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">momentum.</span>
                                </h1>
                                <p className="mt-6 text-lg leading-relaxed text-white/50 font-medium">
                                    Your IDE tracks the work. DSAFlow turns it into mastery signals, spaced repetition cycles, and intelligent pattern insights.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsProfileOpen(true)}
                                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white backdrop-blur-xl transition-colors hover:bg-white/10"
                                >
                                    {(user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => void refreshAll()}
                                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                    <span>Sync</span>
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => router.push('/settings')}
                                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
                                >
                                    <SettingsIcon className="h-4 w-4" />
                                </motion.button>
                            </div>
                        </div>

                        <div className="mt-12 grid gap-6 md:grid-cols-3">
                            {[
                                { label: 'Total Solves', value: overviewQuery.data?.total_solved || 0, sub: 'All-time practice volume' },
                                { label: 'Monthly Output', value: overviewQuery.data?.monthly_progress || 0, sub: 'Activity last 30 days' },
                                { label: 'System Status', value: connectionStatus, sub: healthQuery.isError ? 'API Connection Lost' : 'Realtime data pipeline', icon: ShieldCheck, color: connectionStatus === 'Healthy' ? 'text-emerald-400' : 'text-rose-400' },
                            ].map((stat, i) => (
                                <div key={i} className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]">
                                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{stat.label}</p>
                                    <div className="mt-3 flex items-end justify-between">
                                        <p className={`text-4xl font-black text-white ${stat.label === 'System Status' ? 'text-2xl capitalize' : ''}`}>
                                            {stat.value}
                                        </p>
                                        {stat.icon && <stat.icon className={`mb-1 h-5 w-5 ${stat.color || 'text-emerald-400'}`} />}
                                    </div>
                                    <p className="mt-2 text-xs font-medium text-white/30">{stat.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <InsightsPanel insights={insightsQuery.data} loading={insightsQuery.isLoading} />
                </motion.header>

                <motion.section variants={itemVars} className="mb-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                    {heroCards.map((card) => (
                        <motion.div
                            key={card.title}
                            whileHover={{ y: -5, transition: { duration: 0.2 } }}
                            className={`relative overflow-hidden rounded-[32px] border bg-gradient-to-br p-8 shadow-xl ${card.tone}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-md">{card.icon}</div>
                                <ArrowUpRight className="h-4 w-4 text-white/20" />
                            </div>
                            <p className="mt-6 font-outfit text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">{card.title}</p>
                            <p className="mt-2 font-outfit text-5xl font-black text-white">{card.value}</p>
                            <p className="mt-3 text-sm leading-relaxed text-white/40 font-medium">{card.copy}</p>

                            {/* subtle decorative glow */}
                            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
                        </motion.div>
                    ))}
                </motion.section>

                <div className="grid gap-8">
                    <motion.section variants={itemVars} className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl shadow-xl">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Activity</p>
                                    <h2 className="mt-1.5 font-outfit text-2xl font-black text-white">Solve Heatmap</h2>
                                </div>
                                <Activity className="h-5 w-5 text-emerald-400 opacity-50" />
                            </div>
                            <ActivityHeatmap activity={activityQuery.data || []} problems={problemLiteQuery.data || []} />
                        </div>

                        <div className="flex flex-col rounded-[32px] border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl shadow-xl lg:max-h-[520px]">
                            <div className="mb-5">
                                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Revision Engine</p>
                                <h2 className="mt-1.5 font-outfit text-2xl font-black text-white">Spaced Repetition</h2>
                            </div>
                            <RevisionQueue data={revisionsQuery.data} loading={revisionsQuery.isLoading} onRefresh={() => void refreshAll()} />
                        </div>
                    </motion.section>

                    <motion.section variants={itemVars} className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[40px] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl shadow-xl">
                            <TopicMasteryChart topics={topicsQuery.data || []} loading={topicsQuery.isLoading} />
                        </div>

                        <div className="grid gap-8">
                            <div className="rounded-[36px] border border-white/10 bg-white/[0.02] p-8 backdrop-blur-xl shadow-xl">
                                <div className="mb-6">
                                    <p className="font-outfit text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400">Difficulty Balance</p>
                                    <h3 className="mt-2 font-outfit text-2xl font-black text-white">Distribution</h3>
                                </div>
                                <DifficultyPieChart stats={difficultyStats} />
                            </div>
                            <PlatformBreakdown items={platformsQuery.data || []} loading={platformsQuery.isLoading} />
                        </div>
                    </motion.section>

                    <motion.section variants={itemVars}>
                        <AchievementsGrid items={achievementsQuery.data || []} loading={achievementsQuery.isLoading} />
                    </motion.section>

                    <motion.section variants={itemVars} className="pb-10">
                        <div className="rounded-[40px] border border-white/10 bg-white/[0.02] p-2 backdrop-blur-xl shadow-xl">
                            <ProblemsList />
                        </div>
                    </motion.section>
                </div>
            </motion.div>

            <ProfileModal
                user={user}
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onUpdate={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        setUser(session.user);
                    }
                }}
            />
        </div>
    );
}
