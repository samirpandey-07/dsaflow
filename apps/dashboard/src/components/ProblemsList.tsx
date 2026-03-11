import React, { useState, useMemo } from 'react';
import CodeAnalysisModal from './CodeAnalysisModal';
import NoteModal from './NoteModal';
import CodeViewerModal from './CodeViewerModal';
import { Bot, MessageSquare, Code2, ExternalLink, Search, Filter } from 'lucide-react';

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
}

export default function ProblemsList({ problems, loading }: { problems: Problem[], loading: boolean }) {
    // Action Modals State
    const [selectedAnalysis, setSelectedAnalysis] = useState<{ id: string, name: string } | null>(null);
    const [selectedNote, setSelectedNote] = useState<{ id: string, name: string } | null>(null);
    const [selectedCode, setSelectedCode] = useState<{ name: string, code: string | null, language: string } | null>(null);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTopic, setFilterTopic] = useState('All');
    const [filterDifficulty, setFilterDifficulty] = useState('All');
    const [filterPlatform, setFilterPlatform] = useState('All');

    // Extract unique options for dropdowns
    const uniqueTopics = useMemo(() => Array.from(new Set(problems.map(p => p.topic))), [problems]);
    const uniquePlatforms = useMemo(() => Array.from(new Set(problems.map(p => p.platform).filter(Boolean))), [problems]);

    // Apply strict filtering
    const filteredProblems = useMemo(() => {
        return problems.filter(p => {
            const matchSearch = p.problem_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchTopic = filterTopic === 'All' || p.topic === filterTopic;
            const matchDifficulty = filterDifficulty === 'All' || p.difficulty === filterDifficulty;
            const matchPlatform = filterPlatform === 'All' || p.platform === filterPlatform;
            return matchSearch && matchTopic && matchDifficulty && matchPlatform;
        });
    }, [problems, searchQuery, filterTopic, filterDifficulty, filterPlatform]);

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl border border-white/5"></div>
                ))}
            </div>
        );
    }

    if (!problems.length) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
                <p className="mb-2">No problems logged yet.</p>
                <p className="text-sm">Start coding in VS Code and watch them appear here magically!</p>
            </div>
        );
    }

    const getDifficultyColor = (diff: string) => {
        switch (diff?.toLowerCase()) {
            case 'easy': return 'text-blue-300 bg-blue-500/20 border-blue-400/40';
            case 'medium': return 'text-orange-300 bg-orange-500/20 border-orange-400/40';
            case 'hard': return 'text-red-300 bg-red-500/20 border-red-400/40';
            default: return 'text-muted-foreground bg-white/10 border-white/20';
        }
    };

    return (
        <div className="w-full flex flex-col gap-4">

            {/* 🔍 Search & Filter Control Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#0a0a0b] p-4 rounded-xl border border-white/10 shadow-lg">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search problems..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                </div>

                <div className="flex gap-2 items-center flex-wrap md:flex-nowrap">
                    <Filter className="w-4 h-4 text-muted-foreground hidden md:block" />

                    <select
                        value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                    >
                        <option value="All">All Topics</option>
                        {uniqueTopics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                        value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                    >
                        <option value="All">All Difficulties</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>

                    {uniquePlatforms.length > 0 && (
                        <select
                            value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                        >
                            <option value="All">All Platforms</option>
                            {uniquePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* 📋 Results Table */}
            <div className="overflow-x-auto w-full bg-[#0a0a0b] rounded-xl border border-white/10 shadow-lg">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-sm font-medium text-muted-foreground bg-white/[0.02]">
                            <th className="py-3 px-4">Problem</th>
                            <th className="py-3 px-4">Topic</th>
                            <th className="py-3 px-4">Difficulty</th>
                            <th className="py-3 px-4">Platform</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredProblems.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                    No problems match your search/filters.
                                </td>
                            </tr>
                        ) : filteredProblems.map((problem) => (
                            <tr key={problem.id} className="group hover:bg-white/[0.04] transition-colors">
                                <td className="py-4 px-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                                {problem.problem_name}
                                            </span>
                                            {problem.problem_url && (
                                                <a href={problem.problem_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-muted-foreground hover:text-emerald-400 transition-colors p-1"
                                                    title="Open on platform"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground opacity-60">
                                            {new Date(problem.solved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-muted-foreground">
                                    <span className="px-2.5 py-1 rounded-full bg-white/5 text-xs font-medium border border-white/5 backdrop-blur-sm">
                                        {problem.topic}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${getDifficultyColor(problem.difficulty)}`}>
                                        {problem.difficulty || 'N/A'}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {problem.platform || 'Other'}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <div className="flex justify-end gap-2 items-center">
                                        <span className="text-xs font-medium text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity mr-1">
                                            {problem.language}
                                        </span>

                                        {/* View Code button */}
                                        <button
                                            onClick={() => setSelectedCode({ name: problem.problem_name, code: problem.code_snippet, language: problem.language })}
                                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg transition-all active:scale-95"
                                            title="View Saved Code"
                                        >
                                            <Code2 className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Notes button */}
                                        <button
                                            onClick={() => setSelectedNote({ id: problem.id, name: problem.problem_name })}
                                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-all active:scale-95"
                                            title="View / Add Notes"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                        </button>

                                        {/* AI Analyze button */}
                                        <button
                                            onClick={() => setSelectedAnalysis({ id: problem.id, name: problem.problem_name })}
                                            className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-all active:scale-95"
                                            title="Analyze with AI"
                                        >
                                            <Bot className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {selectedAnalysis && (
                <CodeAnalysisModal
                    problemId={selectedAnalysis.id as any}
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
        </div>
    );
}
