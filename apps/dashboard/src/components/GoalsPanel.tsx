'use client';

import { Flag, Trophy } from 'lucide-react';

interface GoalItem {
    id: string;
    title: string;
    metric: string;
    period: string;
    target_count: number;
    current_value: number;
    progress_pct: number;
    remaining: number;
    computed_status: string;
    focus_topic?: string | null;
    focus_platform?: string | null;
}

export default function GoalsPanel({
    goals,
    loading,
}: {
    goals?: GoalItem[];
    loading?: boolean;
}) {
    const items = goals || [];

    return (
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Goal System</p>
                    <h3 className="mt-2 font-outfit text-2xl font-black text-white">Weekly Targets</h3>
                    <p className="mt-2 text-sm text-white/45">
                        {loading ? 'Loading goals...' : `${items.length} goals currently tracked`}
                    </p>
                </div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-300">
                    <Flag className="h-5 w-5" />
                </div>
            </div>

            <div className="mt-6 space-y-4">
                {!items.length && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/45">
                        Create your first target in Settings to track weekly solves, hard-problem volume, streaks, or topic-specific goals.
                    </div>
                )}

                {items.slice(0, 4).map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">{goal.title}</p>
                                <p className="mt-1 text-xs text-white/45">
                                    {goal.metric.replace(/_/g, ' ')} • {goal.period}
                                    {goal.focus_topic ? ` • ${goal.focus_topic}` : ''}
                                    {goal.focus_platform ? ` • ${goal.focus_platform}` : ''}
                                </p>
                            </div>
                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                                goal.computed_status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-white/8 text-white/60'
                            }`}>
                                {goal.computed_status === 'completed' ? 'Complete' : 'In Progress'}
                            </div>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/5">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400"
                                style={{ width: `${goal.progress_pct}%` }}
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                            <span>{goal.current_value} / {goal.target_count}</span>
                            <span>{goal.remaining} remaining</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-white/40">
                <Trophy className="h-4 w-4 text-amber-300" />
                Goals automatically mark complete when your tracked progress reaches the target.
            </div>
        </div>
    );
}
