'use client';

// Pages reload their data by themselves when someone adds, changes or deletes data.
// One shared poller per tab asks GET /api/data-version (a tiny response) every 15s while
// the tab is visible, and right away when the user comes back to it. The API bumps that
// version after every successful write.

import { useCallback, useRef, useSyncExternalStore } from 'react';

const POLL_MS = 15_000;

let serverVersion: string | null = null;
let changeCount = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

// Newest CAP alert id, sent along with the data version (see useLatestAlertId)
let latestAlertId: string | null = null;
const alertListeners = new Set<() => void>();

async function poll() {
    if (document.visibilityState !== 'visible') return;
    try {
        const res = await fetch('/api/data-version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version, alertId } = await res.json();
        if (serverVersion !== null && version !== serverVersion) {
            changeCount++;
            listeners.forEach(notify => notify());
        }
        serverVersion = version;
        if (alertId !== undefined && alertId !== latestAlertId) {
            latestAlertId = String(alertId);
            alertListeners.forEach(notify => notify());
        }
    } catch {
        // API unreachable for a moment: try again on the next tick
    }
}

const onVisible = () => { if (document.visibilityState === 'visible') poll(); };

function subscribe(notify: () => void) {
    listeners.add(notify);
    if (!timer) {
        poll();
        timer = setInterval(poll, POLL_MS);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
    }
    return () => {
        listeners.delete(notify);
        if (listeners.size === 0 && timer) {
            clearInterval(timer);
            timer = null;
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        }
    };
}

/**
 * `refreshKey` changes whenever the server's data changed: add it to the deps of the effect
 * that loads the page's data. Inside that effect `isBackgroundRefresh()` tells whether this run
 * was caused by such a change (keep showing the current data, no loading screen) or by the
 * page's own filters / first load.
 */
export function useDataRefresh() {
    const refreshKey = useSyncExternalStore(subscribe, () => changeCount, () => 0);
    const seen = useRef(refreshKey);
    const isBackgroundRefresh = useCallback(() => {
        const background = seen.current !== refreshKey;
        seen.current = refreshKey;
        return background;
    }, [refreshKey]);
    return { refreshKey, isBackgroundRefresh };
}

function subscribeAlerts(notify: () => void) {
    alertListeners.add(notify);
    // Keeps the shared poller running while an alert listener is mounted (it never fires data refreshes)
    const keepPolling = () => { };
    const unsubscribe = subscribe(keepPolling);
    return () => {
        alertListeners.delete(notify);
        unsubscribe();
    };
}

/**
 * Id of the newest CAP alert on the server (null until the first poll). It rides on the same
 * 15s /api/data-version poll, so watching for alerts costs no extra requests.
 */
export function useLatestAlertId() {
    return useSyncExternalStore(subscribeAlerts, () => latestAlertId, () => null);
}
