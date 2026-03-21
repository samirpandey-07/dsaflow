'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SettingsPage() {
    const router = useRouter();
    const [userEmail, setUserEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.replace('/login');
            } else {
                setUserEmail(session.user.email || '');
            }
        });
    }, [router, setUserEmail]);

    const handleSendDigest = async () => {
        setSending(true);
        setResult(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';
            const res = await fetch(`${apiBase}/email/send-digest`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            const data = await res.json();

            if (!res.ok || data.status === 'error') {
                setResult({ type: 'error', message: data.message });
            } else {
                setResult({ type: 'success', message: data.message });
            }
        } catch {
            setResult({ type: 'error', message: 'Failed to reach the API. Is the server running?' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] p-8 md:p-16 text-white">
            {/* Background blobs */}
            <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
                {/* Back button */}
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>

                <h1 className="text-3xl font-extrabold tracking-tight mb-2">Settings</h1>
                <p className="text-white/50 text-base mb-10">Manage your DSAFlow notifications and preferences.</p>

                {/* Email Digest Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
                            <Mail className="w-6 h-6 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Weekly Email Digest</h2>
                            <p className="text-sm text-white/50 mt-1">
                                Every Monday at 9 AM UTC you&apos;ll receive a personalized summary of your coding activity, streak, difficulty breakdown, top topics, and recent solves.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">Digest sent to</p>
                            <p className="text-white font-medium">{userEmail || '—'}</p>
                        </div>

                        <div className="bg-[#0f2027] border border-blue-900/30 rounded-xl p-4">
                            <p className="text-xs text-blue-400 font-semibold mb-1">📅 Schedule</p>
                            <p className="text-sm text-white/70">Automatically sent every <strong className="text-white">Monday at 9:00 AM UTC</strong>. No action required &mdash; it&apos;s fully automatic once Redis is configured.</p>
                        </div>

                        {/* Manual Trigger */}
                        <div className="pt-2">
                            <p className="text-sm text-white/50 mb-3">Want to test right now? Click below to send yourself the digest immediately.</p>
                            <button
                                onClick={handleSendDigest}
                                disabled={sending}
                                className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? 'Sending...' : 'Send Test Digest Now'}
                            </button>
                        </div>

                        {/* Result feedback */}
                        {result && (
                            <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.type === 'success'
                                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                                }`}>
                                {result.type === 'success'
                                    ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                                    : <XCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                                <p className="text-sm font-medium">{result.message}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Setup Instructions */}
                <div className="mt-6 bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white/70 mb-3">⚙️ Setup Instructions</h3>
                    <ol className="text-sm text-white/50 space-y-2 list-decimal list-inside">
                        <li>Get your free API key from <a href="https://resend.com/api-keys" target="_blank" className="text-violet-400 hover:underline">resend.com/api-keys</a></li>
                        <li>Open <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">apps/api/.env</code></li>
                        <li>Set <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">RESEND_API_KEY=re_...</code> with your key</li>
                        <li>Optionally set <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">FROM_EMAIL=</code> to your verified Resend domain</li>
                        <li>Restart the API server: <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">node index.js</code></li>
                        <li>Come back here and click &quot;Send Test Digest&quot;</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
