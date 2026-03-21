'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

interface PlatformBreakdownProps {
    items: { platform: string; count: number }[];
    loading?: boolean;
}

const COLORS = ['#58d5ff', '#3fb950', '#ffb454', '#ff7b72', '#a371f7'];

export default function PlatformBreakdown({ items, loading }: PlatformBreakdownProps) {
    if (loading) {
        return <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />;
    }

    if (!items.length) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-muted-foreground">
                No platform data yet.
            </div>
        );
    }

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300/80">Platform Mix</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">Where you solve</h3>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <BarChart3 className="h-5 w-5 text-cyan-300" />
                </div>
            </div>

            <div className="space-y-4">
                {items.map((item, index) => {
                    const percentage = total ? (item.count / total) * 100 : 0;

                    return (
                        <div key={item.platform} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                    <span
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="font-medium text-white/85">{item.platform}</span>
                                </div>
                                <span className="text-white/60">{item.count} solves</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${Math.max(percentage, 6)}%`,
                                        backgroundColor: COLORS[index % COLORS.length],
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
