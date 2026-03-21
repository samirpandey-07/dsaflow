'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface TopicItem {
    topic: string;
    solved: number;
    easy: number;
    medium: number;
    hard: number;
    mastery_score: number;
}

const COLORS = ['#58d5ff', '#22c55e', '#f59e0b', '#fb7185', '#a78bfa', '#14b8a6', '#38bdf8', '#f97316'];

export default function TopicMasteryChart({ topics, loading }: { topics: TopicItem[]; loading?: boolean }) {
    if (loading) {
        return <div className="h-72 rounded-3xl bg-white/5 animate-pulse" />;
    }

    if (!topics.length) {
        return (
            <div className="flex h-72 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-white/45">
                Log a few problems to unlock topic mastery analytics.
            </div>
        );
    }

    const data = topics.slice(0, 8);

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300/80">Topic mastery</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Coverage and strength by topic</h3>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 8 }}>
                    <XAxis dataKey="topic" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const item = payload[0].payload as TopicItem;

                            return (
                                <div className="rounded-2xl border border-white/10 bg-[#0d1117]/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md">
                                    <p className="font-semibold">{item.topic}</p>
                                    <p className="mt-1 text-white/65">Solved: {item.solved}</p>
                                    <p className="text-white/65">Easy/Med/Hard: {item.easy}/{item.medium}/{item.hard}</p>
                                    <p className="text-cyan-200">Mastery score: {item.mastery_score}</p>
                                </div>
                            );
                        }}
                    />
                    <Bar dataKey="mastery_score" radius={[10, 10, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={entry.topic} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
