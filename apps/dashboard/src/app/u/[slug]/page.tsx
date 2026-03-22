'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Flame, Sparkles, Target, Trophy } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

interface PublicProfile {
    slug: string;
    display_name: string;
    avatar_url?: string | null;
    headline?: string | null;
    bio?: string | null;
    total_solved: number;
    current_streak: number;
    interview_readiness: number;
    platform_breakdown: { platform: string; count?: number; solve_count?: number }[];
    top_topics: { topic: string; solved: number; mastery_score: number }[];
    recent_solves: {
        problem_name: string;
        topic: string;
        difficulty: string;
        platform: string;
        solved_at: string;
        problem_url?: string | null;
    }[];
    achievements: { id: string; title: string; description: string }[];
}

async function fetchPublicProfile(slug: string): Promise<PublicProfile> {
    const response = await fetch(`${API_BASE}/public-profiles/${slug}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Public profile not found.');
    }
    return payload?.data ?? payload;
}

export default function PublicProfilePage() {
    const params = useParams<{ slug: string }>();
    const slug = useMemo(() => String(params?.slug || ''), [params]);
    const query = useQuery({
        queryKey: ['public-profile-page', slug],
        enabled: !!slug,
        queryFn: () => fetchPublicProfile(slug),
    });

    if (query.isLoading) {
        return <div className="flex min-h-screen items-center justify-center bg-[#041018] text-white">Loading public profile...</div>;
    }

    if (query.isError || !query.data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#041018] px-6 text-white">
                <div className="max-w-xl rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-center">
                    <h1 className="font-outfit text-3xl font-black">Profile not found</h1>
                    <p className="mt-3 text-white/55">That DSAFlow public page is missing or still private.</p>
                    <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/5">
                        <ArrowLeft className="h-4 w-4" /> Open DSAFlow
                    </Link>
                </div>
            </div>
        );
    }

    const profile = query.data;

    return (
        <div className="min-h-screen bg-[#041018] px-6 py-10 text-white md:px-10 xl:px-14">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-[10%] left-[10%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute bottom-[-8%] right-[4%] h-[32%] w-[32%] rounded-full bg-emerald-500/10 blur-[120px]" />
            </div>
            <div className="relative mx-auto max-w-[1350px]">
                <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to DSAFlow
                </Link>

                <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[38px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-2xl">
                        <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">Public Profile</p>
                        <h1 className="mt-4 font-outfit text-4xl font-black text-white md:text-6xl">{profile.display_name}</h1>
                        <p className="mt-4 max-w-3xl text-lg text-white/55">{profile.headline || 'Consistent DSA practice with measurable momentum.'}</p>
                        {profile.bio && <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/45">{profile.bio}</p>}

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Total solved</p>
                                <p className="mt-2 font-outfit text-4xl font-black text-white">{profile.total_solved}</p>
                            </div>
                            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Current streak</p>
                                <p className="mt-2 flex items-center gap-2 font-outfit text-4xl font-black text-white"><Flame className="h-7 w-7 text-rose-300" /> {profile.current_streak}</p>
                            </div>
                            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Interview readiness</p>
                                <p className="mt-2 flex items-center gap-2 font-outfit text-4xl font-black text-white"><Target className="h-7 w-7 text-cyan-300" /> {profile.interview_readiness}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[38px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-2xl">
                        <div className="flex items-center gap-2 text-cyan-300">
                            <Sparkles className="h-5 w-5" />
                            <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em]">Top Topics</p>
                        </div>
                        <div className="mt-6 space-y-4">
                            {profile.top_topics?.map((topic) => (
                                <div key={topic.topic} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-white">{topic.topic}</p>
                                        <p className="text-xs text-white/45">{topic.solved} solves</p>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-white/5">
                                        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${Math.min(100, topic.mastery_score)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <div className="flex items-center gap-2 text-emerald-300">
                            <Trophy className="h-5 w-5" />
                            <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em]">Achievements</p>
                        </div>
                        <div className="mt-6 grid gap-3">
                            {(profile.achievements || []).map((achievement) => (
                                <div key={achievement.id || achievement.title} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <p className="text-sm font-semibold text-white">{achievement.title}</p>
                                    <p className="mt-1 text-xs text-white/45">{achievement.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Recent Solves</p>
                        <div className="mt-6 space-y-4">
                            {(profile.recent_solves || []).map((problem) => (
                                <div key={`${problem.problem_name}-${problem.solved_at}`} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{problem.problem_name}</p>
                                            <p className="mt-1 text-xs text-white/45">{problem.topic} • {problem.difficulty} • {problem.platform}</p>
                                        </div>
                                        <p className="text-xs text-white/35">{new Date(problem.solved_at).toLocaleDateString()}</p>
                                    </div>
                                    {problem.problem_url && (
                                        <a href={problem.problem_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                                            Open problem <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
