'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Layers } from 'lucide-react';

interface Problem {
    id: string;
    problem_name: string;
    topic: string;
    solved_at: string;
}

interface ActivityPoint {
    date: string;
    count: number;
}

function getColorForCount(count: number): string {
    if (count === 0) return 'bg-white/[0.03] border-white/[0.05]';
    if (count === 1) return 'bg-emerald-500/20 border-emerald-500/30';
    if (count === 2) return 'bg-emerald-500/40 border-emerald-500/50';
    if (count === 3) return 'bg-emerald-500/70 border-emerald-500/80';
    return 'bg-emerald-400 border-emerald-300';
}

export default function ActivityHeatmap({
    activity,
    problems,
}: {
    activity: ActivityPoint[];
    problems: Problem[];
}) {
    const [selectedDate, setSelectedDate] = useState<string | null>(activity[activity.length - 1]?.date ?? null);

    const problemsByDate = useMemo(() => {
        const grouped: Record<string, Problem[]> = {};
        for (const problem of problems) {
            const key = problem.solved_at.slice(0, 10);
            grouped[key] = grouped[key] || [];
            grouped[key].push(problem);
        }
        return grouped;
    }, [problems]);

    const padded = useMemo(() => {
        const firstDayOfWeek = activity.length ? new Date(activity[0].date).getDay() : 0;
        return [...Array(firstDayOfWeek).fill(null), ...activity];
    }, [activity]);

    const weeks: (ActivityPoint | null)[][] = [];
    for (let index = 0; index < padded.length; index += 7) {
        weeks.push(padded.slice(index, index + 7));
    }

    const selectedProblems = selectedDate ? (problemsByDate[selectedDate] || []) : [];
    const totalSolves = activity.reduce((sum, point) => sum + point.count, 0);
    const activeDays = activity.filter((point) => point.count > 0).length;

    return (
        <div className="flex h-full flex-col space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-500/10 p-2.5">
                        <Calendar className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-outfit text-xl font-bold text-white">Daily Output</h3>
                        <p className="text-xs font-medium text-white/30">{activity.length} day consistency window</p>
                    </div>
                </div>
                <div className="flex gap-6 rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-3">
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Total</p>
                        <p className="font-outfit text-lg font-black text-white">{totalSolves}</p>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Active</p>
                        <p className="font-outfit text-lg font-black text-white">{activeDays}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <div className="flex gap-2 min-w-max">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-2">
                                {week.map((day, dayIndex) => {
                                    if (!day) return <div key={`blank-${dayIndex}`} className="h-4 w-4" />;
                                    const isSelected = selectedDate === day.date;
                                    return (
                                        <motion.button
                                            key={day.date}
                                            whileHover={{ scale: 1.3, zIndex: 10 }}
                                            onClick={() => setSelectedDate(day.date)}
                                            className={`h-4 w-4 rounded-[4px] border transition-shadow ${getColorForCount(day.count)} ${
                                                isSelected ? 'ring-2 ring-emerald-400 ring-offset-4 ring-offset-[#03080c] shadow-[0_0_15px_rgba(52,211,153,0.3)]' : ''
                                            }`}
                                            title={`${day.date}: ${day.count} solves`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="font-outfit text-xs font-bold uppercase tracking-widest text-emerald-400">Activity Detail</p>
                        <span className="text-[10px] font-bold text-white/20">{selectedDate}</span>
                    </div>
                    
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {selectedProblems.length ? (
                                selectedProblems.map((problem) => (
                                    <motion.div
                                        key={problem.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-white/5 p-2">
                                                <Layers className="h-3.5 w-3.5 text-white/40" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white/90 leading-tight">{problem.problem_name}</p>
                                                <p className="mt-1 text-[10px] font-bold text-white/30 uppercase tracking-tighter">{problem.topic}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10"
                                >
                                    <p className="text-xs font-medium text-white/20">No entries recorded</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
