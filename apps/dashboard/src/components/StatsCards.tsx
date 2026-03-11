import React from 'react';
import { Target, CheckCircle2, Zap, Brain } from 'lucide-react';

interface StatsProps {
    stats: {
        solved: number;
        easy: number;
        medium: number;
        hard: number;
    };
    loading: boolean;
}

export default function StatsCards({ stats, loading }: StatsProps) {
    const cards = [
        { title: 'Total Solved', value: stats.solved, icon: <CheckCircle2 className="w-6 h-6 text-green-400" />, color: 'from-green-500/10 to-transparent', border: 'border-green-500/20' },
        { title: 'Easy Mastery', value: stats.easy, icon: <Zap className="w-6 h-6 text-blue-400" />, color: 'from-blue-500/20 to-transparent', border: 'border-blue-500/20' },
        { title: 'Medium Grinds', value: stats.medium, icon: <Target className="w-6 h-6 text-orange-400" />, color: 'from-orange-500/20 to-transparent', border: 'border-orange-500/20' },
        { title: 'Hard Conquers', value: stats.hard, icon: <Brain className="w-6 h-6 text-red-400" />, color: 'from-red-500/20 to-transparent', border: 'border-red-500/20' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => (
                <div
                    key={index}
                    className={`glass-panel rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.border}`}
                >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${card.color} rounded-full blur-[40px] opacity-60 group-hover:opacity-100 transition-opacity`} />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
                        <div className="p-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm shadow-sm group-hover:scale-110 transition-transform">
                            {card.icon}
                        </div>
                    </div>
                    <div className="relative z-10">
                        {loading ? (
                            <div className="h-10 w-24 bg-white/10 rounded animate-pulse" />
                        ) : (
                            <p className="text-4xl font-bold tracking-tight text-white">{card.value}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
