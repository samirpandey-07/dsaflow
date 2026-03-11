'use client';

import Link from 'next/link';
import { Home, Search, Terminal } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-8 max-w-lg">
                {/* Animated Icon */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 animate-pulse" />
                        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md flex items-center justify-center rotate-12 group hover:rotate-0 transition-transform duration-500">
                            <Search className="w-10 h-10 text-violet-400 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center animate-bounce">
                            <span className="text-xs font-bold text-red-400">404</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white italic">
                        ROUTE_NOT_FOUND
                    </h1>
                    <p className="text-white/40 text-lg font-medium leading-relaxed">
                        The problem you're looking for doesn't exist in our memory. <br className="hidden md:block" />
                        Maybe it's time to go back to base?
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                    >
                        <Home className="w-5 h-5" />
                        Return Home
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white/70 font-bold rounded-2xl hover:bg-white/10 hover:text-white transition-all backdrop-blur-md"
                    >
                        <Terminal className="w-5 h-5" />
                        Go Back
                    </button>
                </div>

                {/* Console Text Decoration */}
                <div className="pt-12 font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">
                    SYSTEM_STATUS: ERROR_LINK_BROKEN // TRACE_ID: ${Math.random().toString(36).substring(7).toUpperCase()}
                </div>
            </div>
        </div>
    );
}
