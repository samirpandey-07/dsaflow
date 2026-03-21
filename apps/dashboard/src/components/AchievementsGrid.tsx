'use client';

import React from 'react';
import { Award, LockKeyhole } from 'lucide-react';

interface Achievement {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
}

export default function AchievementsGrid({ items, loading }: { items: Achievement[]; loading?: boolean }) {
    if (loading) {
        return <div className="h-48 rounded-[28px] bg-white/5 animate-pulse" />;
    }

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-fuchsia-300/80">Achievements</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">Momentum markers</h3>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Award className="h-5 w-5 text-fuchsia-300" />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`rounded-2xl border p-4 transition-all ${
                            item.unlocked
                                ? 'border-fuchsia-400/30 bg-fuchsia-400/10'
                                : 'border-white/8 bg-black/20'
                        }`}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{item.title}</span>
                            {item.unlocked ? (
                                <Award className="h-4 w-4 text-fuchsia-300" />
                            ) : (
                                <LockKeyhole className="h-4 w-4 text-white/30" />
                            )}
                        </div>
                        <p className="text-sm leading-6 text-white/65">{item.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
