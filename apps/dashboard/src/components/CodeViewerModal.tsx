'use client';

import React from 'react';
import { Code2, X, FileTerminal } from 'lucide-react';

interface CodeViewerModalProps {
    problemName: string;
    codeSnippet: string | null;
    language: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function CodeViewerModal({ problemName, codeSnippet, language, isOpen, onClose }: CodeViewerModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0a0a0b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />

                <div className="flex flex-col h-full bg-[url('/grid.svg')] bg-center p-6 md:p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-inner">
                                <Code2 className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    Saved Solution Snapshot
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                    <FileTerminal className="w-3.5 h-3.5" />
                                    {problemName} <span className="text-white/20 px-1">•</span> <span className="text-emerald-400 font-mono bg-emerald-400/10 px-1.5 py-0.5 rounded">{language}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                        >
                            <X className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-h-0 relative rounded-2xl border border-white/10 bg-[#161b22] overflow-hidden shadow-inner flex flex-col">
                        {/* Editor Header */}
                        <div className="h-9 border-b border-white/5 bg-[#0d1117] flex items-center px-4 shrink-0 gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                            </div>
                            <span className="ml-4 text-[11px] font-mono text-white/40">{problemName.toLowerCase().replace(/\s+/g, '_')}.{language === 'Python' ? 'py' : language === 'JavaScript' ? 'js' : language === 'TypeScript' ? 'ts' : language === 'C++' ? 'cpp' : language === 'Java' ? 'java' : 'txt'}</span>
                        </div>

                        {/* Code Scroll Area */}
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            {!codeSnippet ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                                    <Code2 className="w-8 h-8 opacity-20" />
                                    <p className="text-sm">No code snapshot was saved for this problem.</p>
                                </div>
                            ) : (
                                <pre className="text-sm font-mono text-gray-300 w-full h-full min-w-max">
                                    <code>{codeSnippet}</code>
                                </pre>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 pt-6 border-t border-white/5 flex justify-end shrink-0">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-lg shadow-white/5"
                        >
                            Close Viewer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
