'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Problem {
    topic: string;
    difficulty: string;
}

interface Props {
    problems: Problem[];
}

const COLORS: Record<string, string> = {
    'Arrays': '#6366f1',
    'Trees': '#22d3ee',
    'Graphs': '#f59e0b',
    'Dynamic Programming': '#ec4899',
    'String': '#10b981',
    'Linked List': '#8b5cf6',
    'Binary Search': '#f97316',
    'Sorting': '#14b8a6',
    'Hashing': '#3b82f6',
};

const DEFAULT_COLOR = '#94a3b8';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-black/80 border border-white/10 rounded-lg px-3 py-2 text-sm backdrop-blur-md">
                <p className="font-semibold text-white">{label}</p>
                <p className="text-white/70">{payload[0].value} problems solved</p>
            </div>
        );
    }
    return null;
};

export default function TopicMasteryChart({ problems }: Props) {
    // Aggregate problems by topic
    const topicMap: Record<string, number> = {};
    for (const p of problems) {
        if (!p.topic) continue;
        topicMap[p.topic] = (topicMap[p.topic] || 0) + 1;
    }

    const data = Object.entries(topicMap)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data yet — start solving problems to see your topic mastery!
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis
                    dataKey="topic"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.topic] || DEFAULT_COLOR} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
