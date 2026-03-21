'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

export default function LoginPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // We'll calculate these in a state to be 100% build-safe
    const [returnUrl, setReturnUrl] = useState('');
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const isVSCode = searchParams?.get('source') === 'vscode';
        const scheme = searchParams?.get('scheme') || 'vscode';
        const extId = searchParams?.get('extId') || 'dsaflow.dsaflow';

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        let constructedUrl = baseUrl;
        if (isVSCode) {
            constructedUrl = `${baseUrl}/login?source=vscode&scheme=${scheme}&extId=${extId}`;
        }
        setReturnUrl(constructedUrl);

        const handleRedirect = async (session: Session | null) => {
            if (isVSCode && session?.access_token) {
                const redirectUrl = `${scheme}://${extId}/auth?token=${session.access_token}`;
                window.location.href = redirectUrl;
            } else {
                router.replace('/');
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                handleRedirect(session);
            } else {
                setChecking(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) handleRedirect(session);
        });

        return () => subscription.unsubscribe();
    }, [router, searchParams]);

    if (checking) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-[-20%] left-[30%] w-[40%] h-[40%] bg-primary/15 blur-[100px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            DSAFlow
                        </h1>
                    </div>
                    <p className="text-muted-foreground">Sign in to track your DSA progress</p>
                </div>

                {/* Auth Card */}
                <div className="glass-panel rounded-2xl p-8 border border-white/10">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: 'hsl(280 100% 70%)',
                                        brandAccent: 'hsl(280 100% 60%)',
                                        inputBackground: 'rgba(255,255,255,0.05)',
                                        inputBorder: 'rgba(255,255,255,0.1)',
                                        inputText: '#ffffff',
                                        inputPlaceholder: 'rgba(255,255,255,0.3)',
                                    },
                                    radii: {
                                        borderRadiusButton: '12px',
                                        inputBorderRadius: '10px',
                                    },
                                },
                            },
                            style: {
                                button: { fontWeight: '700', letterSpacing: '0.025em' },
                                container: { color: '#fff' },
                                label: { color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' },
                                anchor: { color: 'hsl(280 100% 70%)' },
                            },
                        }}
                        providers={['github', 'google']}
                        redirectTo={returnUrl}
                        theme="dark"
                    />
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    Your data is private and scoped to your account.
                </p>
            </div>
        </div>
    );
}
