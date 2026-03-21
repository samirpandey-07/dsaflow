'use client';

import { useEffect } from 'react';

export default function SWBypass() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister();
                    console.log('Unregistered rogue Service Worker:', registration);
                }
            }).catch(err => {
                console.error('Failed to unregister Service Worker:', err);
            });
        }
    }, []);

    return null;
}
