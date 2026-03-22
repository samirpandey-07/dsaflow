'use client';

import { BrainCircuit, Gauge, Sparkles } from 'lucide-react';

interface ReadinessData {
    score: number;
    level: string;
    recommendations: string[];
    breakdown: {
        solve_volume: number;
        difficulty_balance: number;
        topic_breadth: number;
        streak_discipline: number;
        revision_health: number;
    };
}

export default function InterviewReadinessCard({
    data,
    loading,
}: {
    data?: ReadinessData;
    loading?: boolean;
}) {
    const score = data?.score || 0;
    const bars = [
        { label: 'Volume', value: data?.breakdown.solve_volume || 0 },
        { label: 'Difficulty', value: data?.breakdown.difficulty_balance || 0 },
        { label: 'Breadth', value: data?.breakdown.topic_breadth || 0 },
        { label: 'Discipline', value: data?.breakdown.streak_discipline || 0 },
        { label: 'Revision', value: data?.breakdown.revision_health || 0 },
    ];

    return (
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Interview Readiness</p>
                    <h3 className="mt-2 font-outfit text-2xl font-black text-white">Momentum Score</h3>
                    <p className="mt-2 text-sm text-white/45">
                        {loading ? 'Calculating readiness...' : data?.level || 'Foundation'}
                    </p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300">
                    <BrainCircuit className="h-5 w-5" />
                </div>
            </div>

            <div className="mt-6 flex items-end gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                    <div className="text-center">
                        <p className="font-outfit text-3xl font-black text-white">{score}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">/100</p>
                    </div>
                </div>
                <div className="flex-1">
                    {bars.map((bar) => (
                        <div key={bar.label} className="mb-3 last:mb-0">
                            <div className="mb-1 flex items-center justify-between text-xs text-white/45">
                                <span>{bar.label}</span>
                                <span>{bar.value}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5">
                                <div
                                    className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                                    style={{ width: `${Math.min(100, (bar.value / 20) * 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/5 bg-[#081018] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/75">
                    <Gauge className="h-4 w-4 text-cyan-300" />
                    Coaching priorities
                </div>
                <div className="space-y-2">
                    {(data?.recommendations || ['Log more problems to unlock personalized coaching.']).slice(0, 3).map((recommendation) => (
                        <div key={recommendation} className="flex items-start gap-2 text-sm text-white/55">
                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                            <span>{recommendation}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
