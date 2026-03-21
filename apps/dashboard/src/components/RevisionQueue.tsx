'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, 
    Clock3, 
    SkipForward, 
    AlertCircle, 
    CalendarCheck, 
    Hourglass,
    Trophy,
    Zap,
    ArrowRight
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface RevisionItem {
    id: string;
    problem_name: string;
    topic: string;
    difficulty: string;
    next_revision_at: string;
    revision_count: number;
}

interface RevisionQueueProps {
    data?: {
        due_today: RevisionItem[];
        overdue: RevisionItem[];
        upcoming: RevisionItem[];
        counts: {
            due_today: number;
            overdue: number;
            upcoming: number;
        };
    };
    loading?: boolean;
    onRefresh?: () => void;
}

async function reviseProblem(id: string, action: 'complete' | 'snooze') {
    await apiFetch(`/problems/${id}/revise`, {
        method: 'POST',
        body: JSON.stringify(action === 'snooze' ? { action, days: 2 } : { action }),
    });
}

function difficultyTone(difficulty: string) {
    if (difficulty === 'Hard') return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
    if (difficulty === 'Medium') return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-sky-400 border-sky-500/20 bg-sky-500/10';
}

const itemVars = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 }
};

export default function RevisionQueue({ data, loading, onRefresh }: RevisionQueueProps) {
    const sections = [
        { 
            key: 'overdue', 
            title: 'Critical Attention', 
            items: data?.overdue || [], 
            accent: 'text-rose-400',
            icon: <AlertCircle className="h-4 w-4" />
        },
        { 
            key: 'due_today', 
            title: 'Due Today', 
            items: data?.due_today || [], 
            accent: 'text-amber-400',
            icon: <CalendarCheck className="h-4 w-4" />
        },
        { 
            key: 'upcoming', 
            title: 'Pipeline', 
            items: data?.upcoming?.slice(0, 4) || [], 
            accent: 'text-sky-400',
            icon: <Hourglass className="h-4 w-4" />
        },
    ];

    if (loading) {
        return (
            <div className="flex h-[500px] flex-col gap-6">
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-3xl bg-white/[0.03] animate-pulse border border-white/5" />
                    ))}
                </div>
                <div className="flex-1 rounded-[38px] bg-white/[0.02] animate-pulse border border-white/5" />
            </div>
        );
    }

    const totalDue = (data?.counts.overdue || 0) + (data?.counts.due_today || 0);

    return (
        <div className="flex h-full flex-col space-y-4">
            {/* High Impact Stats - More Compact */}
            <div className="grid grid-cols-3 gap-2.5">
                {[
                    { 
                        label: 'Overdue', 
                        count: data?.counts.overdue || 0, 
                        color: 'from-rose-500/15 to-rose-500/5 border-rose-500/20 text-rose-400',
                        glow: 'group-hover:bg-rose-500/20',
                        icon: <AlertCircle className="h-3.5 w-3.5 opacity-40" />
                    },
                    { 
                        label: 'Due Today', 
                        count: data?.counts.due_today || 0, 
                        color: 'from-amber-500/15 to-amber-500/5 border-amber-500/20 text-amber-400',
                        glow: 'group-hover:bg-amber-500/20',
                        icon: <Zap className="h-3.5 w-3.5 opacity-40" />
                    },
                    { 
                        label: 'Upcoming', 
                        count: data?.counts.upcoming || 0, 
                        color: 'from-sky-500/15 to-sky-500/5 border-sky-500/10 text-sky-400',
                        glow: 'group-hover:bg-sky-500/20',
                        icon: <Hourglass className="h-3.5 w-3.5 opacity-40" />
                    },
                ].map((stat, i) => (
                    <motion.div 
                        key={i} 
                        whileHover={{ y: -1, scale: 1.02 }}
                        className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br px-3 py-2.5 transition-all ${stat.color}`}
                    >
                        <div className="flex items-center justify-between">
                            <p className="font-outfit text-[8px] font-bold uppercase tracking-[0.2em] opacity-50">{stat.label}</p>
                            {stat.icon}
                        </div>
                        <p className="mt-1 font-outfit text-xl font-black tracking-tighter">{stat.count}</p>
                    </motion.div>
                ))}
            </div>

            {/* Main Queue Section - FIXED HEIGHT FEED */}
            <div className="flex-1 max-h-[380px] space-y-5 overflow-y-auto pr-2 custom-scrollbar transition-all">
                {totalDue === 0 && (data?.upcoming.length === 0) ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex h-full flex-col items-center justify-center py-8 text-center"
                    >
                        <div className="mb-3 rounded-full bg-emerald-500/5 p-3.5 ring-1 ring-emerald-500/10">
                            <Trophy className="h-6 w-6 text-emerald-400 opacity-60" />
                        </div>
                        <h3 className="font-outfit text-sm font-bold text-white/80">Peak Efficiency</h3>
                        <p className="mt-1 max-w-[150px] text-[10px] font-medium text-white/20 leading-relaxed">
                            Queue synchronized.
                        </p>
                    </motion.div>
                ) : (
                    sections.map((section) => (
                        <div key={section.key} className={section.items.length === 0 ? 'hidden' : ''}>
                            <div className="mb-2.5 flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <p className={`font-outfit text-[9px] font-black tracking-[0.2em] uppercase ${section.accent}`}>{section.title}</p>
                                </div>
                                <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">{section.items.length}</span>
                            </div>
                            
                            <motion.div
                                layout
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    visible: { transition: { staggerChildren: 0.05 } }
                                }}
                                className="space-y-2"
                            >
                                <AnimatePresence mode="popLayout">
                                    {section.items.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            variants={itemVars}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            className="group relative rounded-[18px] border border-white/5 bg-white/[0.01] p-3 transition-all hover:bg-white/[0.04] hover:border-white/10"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-outfit text-[13px] font-bold text-white/90 truncate transition-colors group-hover:text-amber-400">
                                                            {item.problem_name}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
                                                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-white/30 uppercase tracking-widest truncate">
                                                            {item.topic}
                                                        </span>
                                                        <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${difficultyTone(item.difficulty)}`}>
                                                            {item.difficulty[0]}
                                                        </span>
                                                        <div className="flex items-center gap-1 rounded-md bg-sky-400/5 px-1.5 py-0.5 text-[8px] font-bold text-sky-400/40 uppercase tracking-widest">
                                                            <span>S{item.revision_count || 1}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-1.5">
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={async () => {
                                                            await reviseProblem(item.id, 'snooze');
                                                            onRefresh?.();
                                                        }}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-white/20 transition-colors hover:text-white"
                                                    >
                                                        <SkipForward className="h-3.5 w-3.5" />
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={async () => {
                                                            await reviseProblem(item.id, 'complete');
                                                            onRefresh?.();
                                                        }}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/10 bg-emerald-500/5 text-emerald-400/60 transition-colors hover:text-emerald-400"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    ))
                )}
            </div>

            {/* Integrated Legend/Footer - Slimmed */}
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-3">
                <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Clock3 className="h-3 w-3 text-white/20" />
                        <div className="flex items-center gap-1 text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">
                            <span>1d</span>
                            <ArrowRight className="h-2 w-2 opacity-30" />
                            <span>3d</span>
                            <ArrowRight className="h-2 w-2 opacity-30" />
                            <span>7d</span>
                            <ArrowRight className="h-2 w-2 opacity-30" />
                            <span className="text-sky-400/40">30d</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
