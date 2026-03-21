'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Sparkles, TrendingUp } from 'lucide-react';

interface InsightsPanelProps {
    insights: {
        strongest_topic: string | null;
        recommended_focus: string;
        next_problem_suggestion: string;
        difficulty_progression: string;
        patterns: string[];
        weak_topics: { topic: string; count: number }[];
    } | undefined;
    loading?: boolean;
}

const itemVars = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function InsightsPanel({ insights, loading }: InsightsPanelProps) {
    if (loading) {
        return <div className="h-full min-h-[300px] rounded-[38px] bg-white/[0.02] animate-pulse border border-white/5" />;
    }

    if (!insights) {
        return null;
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                visible: { transition: { staggerChildren: 0.1 } },
            }}
            className="group relative flex h-full flex-col overflow-hidden rounded-[38px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent p-8 backdrop-blur-3xl shadow-2xl"
        >
            <div className="absolute top-0 right-0 p-6 opacity-10 transition-opacity group-hover:opacity-20">
                <BrainCircuit className="h-24 w-24 text-emerald-400" />
            </div>

            <motion.div variants={itemVars} className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <p className="font-outfit text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-400">AI Intelligence</p>
                    <h3 className="mt-2 font-outfit text-3xl font-black text-white">Pattern Recognition</h3>
                </div>
            </motion.div>

            <div className="grid flex-1 gap-5 md:grid-cols-2">
                <motion.div variants={itemVars} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                        Targeted Focus
                    </div>
                    <p className="text-sm leading-relaxed text-white/50 font-medium">{insights.recommended_focus}</p>
                </motion.div>

                <motion.div variants={itemVars} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                        <TrendingUp className="h-4 w-4 text-sky-400" />
                        Progression Logic
                    </div>
                    <p className="text-sm leading-relaxed text-white/50 font-medium">{insights.difficulty_progression}</p>
                </motion.div>
            </div>

            <motion.div variants={itemVars} className="mt-5 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Next Recommended Path</p>
                <p className="mt-2 text-sm font-semibold text-white/80">{insights.next_problem_suggestion}</p>
            </motion.div>

            <motion.div variants={itemVars} className="mt-6 flex flex-wrap gap-2">
                {insights.strongest_topic && (
                    <span className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-1.5 text-xs font-bold text-sky-300 backdrop-blur-md">
                        Mastery: {insights.strongest_topic}
                    </span>
                )}
                {insights.weak_topics.map((topic) => (
                    <span key={topic.topic} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-1.5 text-xs font-bold text-rose-300 backdrop-blur-md">
                        Weakness: {topic.topic}
                    </span>
                ))}
                {insights.patterns.slice(0, 2).map((pattern) => (
                    <span key={pattern} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/40">
                        {pattern}
                    </span>
                ))}
            </motion.div>
        </motion.div>
    );
}
