'use client';

import React from 'react';

interface Problem {
    solved_at: string;
}

interface Props {
    problems: Problem[];
}

function getColorForCount(count: number): string {
    if (count === 0) return 'bg-white/5 border-white/5';
    if (count === 1) return 'bg-indigo-900/60 border-indigo-700/30';
    if (count === 2) return 'bg-indigo-700/70 border-indigo-500/40';
    if (count >= 3) return 'bg-indigo-500 border-indigo-400/50';
    return 'bg-white/5 border-white/5';
}

export default function ActivityHeatmap({ problems }: Props) {
    // Build a map of date -> count
    const countByDate: Record<string, number> = {};
    for (const p of problems) {
        if (!p.solved_at) continue;
        const date = p.solved_at.substring(0, 10); // "YYYY-MM-DD"
        countByDate[date] = (countByDate[date] || 0) + 1;
    }

    // Build last 84 days (12 weeks)
    const today = new Date();
    const days: { date: string; count: number; label: string }[] = [];
    for (let i = 83; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().substring(0, 10);
        days.push({
            date: dateStr,
            count: countByDate[dateStr] || 0,
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
    }

    // Pad to start on Sunday
    const firstDayOfWeek = new Date(days[0].date).getDay(); // 0=Sun
    const padded = [
        ...Array(firstDayOfWeek).fill(null),
        ...days,
    ];

    const weeks: (typeof days[0] | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
        weeks.push(padded.slice(i, i + 7));
    }

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max">
                {/* Day labels */}
                <div className="flex flex-col gap-1 mr-1">
                    {DAY_LABELS.map((d) => (
                        <div key={d} className="h-3 text-[10px] text-muted-foreground flex items-center w-7">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                        {week.map((day, di) =>
                            day === null ? (
                                <div key={di} className="w-3 h-3" />
                            ) : (
                                <div
                                    key={di}
                                    title={`${day.label}: ${day.count} problem${day.count !== 1 ? 's' : ''}`}
                                    className={`w-3 h-3 rounded-sm border transition-all duration-150 hover:scale-125 cursor-pointer ${getColorForCount(day.count)}`}
                                />
                            )
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <span>Less</span>
                {[0, 1, 2, 3].map((n) => (
                    <div key={n} className={`w-3 h-3 rounded-sm border ${getColorForCount(n)}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}
