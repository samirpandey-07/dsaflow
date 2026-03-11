'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter, useSearchParams } from 'next/navigation';

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
    const isVSCode = searchParams.get('source') === 'vscode';
    const scheme = searchParams.get('scheme') || 'vscode';
    const extId = searchParams.get('extId') || 'dsaflow.dsaflow';

    // Build the dynamic return URL so OAuth doesn't lose our VS Code params!
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    let returnUrl = baseUrl;
    // We must route back to the login page itself to trigger the handleRedirect flow
    if (isVSCode) {
        returnUrl = `${baseUrl}/login?source=vscode&scheme=${scheme}&extId=${extId}`;
    }

    const [checking, setChecking] = useState(true);
    useEffect(() => {
        const handleRedirect = async (session: any) => {
            if (isVSCode && session?.access_token) {
                const redirectUrl = `${scheme}://${extId}/auth?token=${session.access_token}`;

                console.log(`Redirecting to: ${redirectUrl}`);
                window.location.href = redirectUrl;

                // Fallback close text
                document.body.innerHTML = `
                    <div style="background:#0a0a0b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
                        <div>
                            <h2>Authentication Successful! ✅</h2>
                            <p>You can now close this tab and return to your editor.</p>
                            <p style="color:#888;font-size:12px;margin-top:20px;">
                                If it did not open automatically, click <a style="color:#a855f7" href="${redirectUrl}">here</a>.
                            </p>
                        </div>
                    </div>`;
            } else {
                router.replace('/');
            }
        };

        // If already logged in, redirect immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                handleRedirect(session);
            } else {
                setChecking(false);
            }
        });

        // Listen for auth state changes (e.g. after successful login)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) handleRedirect(session);
        });

        return () => subscription.unsubscribe();
    }, [router, isVSCode]);

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
