'use client';

import React, { useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Code2, ExternalLink, Filter, MessageSquare, RefreshCcw, Search, Trash2, ChevronDown } from 'lucide-react';
import CodeAnalysisModal from './CodeAnalysisModal';
import NoteModal from './NoteModal';
import CodeViewerModal from './CodeViewerModal';
import { apiFetch } from '../lib/api';

interface Problem {
    id: string;
    problem_name: string;
    topic: string;
    difficulty: string;
    language: string;
    platform: string;
    problem_url: string | null;
    code_snippet: string | null;
    solved_at: string;
    revision_count: number;
    next_revision_at: string | null;
}

const difficulties = ['All', 'Easy', 'Medium', 'Hard'];
const revisionOptions = ['all', 'due', 'upcoming'];

const rowVars = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
};

export default function ProblemsList() {
    const queryClient = useQueryClient();
    const [selectedAnalysis, setSelectedAnalysis] = useState<{ id: string; name: string } | null>(null);
    const [selectedNote, setSelectedNote] = useState<{ id: string; name: string } | null>(null);
    const [selectedCode, setSelectedCode] = useState<{ name: string; code: string | null; language: string } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterTopic, setFilterTopic] = useState('All');
    const [filterDifficulty, setFilterDifficulty] = useState('All');
    const [filterPlatform, setFilterPlatform] = useState('All');
    const [revisionStatus, setRevisionStatus] = useState('all');
    const [sortBy, setSortBy] = useState('solved_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const queryKey = ['problems-table', searchQuery, filterTopic, filterDifficulty, filterPlatform, revisionStatus, sortBy, sortOrder];

    const problemsQuery = useInfiniteQuery({
        queryKey,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams();
            params.set('limit', '20');
            params.set('sort_by', sortBy);
            params.set('sort_order', sortOrder);
            if (pageParam) params.set('cursor', pageParam);
            if (searchQuery) params.set('search', searchQuery);
            if (filterTopic !== 'All') params.set('topic', filterTopic);
            if (filterDifficulty !== 'All') params.set('difficulty', filterDifficulty);
            if (filterPlatform !== 'All') params.set('platform', filterPlatform);
            if (revisionStatus !== 'all') params.set('revision_status', revisionStatus);
            return apiFetch<{ items: Problem[]; next_cursor: string | null; has_next_page: boolean }>(`/problems?${params.toString()}`);
        },
        getNextPageParam: (lastPage) => lastPage.has_next_page ? lastPage.next_cursor : undefined,
    });

    const allProblems = useMemo(
        () => problemsQuery.data?.pages.flatMap((page) => page.items) || [],
        [problemsQuery.data],
    );

    const topicOptions = useMemo(
        () => ['All', ...Array.from(new Set(allProblems.map((problem) => problem.topic))).sort()],
        [allProblems],
    );
    const platformOptions = useMemo(
        () => ['All', ...Array.from(new Set(allProblems.map((problem) => problem.platform || 'Other'))).sort()],
        [allProblems],
    );

    async function deleteProblem(id: string) {
        await apiFetch(`/problems/${id}`, { method: 'DELETE' });
        await queryClient.invalidateQueries({ queryKey: ['problems-table'] });
        await queryClient.invalidateQueries({ queryKey: ['overview'] });
        await queryClient.invalidateQueries({ queryKey: ['activity'] });
        await queryClient.invalidateQueries({ queryKey: ['topics'] });
        await queryClient.invalidateQueries({ queryKey: ['platforms'] });
        await queryClient.invalidateQueries({ queryKey: ['revisions'] });
    }

    const loading = problemsQuery.isLoading;

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
        case 'Easy':
            return 'text-sky-400 border-sky-400/20 bg-sky-400/5';
        case 'Medium':
            return 'text-amber-400 border-amber-400/20 bg-amber-400/5';
        case 'Hard':
            return 'text-rose-400 border-rose-400/20 bg-rose-400/5';
        default:
            return 'text-white/40 border-white/10 bg-white/5';
        }
    };

    return (
        <div className="flex flex-col space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <div className="relative xl:col-span-2">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for problems..."
                        className="w-full rounded-2xl border border-white/5 bg-white/[0.03] py-3.5 pl-11 pr-4 font-inter text-sm text-white placeholder:text-white/20 outline-none transition focus:border-emerald-500/30 focus:bg-white/[0.05]"
                    />
                </div>

                {[
                    { value: filterTopic, setter: setFilterTopic, options: topicOptions, label: 'Topic' },
                    { value: filterDifficulty, setter: setFilterDifficulty, options: difficulties, label: 'Difficulty' },
                    { value: filterPlatform, setter: setFilterPlatform, options: platformOptions, label: 'Platform' },
                    { value: revisionStatus, setter: setRevisionStatus, options: revisionOptions, label: 'Status' }
                ].map((select, i) => (
                    <div key={i} className="relative">
                        <select
                            value={select.value}
                            onChange={(e) => select.setter(e.target.value)}
                            className="w-full appearance-none rounded-2xl border border-white/5 bg-white/[0.03] py-3.5 pl-4 pr-10 font-inter text-sm font-semibold text-white/60 outline-none transition hover:border-white/10 focus:border-emerald-500/30"
                        >
                            {select.options.map((opt) => (
                                <option key={opt} value={opt} className="bg-[#03080c] text-white">{opt}</option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                    </div>
                ))}

                <button
                    onClick={() => setSortOrder(curr => curr === 'asc' ? 'desc' : 'asc')}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 font-inter text-xs font-bold uppercase tracking-wider text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                    {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </button>
            </div>

            <div className="overflow-hidden rounded-[38px] border border-white/10 bg-white/[0.01] backdrop-blur-3xl shadow-2xl">
                <div className="border-b border-white/5 bg-white/[0.02] p-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-outfit text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Archive</p>
                            <h3 className="mt-2 font-outfit text-3xl font-black text-white">Problem Vault</h3>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-5 py-2.5">
                            <Filter className="h-4 w-4 text-emerald-400" />
                            <span className="font-outfit text-sm font-bold text-white/40">{allProblems.length} Collected</span>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                {['Problem', 'Topic', 'Difficulty', 'Platform', 'Revision', 'Actions'].map((h) => (
                                    <th key={h} className="px-8 py-5 font-outfit text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-white/[0.02]">
                                        <td colSpan={6} className="px-8 py-6">
                                            <div className="h-12 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {allProblems.map((problem) => (
                                        <motion.tr
                                            key={problem.id}
                                            variants={rowVars}
                                            initial="hidden"
                                            animate="visible"
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            className="group border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-inter text-base font-bold text-white transition-colors group-hover:text-emerald-400">
                                                        {problem.problem_name}
                                                    </span>
                                                    {problem.problem_url && (
                                                        <a href={problem.problem_url} target="_blank" rel="noreferrer" className="opacity-0 transition-opacity group-hover:opacity-100">
                                                            <ExternalLink className="h-4 w-4 text-white/20 hover:text-emerald-400" />
                                                        </a>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-[10px] font-bold text-white/20 uppercase tracking-wider">
                                                    {new Date(problem.solved_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="font-inter text-sm font-semibold text-white/50">{problem.topic}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex rounded-xl border px-3 py-1 font-outfit text-[10px] font-black uppercase tracking-wider ${getDifficultyColor(problem.difficulty)}`}>
                                                    {problem.difficulty}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-bold text-white/40">{problem.platform}</td>
                                            <td className="px-8 py-6">
                                                <div className="font-inter text-sm font-black text-white/60">REV {problem.revision_count}</div>
                                                <div className="text-[10px] font-bold text-white/20 uppercase">
                                                    {problem.next_revision_at ? new Date(problem.next_revision_at).toLocaleDateString() : 'Pending'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-end gap-2">
                                                    {[
                                                        { icon: Code2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', action: () => setSelectedCode({ name: problem.problem_name, code: problem.code_snippet, language: problem.language }) },
                                                        { icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20', action: () => setSelectedNote({ id: problem.id, name: problem.problem_name }) },
                                                        { icon: Bot, color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/20', action: () => setSelectedAnalysis({ id: problem.id, name: problem.problem_name }) },
                                                        { icon: RefreshCcw, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', action: async () => {
                                                            await apiFetch(`/problems/${problem.id}/revise`, { method: 'POST', body: JSON.stringify({ action: 'complete' }) });
                                                            queryClient.invalidateQueries({ queryKey: ['problems-table'] });
                                                            queryClient.invalidateQueries({ queryKey: ['revisions'] });
                                                        } },
                                                        { icon: Trash2, color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', action: () => deleteProblem(problem.id) }
                                                    ].map((btn, idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            whileHover={{ scale: 1.1, y: -2 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={btn.action}
                                                            className={`rounded-xl border ${btn.border} ${btn.bg} p-2 ${btn.color} transition-all hover:shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]`}
                                                        >
                                                            <btn.icon className="h-4 w-4" />
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>

                {problemsQuery.hasNextPage && (
                    <div className="flex justify-center border-t border-white/5 bg-white/[0.01] p-8">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={problemsQuery.isFetchingNextPage}
                            onClick={() => problemsQuery.fetchNextPage()}
                            className="rounded-3xl border border-white/10 bg-white/5 px-10 py-4 font-outfit text-sm font-black uppercase tracking-widest text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            {problemsQuery.isFetchingNextPage ? 'Loading...' : 'Expand Vault'}
                        </motion.button>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selectedAnalysis && (
                    <CodeAnalysisModal
                        problemId={selectedAnalysis.id}
                        problemName={selectedAnalysis.name}
                        isOpen={!!selectedAnalysis}
                        onClose={() => setSelectedAnalysis(null)}
                    />
                )}
                {selectedNote && (
                    <NoteModal
                        problemId={selectedNote.id}
                        problemName={selectedNote.name}
                        isOpen={!!selectedNote}
                        onClose={() => setSelectedNote(null)}
                    />
                )}
                {selectedCode && (
                    <CodeViewerModal
                        problemName={selectedCode.name}
                        codeSnippet={selectedCode.code}
                        language={selectedCode.language}
                        isOpen={!!selectedCode}
                        onClose={() => setSelectedCode(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
