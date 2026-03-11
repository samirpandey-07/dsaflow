'use client';

import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Plus } from 'lucide-react';
import { getAuthToken } from '../lib/auth';

interface Note {
    id: string;
    content: string;
    created_at: string;
}

interface NoteModalProps {
    problemId: string;
    problemName: string;
    isOpen: boolean;
    onClose: () => void;
}

const API_BASE = 'http://localhost:3001/api';

export default function NoteModal({ problemId, problemName, isOpen, onClose }: NoteModalProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) fetchNotes();
    }, [isOpen, problemId]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${API_BASE}/problems/${problemId}/notes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setNotes(await res.json());
        } catch (e) {
            console.error('Failed to fetch notes:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newNote.trim()) return;
        setSaving(true);
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${API_BASE}/notes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ problem_id: problemId, note: newNote.trim() })
            });
            if (res.ok) {
                setNewNote('');
                await fetchNotes();
            }
        } catch (e) {
            console.error('Failed to save note:', e);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-[#111114] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white leading-none">{problemName}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Notes & Insights</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Notes List */}
                <div className="p-6 space-y-3 max-h-64 overflow-y-auto">
                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2].map(i => <div key={i} className="h-12 bg-white/5 animate-pulse rounded-xl" />)}
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No notes yet. Add your first insight below!
                        </div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                <p className="text-sm text-white/90 leading-relaxed">{note.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-2">
                                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* Add Note */}
                <div className="p-6 border-t border-white/10">
                    <div className="flex gap-3">
                        <textarea
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder="Add an insight, edge case, or complexity note..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors"
                            rows={2}
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving || !newNote.trim()}
                            className="px-4 py-2 self-end bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
