'use client';

// Whether the API can be reached right now. `navigator.onLine` alone isn't enough (on a
// factory Wi-Fi without internet it stays true), so every API call made through the offline
// layer also reports whether it got through.

import { useSyncExternalStore } from 'react';

let apiReachable = true;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function reportApiReachable(reachable: boolean) {
    if (reachable === apiReachable) return;
    apiReachable = reachable;
    notify();
}

/** True when the browser is offline or the last API call couldn't reach the server. */
export function isOffline() {
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || !apiReachable;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener('online', notify);
    window.addEventListener('offline', notify);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
    };
}

/** Re-renders when the connection state changes. False on the server render. */
export function useOffline() {
    return useSyncExternalStore(subscribe, isOffline, () => false);
}

/**
 * A response that means "the API couldn't be reached" rather than a real answer: the Next.js
 * proxy returns a non-JSON 5xx when the API is down or restarting.
 */
export const isUnreachableResponse = (res: Response) =>
    res.status >= 500 && !(res.headers.get('content-type') || '').includes('application/json');
