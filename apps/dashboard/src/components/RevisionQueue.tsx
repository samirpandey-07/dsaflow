'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock } from 'lucide-react';

interface Problem {
    id: string;
    problem_name: string;
    topic: string;
    difficulty: string;
    next_revision_at: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';

async function getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

export default function RevisionQueue() {
    const [queue, setQueue] = useState<Problem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const res = await fetch(`${API_BASE}/revision-queue`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setQueue(data);
            }
        } catch (err) {
            console.error('Failed to fetch revision queue:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        // Removed separate subscription here to avoid redundant API calls triggered by DB changes.
        // The parent Dashboard component already listens for table changes and refreshes its own children.
        // If specific 'revision-queue' refreshes are needed, we can re-add with debouncing.
    }, []);

    const handleRevise = async (id: string) => {
        try {
            const token = await getToken();
            if (!token) return;

            await fetch(`${API_BASE}/problems/${id}/revise`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to mark as revised:', err);
        }
    };

    if (loading) return <div className="h-40 animate-pulse bg-white/5 rounded-xl" />;

    if (queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-xl border border-white/10">
                <CheckCircle className="w-8 h-8 text-green-400 mb-2 opacity-60" />
                <p className="text-sm font-medium text-white/70">Queue Clear!</p>
                <p className="text-[11px] text-muted-foreground mt-1 text-pretty">No problems due for revision today.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {queue.map((item) => (
                <div key={item.id} className="group glass-panel-sm p-4 rounded-xl flex items-center justify-between hover:bg-white/[0.04] transition-all">
                    <div className="flex-1 min-w-0 mr-4">
                        <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {item.problem_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                {item.topic}
                            </span>
                            <span className="text-[10px] text-white/40">•</span>
                            <span className={`text-[10px] font-bold ${item.difficulty === 'Hard' ? 'text-red-400' :
                                item.difficulty === 'Medium' ? 'text-orange-400' : 'text-blue-400'
                                }`}>
                                {item.difficulty}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => handleRevise(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-all border border-primary/20 active:scale-95"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Done
                    </button>
                </div>
            ))}
        </div>
    );
}
