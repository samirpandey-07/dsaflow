'use client';

import React, { useEffect, useState } from 'react';
import { Bot, X, Zap, Shield, AlertTriangle, Lightbulb } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Analysis {
    time_complexity: string;
    space_complexity: string;
    bottlenecks: string;
    recommendations: string;
    alternative_approach?: string;
    pattern_detected?: string;
    edge_cases: string[];
}

interface CodeAnalysisModalProps {
    problemId: string;
    problemName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function CodeAnalysisModal({ problemId, problemName, isOpen, onClose }: CodeAnalysisModalProps) {
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchAnalysis = async () => {
                setLoading(true);
                try {
                    const data = await apiFetch<Analysis>(`/problems/${problemId}/analyze`, { method: 'POST' });
                    setAnalysis(data);
                } catch (err) {
                    console.error('Failed to fetch analysis:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchAnalysis();
        }
    }, [isOpen, problemId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-[#0a0a0b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-primary" />

                <div className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Bot className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">AI Code Analysis</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">{problemName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="space-y-6">
                            <div className="h-20 bg-white/5 animate-pulse rounded-2xl" />
                            <div className="h-32 bg-white/5 animate-pulse rounded-2xl" />
                            <div className="h-24 bg-white/5 animate-pulse rounded-2xl" />
                        </div>
                    ) : analysis ? (
                        <div className="space-y-6">
                            {/* Complexity Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time Complexity</span>
                                    </div>
                                    <p className="text-lg font-mono font-bold text-white">{analysis.time_complexity}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Space Complexity</span>
                                    </div>
                                    <p className="text-lg font-mono font-bold text-white">{analysis.space_complexity}</p>
                                </div>
                            </div>

                            {/* Insights */}
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="mt-1 p-1.5 bg-red-500/10 rounded-lg h-fit">
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-1">Bottlenecks</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.bottlenecks}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="mt-1 p-1.5 bg-green-500/10 rounded-lg h-fit">
                                        <Lightbulb className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-1">Recommendations</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.recommendations}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Edge Cases */}
                            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                                <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">Crucial Edge Cases</h4>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.edge_cases.map((ec, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-black/40 border border-white/5 rounded-lg text-xs text-white/70">
                                            {ec}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {(analysis.alternative_approach || analysis.pattern_detected) && (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {analysis.alternative_approach && (
                                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                            <h4 className="text-sm font-bold text-white mb-1">Alternative Approach</h4>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.alternative_approach}</p>
                                        </div>
                                    )}
                                    {analysis.pattern_detected && (
                                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                            <h4 className="text-sm font-bold text-white mb-1">Pattern Detected</h4>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.pattern_detected}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-muted-foreground">Failed to load analysis.</div>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all text-sm"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
