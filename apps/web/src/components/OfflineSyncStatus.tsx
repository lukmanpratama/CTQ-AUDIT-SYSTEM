'use client';

// Connection / queue status for inspectors: shows when the app works offline and how many
// changes made on this device haven't reached the server yet. Hidden when online with nothing queued.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { liveQuery } from 'dexie';
import { offlineDb } from '../lib/offline/db';
import { useOffline } from '../lib/offline/connectivity';

export function OfflineSyncStatus() {
    const pathname = usePathname();
    const offline = useOffline();
    const [pending, setPending] = useState(0);

    useEffect(() => {
        const db = offlineDb();
        if (!db) return;
        // Updates by itself whenever the queue changes (also from another tab)
        const subscription = liveQuery(() => db.syncQueue.count()).subscribe({
            next: setPending,
            error: () => setPending(0),
        });
        return () => subscription.unsubscribe();
    }, []);

    if (pathname === '/login' || (!offline && pending === 0)) return null;

    return (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[9998] pointer-events-none" role="status" aria-live="polite">
            <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg ${offline ? 'bg-gray-900 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                <span className={`h-2 w-2 rounded-full ${offline ? 'bg-amber-400' : 'bg-amber-500'}`} />
                {offline ? 'Offline · data disimpan di perangkat' : 'Online'}
                {pending > 0 && (
                    <span className={offline ? 'text-gray-300' : ''}>
                        · {pending} perubahan belum terkirim
                    </span>
                )}
            </div>
        </div>
    );
}
