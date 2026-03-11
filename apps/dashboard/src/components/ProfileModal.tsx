'use client';

import React, { useState } from 'react';
import { User as UserIcon, X, Loader2, Save, Link as LinkIcon, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface ProfileModalProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export default function ProfileModal({ user, isOpen, onClose, onUpdate }: ProfileModalProps) {
    const [name, setName] = useState(user.user_metadata?.full_name || '');
    const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSave = async () => {
        setLoading(true);
        setError('');

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    full_name: name.trim(),
                    avatar_url: avatarUrl.trim()
                }
            });

            if (updateError) throw updateError;

            onUpdate(); // Trigger parent re-render for new names
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-[#0a0a0b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <UserIcon className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Profile Settings</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Email (Read Only) */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Email</label>
                            <input
                                type="text"
                                value={user.email}
                                disabled
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white/50 cursor-not-allowed"
                            />
                        </div>

                        {/* Display Name */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Display Name</label>
                            <div className="relative">
                                <Edit3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., John Doe"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Avatar URL */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">Avatar Image URL</label>
                            <div className="relative">
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="url"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.png"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground px-1 mt-2">Leave blank to use default initials</p>
                        </div>

                        {/* Avatar Preview */}
                        <div className="flex justify-center py-2">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/60 to-blue-500/60 flex items-center justify-center text-xl font-bold text-white border-2 border-white/10 overflow-hidden shadow-lg">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                                ) : (
                                    name ? name.charAt(0).toUpperCase() : (user.email?.[0] || 'U').toUpperCase()
                                )}
                            </div>
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
