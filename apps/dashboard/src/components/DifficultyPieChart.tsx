'use client';

import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface Stats {
    easy: number;
    medium: number;
    hard: number;
}

const COLORS = ['#22d3ee', '#f59e0b', '#ef4444'];
const LABELS = ['Easy', 'Medium', 'Hard'];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-black/80 border border-white/10 rounded-lg px-3 py-2 text-sm backdrop-blur-md">
                <p className="font-semibold" style={{ color: payload[0].payload.fill }}>
                    {payload[0].name}
                </p>
                <p className="text-white/70">{payload[0].value} problems</p>
            </div>
        );
    }
    return null;
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number }) => {
    if (percent === undefined || percent < 0.05 || cx === undefined || cy === undefined || midAngle === undefined || innerRadius === undefined || outerRadius === undefined) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

export default function DifficultyPieChart({ stats }: { stats: Stats }) {
    const data = [
        { name: 'Easy', value: stats.easy },
        { name: 'Medium', value: stats.medium },
        { name: 'Hard', value: stats.hard },
    ].filter(d => d.value > 0);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data yet — solve some problems first!
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[LABELS.indexOf(entry.name)]} stroke="transparent" />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
