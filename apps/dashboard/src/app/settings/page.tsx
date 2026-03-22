'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Copy, Globe, Import, Loader2, Mail, Send, Target, Trash2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { API_BASE, apiFetch } from '../../lib/api';

interface GoalItem {
    id: string;
    title: string;
    metric: string;
    period: string;
    target_count: number;
    current_value: number;
    progress_pct: number;
}

interface GoalResponse {
    goals: GoalItem[];
}

interface PublicProfile {
    slug: string;
    display_name: string;
    avatar_url?: string | null;
    headline?: string | null;
    bio?: string | null;
    is_public: boolean;
    share_badge: boolean;
    interview_readiness: number;
}

interface PlatformProfile {
    id: string;
    platform: string;
    handle: string;
    solved_count: number;
    imported_problem_count: number;
    rank_label?: string | null;
    last_synced_at: string;
}

type ResultState = { type: 'success' | 'error'; message: string } | null;

const metricOptions = [
    { value: 'weekly_solves', label: 'Weekly solves' },
    { value: 'monthly_solves', label: 'Monthly solves' },
    { value: 'hard_solves', label: 'Hard problems' },
    { value: 'topic_solves', label: 'Topic solves' },
    { value: 'platform_solves', label: 'Platform solves' },
    { value: 'streak_days', label: 'Streak days' },
];

const periodOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'all_time', label: 'All time' },
];

export default function SettingsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [mounted, setMounted] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [digestResult, setDigestResult] = useState<ResultState>(null);
    const [importResult, setImportResult] = useState<ResultState>(null);
    const [profileResult, setProfileResult] = useState<ResultState>(null);
    const [sendingDigest, setSendingDigest] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingGoal, setSavingGoal] = useState(false);
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [profileForm, setProfileForm] = useState({
        slug: '',
        display_name: '',
        avatar_url: '',
        headline: '',
        bio: '',
        is_public: false,
        share_badge: true,
    });
    const [goalForm, setGoalForm] = useState({
        title: '',
        metric: 'weekly_solves',
        period: 'weekly',
        target_count: 5,
        focus_topic: '',
        focus_platform: '',
    });
    const [handles, setHandles] = useState({ codeforces: '', leetcode: '', geeksforgeeks: '' });
    const [csvText, setCsvText] = useState('');

    useEffect(() => {
        setMounted(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.replace('/login');
                return;
            }
            setUserEmail(session.user.email || '');
        });
    }, [router]);

    const profileQuery = useQuery({
        queryKey: ['public-profile'],
        enabled: mounted,
        queryFn: () => apiFetch<PublicProfile>('/public-profiles/me'),
    });
    const goalsQuery = useQuery({
        queryKey: ['goals-settings'],
        enabled: mounted,
        queryFn: () => apiFetch<GoalResponse>('/goals'),
    });
    const profilesQuery = useQuery({
        queryKey: ['platform-profiles'],
        enabled: mounted,
        queryFn: () => apiFetch<PlatformProfile[]>('/platform-profiles'),
    });

    useEffect(() => {
        if (!profileQuery.data) return;
        setProfileForm({
            slug: profileQuery.data.slug || '',
            display_name: profileQuery.data.display_name || '',
            avatar_url: profileQuery.data.avatar_url || '',
            headline: profileQuery.data.headline || '',
            bio: profileQuery.data.bio || '',
            is_public: profileQuery.data.is_public || false,
            share_badge: profileQuery.data.share_badge ?? true,
        });
    }, [profileQuery.data]);

    const siteBase = useMemo(() => process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : ''), []);
    const publicUrl = profileForm.slug ? `${siteBase}/u/${profileForm.slug}` : '';
    const badgeUrl = profileForm.slug ? `${API_BASE}/public-profiles/${profileForm.slug}/badge.svg` : '';
    const badgeMarkdown = publicUrl && badgeUrl ? `[![DSAFlow](${badgeUrl})](${publicUrl})` : '';

    async function refreshQueries() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['public-profile'] }),
            queryClient.invalidateQueries({ queryKey: ['goals-settings'] }),
            queryClient.invalidateQueries({ queryKey: ['platform-profiles'] }),
            queryClient.invalidateQueries({ queryKey: ['goals'] }),
            queryClient.invalidateQueries({ queryKey: ['readiness'] }),
            queryClient.invalidateQueries({ queryKey: ['overview'] }),
            queryClient.invalidateQueries({ queryKey: ['problems-table'] }),
        ]);
    }

    async function sendDigest() {
        setSendingDigest(true);
        setDigestResult(null);
        try {
            const data = await apiFetch<{ message: string }>('/email/send-digest', { method: 'POST' });
            setDigestResult({ type: 'success', message: data.message || 'Digest sent successfully.' });
        } catch (error) {
            setDigestResult({ type: 'error', message: error instanceof Error ? error.message : 'Failed to send digest.' });
        } finally {
            setSendingDigest(false);
        }
    }

    async function saveProfile() {
        setSavingProfile(true);
        setProfileResult(null);
        try {
            await apiFetch('/public-profiles/me', { method: 'PUT', body: JSON.stringify(profileForm) });
            setProfileResult({ type: 'success', message: 'Public profile saved.' });
            await refreshQueries();
        } catch (error) {
            setProfileResult({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save profile.' });
        } finally {
            setSavingProfile(false);
        }
    }

    async function createGoal() {
        setSavingGoal(true);
        try {
            await apiFetch('/goals', {
                method: 'POST',
                body: JSON.stringify({
                    ...goalForm,
                    target_count: Number(goalForm.target_count),
                    focus_topic: goalForm.focus_topic || null,
                    focus_platform: goalForm.focus_platform || null,
                }),
            });
            setGoalForm({ title: '', metric: 'weekly_solves', period: 'weekly', target_count: 5, focus_topic: '', focus_platform: '' });
            await refreshQueries();
        } catch (error) {
            setImportResult({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create goal.' });
        } finally {
            setSavingGoal(false);
        }
    }

    async function deleteGoal(id: string) {
        try {
            await apiFetch(`/goals/${id}`, { method: 'DELETE' });
            await refreshQueries();
        } catch (error) {
            setImportResult({ type: 'error', message: error instanceof Error ? error.message : 'Failed to delete goal.' });
        }
    }

    async function runImport(key: string, endpoint: string, body: Record<string, unknown>) {
        setBusy((current) => ({ ...current, [key]: true }));
        setImportResult(null);
        try {
            const data = await apiFetch<{ platform: string; imported: number; warnings?: string[] }>(endpoint, { method: 'POST', body: JSON.stringify(body) });
            const warningText = data.warnings?.length ? ` ${data.warnings.join(' ')}` : '';
            setImportResult({ type: 'success', message: `${data.platform} sync finished. Imported ${data.imported} problems.${warningText}` });
            await refreshQueries();
        } catch (error) {
            setImportResult({ type: 'error', message: error instanceof Error ? error.message : 'Import failed.' });
        } finally {
            setBusy((current) => ({ ...current, [key]: false }));
        }
    }

    async function copyBadge() {
        if (!badgeMarkdown) return;
        await navigator.clipboard.writeText(badgeMarkdown);
        setProfileResult({ type: 'success', message: 'README badge markdown copied.' });
    }

    if (!mounted) {
        return <div className="flex min-h-screen items-center justify-center bg-[#05070b] text-white"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#05070b] px-6 py-10 text-white md:px-10 xl:px-14">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-[10%] left-[5%] h-[36%] w-[36%] rounded-full bg-sky-500/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[0%] h-[30%] w-[30%] rounded-full bg-amber-500/10 blur-[110px]" />
            </div>
            <div className="relative mx-auto max-w-[1450px]">
                <button onClick={() => router.push('/')} className="mb-8 flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </button>
                <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-2xl">
                    <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.3em] text-sky-400">Control Center</p>
                    <h1 className="mt-4 font-outfit text-4xl font-black text-white md:text-5xl">Ship the student experience end to end.</h1>
                    <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/50">Connect platform history, set goals, publish your profile, and copy the README badge from one place.</p>
                </div>

                <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Public Profile</p>
                                <h2 className="mt-2 font-outfit text-2xl font-black text-white">Publish progress and README badge</h2>
                            </div>
                            <Globe className="h-5 w-5 text-emerald-300" />
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <input value={profileForm.display_name} onChange={(event) => setProfileForm((current) => ({ ...current, display_name: event.target.value }))} placeholder="Display name" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                            <input value={profileForm.slug} onChange={(event) => setProfileForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} placeholder="Public slug" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                            <input value={profileForm.avatar_url} onChange={(event) => setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))} placeholder="Avatar URL" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 md:col-span-2" />
                            <input value={profileForm.headline} onChange={(event) => setProfileForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Headline" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 md:col-span-2" />
                            <textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} rows={4} placeholder="Short bio for your public page" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 md:col-span-2" />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/65">
                            <label className="flex items-center gap-2"><input type="checkbox" checked={profileForm.is_public} onChange={(event) => setProfileForm((current) => ({ ...current, is_public: event.target.checked }))} /> Make profile public</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={profileForm.share_badge} onChange={(event) => setProfileForm((current) => ({ ...current, share_badge: event.target.checked }))} /> Enable badge</label>
                        </div>

                        <div className="mt-6 rounded-2xl border border-white/5 bg-[#09111b] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Public page</p>
                            <p className="mt-2 break-all text-sm text-sky-300">{publicUrl || 'Create a slug to generate your public page URL.'}</p>
                            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">README badge markdown</p>
                            <div className="mt-2 rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-white/65">{badgeMarkdown || 'Publish your profile to generate the badge snippet.'}</div>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <button onClick={saveProfile} disabled={savingProfile} className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#04110b] transition hover:bg-emerald-400 disabled:opacity-60">
                                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} {savingProfile ? 'Saving...' : 'Save profile'}
                                </button>
                                <button onClick={copyBadge} disabled={!badgeMarkdown} className="flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/5 disabled:opacity-40">
                                    <Copy className="h-4 w-4" /> Copy badge
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 text-sm text-white/45">Interview readiness snapshot: <span className="font-semibold text-white">{profileQuery.data?.interview_readiness || 0}/100</span></div>
                        {profileResult && <div className={`mt-4 rounded-2xl border p-4 text-sm ${profileResult.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>{profileResult.message}</div>}
                    </section>

                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Goals</p>
                                <h2 className="mt-2 font-outfit text-2xl font-black text-white">Create measurable study targets</h2>
                            </div>
                            <Target className="h-5 w-5 text-amber-300" />
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <input value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} placeholder="Goal title" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 md:col-span-2" />
                            <select value={goalForm.metric} onChange={(event) => setGoalForm((current) => ({ ...current, metric: event.target.value }))} className="rounded-2xl border border-white/10 bg-[#0a111a] px-4 py-3 text-sm text-white outline-none">
                                {metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select value={goalForm.period} onChange={(event) => setGoalForm((current) => ({ ...current, period: event.target.value }))} className="rounded-2xl border border-white/10 bg-[#0a111a] px-4 py-3 text-sm text-white outline-none">
                                {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <input type="number" min={1} value={goalForm.target_count} onChange={(event) => setGoalForm((current) => ({ ...current, target_count: Number(event.target.value) }))} placeholder="Target count" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                            <input value={goalForm.focus_topic} onChange={(event) => setGoalForm((current) => ({ ...current, focus_topic: event.target.value }))} placeholder="Focus topic (optional)" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                            <input value={goalForm.focus_platform} onChange={(event) => setGoalForm((current) => ({ ...current, focus_platform: event.target.value }))} placeholder="Focus platform (optional)" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 md:col-span-2" />
                        </div>

                        <button onClick={createGoal} disabled={savingGoal} className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-bold text-[#181003] transition hover:bg-amber-300 disabled:opacity-60">
                            {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} {savingGoal ? 'Creating...' : 'Create goal'}
                        </button>

                        <div className="mt-6 space-y-3">
                            {(goalsQuery.data?.goals || []).map((goal) => (
                                <div key={goal.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{goal.title}</p>
                                            <p className="mt-1 text-xs text-white/45">{goal.current_value} / {goal.target_count} • {goal.metric.replace(/_/g, ' ')} • {goal.period}</p>
                                        </div>
                                        <button onClick={() => void deleteGoal(goal.id)} className="rounded-xl border border-white/10 p-2 text-white/55 transition hover:bg-white/5 hover:text-white">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${goal.progress_pct}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_1fr]">
                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Importers</p>
                                <h2 className="mt-2 font-outfit text-2xl font-black text-white">Connect platform history</h2>
                            </div>
                            <Import className="h-5 w-5 text-sky-300" />
                        </div>

                        <div className="mt-6 space-y-4">
                            {[
                                { key: 'codeforces', label: 'Codeforces', endpoint: '/imports/codeforces', placeholder: 'tourist' },
                                { key: 'leetcode', label: 'LeetCode', endpoint: '/imports/leetcode', placeholder: 'leetcode' },
                                { key: 'geeksforgeeks', label: 'GeeksforGeeks', endpoint: '/imports/geeksforgeeks', placeholder: 'ankit15697' },
                            ].map((platform) => (
                                <div key={platform.key} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-white">{platform.label}</p>
                                        <button onClick={() => void runImport(platform.key, platform.endpoint, { handle: handles[platform.key as keyof typeof handles], limit: 200 })} disabled={!handles[platform.key as keyof typeof handles] || busy[platform.key]} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-[#03121f] transition hover:bg-sky-400 disabled:opacity-40">
                                            {busy[platform.key] ? 'Syncing...' : 'Connect'}
                                        </button>
                                    </div>
                                    <input value={handles[platform.key as keyof typeof handles]} onChange={(event) => setHandles((current) => ({ ...current, [platform.key]: event.target.value }))} placeholder={platform.placeholder} className="w-full rounded-2xl border border-white/10 bg-[#0a111a] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                                </div>
                            ))}

                            <div className="rounded-2xl border border-white/5 bg-[#081018] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-white">CSV backfill</p>
                                    <button onClick={() => void runImport('csv', '/imports/csv', { csv_text: csvText })} disabled={!csvText.trim() || busy.csv} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-[#03111a] transition hover:bg-cyan-200 disabled:opacity-40">
                                        {busy.csv ? 'Importing...' : 'Import CSV'}
                                    </button>
                                </div>
                                <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={8} placeholder={'topic,problem,difficulty,platform,language,problem_url,tags,solved_at\nArrays,Two Sum,Easy,LeetCode,JavaScript,https://leetcode.com/problems/two-sum/,Hash Map|Array,2026-03-20T10:00:00.000Z'} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                            </div>
                        </div>

                        {importResult && <div className={`mt-4 rounded-2xl border p-4 text-sm ${importResult.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>{importResult.message}</div>}
                    </section>

                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-outfit text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">Email and Connected Profiles</p>
                                <h2 className="mt-2 font-outfit text-2xl font-black text-white">Verify digest delivery and sync snapshots</h2>
                            </div>
                            <Mail className="h-5 w-5 text-violet-300" />
                        </div>

                        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Digest email</p>
                            <p className="mt-2 text-sm font-medium text-white">{userEmail || 'No email loaded'}</p>
                            <button onClick={sendDigest} disabled={sendingDigest} className="mt-4 flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-60">
                                {sendingDigest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sendingDigest ? 'Sending...' : 'Send test digest'}
                            </button>
                            {digestResult && <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${digestResult.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>{digestResult.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}<span>{digestResult.message}</span></div>}
                        </div>

                        <div className="mt-6 space-y-3">
                            {(profilesQuery.data || []).map((profile) => (
                                <div key={profile.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{profile.platform}</p>
                                            <p className="mt-1 text-xs text-white/45">@{profile.handle}</p>
                                        </div>
                                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">{profile.imported_problem_count} imported</span>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Solved</p><p className="mt-2 text-lg font-bold text-white">{profile.solved_count}</p></div>
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Rank</p><p className="mt-2 text-sm font-semibold text-white">{profile.rank_label || 'n/a'}</p></div>
                                        <div className="rounded-xl border border-white/5 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Synced</p><p className="mt-2 text-sm font-semibold text-white">{new Date(profile.last_synced_at).toLocaleDateString()}</p></div>
                                    </div>
                                </div>
                            ))}
                            {!profilesQuery.data?.length && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/45">No coding profiles connected yet. Add Codeforces, LeetCode, GeeksforGeeks, or paste CSV history to seed the account.</div>}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
