'use client';

// Sends the changes queued on the device (syncQueue) to the API, oldest first, using the same
// endpoints the pages use online. Safe to repeat: a new audit is created with the id the phone
// gave it (the API returns it instead of a duplicate), process saves are upserts, and resetting
// a process that is already gone succeeds.
//
// Outcome of each change:
// - sent: removed from the queue and folded into the copy kept on the device;
// - no connection / API down / 429: stays queued, retried later with backoff (Retry-After honoured);
// - refused (400/401/403/404/409/422, or a server error 5 times in a row): NEEDS_ATTENTION with the
//   reason. Later changes of that audit wait behind it (their order matters); other audits go on.

import { useSyncExternalStore } from 'react';
import { LOCAL_PHOTO, applyMutation } from './apply-mutations';
import { isUnreachableResponse, onApiBackOnline, reportApiReachable } from './connectivity';
import { offlineDb, type QueueItem } from './db';

type Outcome = { kind: 'done' } | { kind: 'retry'; afterMs?: number } | { kind: 'attention'; error: string };

const MAX_SERVER_ERRORS = 5;
const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 2 * 60_000, 5 * 60_000];

// ── State for the status indicator ──────────────────────────────────────────────

let syncing = false;
const listeners = new Set<() => void>();
const setSyncing = (value: boolean) => {
    if (syncing === value) return;
    syncing = value;
    listeners.forEach(l => l());
};

/** True while changes are being sent. */
export function useSyncing() {
    return useSyncExternalStore(
        l => { listeners.add(l); return () => listeners.delete(l); },
        () => syncing,
        () => false,
    );
}

// ── Scheduling ──────────────────────────────────────────────────────────────────

let running = false;
let rerun = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

/** Asks for a sync soon (after the change that triggered it has been committed). */
export function requestSync(delayMs = 300) {
    if (typeof window === 'undefined') return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => { debounce = null; void syncNow(); }, delayMs);
}

function scheduleRetry(afterMs?: number) {
    if (retryTimer) clearTimeout(retryTimer);
    const wait = afterMs ?? BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
    failures++;
    retryTimer = setTimeout(() => { retryTimer = null; void syncNow(); }, wait);
}

/** Sends everything that can be sent now. One run at a time, also across tabs (Web Locks). */
export async function syncNow(): Promise<void> {
    if (running) { rerun = true; return; }
    running = true;
    try {
        const locks = (navigator as Navigator & { locks?: LockManager }).locks;
        if (locks) {
            // ifAvailable: another tab is already sending; it will pick these up too
            await locks.request('ctq-offline-sync', { ifAvailable: true }, async lock => { if (lock) await drain(); });
        } else {
            await drain();
        }
    } finally {
        running = false;
        setSyncing(false);
        if (rerun) { rerun = false; void syncNow(); }
    }
}

async function drain() {
    const db = offlineDb();
    if (!db) return;
    for (;;) {
        const items = await db.syncQueue.orderBy('seq').toArray();
        // A change that needs attention holds back the later changes of the same audit
        const blocked = new Set(items.filter(i => i.status === 'NEEDS_ATTENTION').map(i => i.rqcHeaderId));
        const next = items.find(i => i.status !== 'NEEDS_ATTENTION' && !blocked.has(i.rqcHeaderId));
        if (!next) return;

        setSyncing(true);
        await db.syncQueue.update(next.seq!, { status: 'SYNCING' });
        const outcome = await send(next);

        if (outcome.kind === 'done') {
            failures = 0;
            await finish(next);
        } else if (outcome.kind === 'retry') {
            await db.syncQueue.update(next.seq!, { status: 'PENDING_SYNC' });
            scheduleRetry(outcome.afterMs);
            return;
        } else {
            await db.syncQueue.update(next.seq!, { status: 'NEEDS_ATTENTION', error: outcome.error });
        }
    }
}

// ── Sending one change ──────────────────────────────────────────────────────────

async function request(url: string, init: RequestInit): Promise<Response | null> {
    try {
        const res = await fetch(url, init);
        reportApiReachable(!isUnreachableResponse(res));
        return res;
    } catch {
        reportApiReachable(false);
        return null;
    }
}

async function errorText(res: Response) {
    const body = await res.json().catch(() => null);
    const msg = body?.message;
    return Array.isArray(msg) ? msg.join(', ') : msg || res.statusText || 'Request failed';
}

async function classify(res: Response | null, item: QueueItem): Promise<Outcome> {
    if (!res || isUnreachableResponse(res)) return { kind: 'retry' };
    if (res.ok) return { kind: 'done' };
    if (res.status === 429) {
        const seconds = Number(res.headers.get('Retry-After'));
        return { kind: 'retry', afterMs: seconds > 0 ? seconds * 1000 : undefined };
    }
    const msg = await errorText(res);
    if (res.status === 401 || res.status === 403) return { kind: 'attention', error: `Perlu login ulang saat online (${res.status}): ${msg}` };
    if (res.status >= 500) {
        // Could be passing (e.g. the database restarting): retry a few times before asking for help
        const attempts = (item.attempts ?? 0) + 1;
        await offlineDb()?.syncQueue.update(item.seq!, { attempts });
        if (attempts < MAX_SERVER_ERRORS) return { kind: 'retry' };
    }
    return { kind: 'attention', error: `${res.status}: ${msg}` };
}

/** Uploads photos still on the device and writes their URLs into the queued change (kept on retries). */
async function uploadLocalPhotos(item: QueueItem & { type: 'saveProcess' }): Promise<Outcome | null> {
    const db = offlineDb()!;
    let changed = false;
    for (const defect of item.payload.defects) {
        for (const key of ['photoDefect', 'photoAfterActionPlan'] as const) {
            const value = defect[key];
            if (!value?.startsWith(LOCAL_PHOTO)) continue;
            const photo = await db.inspectionPhotos.get(value.slice(LOCAL_PHOTO.length));
            if (!photo) { defect[key] = undefined; changed = true; continue; }
            const form = new FormData();
            form.append('file', photo.blob, 'photo.jpg');
            const res = await request('/api/files/upload', { method: 'POST', body: form });
            const outcome = await classify(res, item);
            if (outcome.kind !== 'done') return outcome;
            defect[key] = (await res!.json()).url;
            changed = true;
        }
    }
    if (changed) await db.syncQueue.put({ ...item, status: 'SYNCING' });
    return null;
}

async function send(item: QueueItem): Promise<Outcome> {
    const db = offlineDb()!;
    const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const processUrl = (i: { setupAreaId: string; setupProcessId: string }) =>
        `/api/rqc/headers/${item.rqcHeaderId}/areas/${i.setupAreaId}/processes/${i.setupProcessId}/inspections`;

    switch (item.type) {
        case 'createHeader': {
            const draft = await db.inspectionDrafts.get(item.rqcHeaderId);
            if (!draft) return { kind: 'done' }; // deleted on the device meanwhile
            // The phone's id: sending it again after a lost response returns the same audit
            return classify(await request('/api/rqc/headers', json('POST', { ...draft.payload, rqcHeaderId: item.rqcHeaderId })), item);
        }
        case 'updateHeader':
            return classify(await request(`/api/rqc/headers/${item.rqcHeaderId}`, json('PUT', item.payload)), item);
        case 'saveProcess': {
            const photoProblem = await uploadLocalPhotos(item);
            if (photoProblem) return photoProblem;
            return classify(await request(processUrl(item), json('POST', item.payload)), item);
        }
        case 'deleteProcess':
            return classify(await request(processUrl(item), { method: 'DELETE' }), item);
    }
}

/**
 * A change reached the server: take it off the queue and fold it into the copy kept on the device
 * (the offline draft, or the kept GET /api/rqc/headers/:id), so it doesn't disappear if the
 * connection drops before the page reloads. An offline-made audit whose changes have all been
 * sent becomes a normal kept server copy.
 */
async function finish(item: QueueItem) {
    const db = offlineDb()!;
    const url = `/api/rqc/headers/${item.rqcHeaderId}`;
    await db.transaction('rw', db.syncQueue, db.inspectionDrafts, db.masterCache, db.inspectionPhotos, async () => {
        await db.syncQueue.delete(item.seq!);

        const draft = await db.inspectionDrafts.get(item.rqcHeaderId);
        if (draft) {
            applyMutation(draft.view, item);
            if (item.type === 'updateHeader') draft.payload = { ...draft.payload, ...item.payload };
            await db.inspectionDrafts.put(draft);
        } else {
            const kept = await db.masterCache.get(url);
            if (kept) {
                applyMutation(kept.data, item);
                await db.masterCache.put(kept);
            }
        }

        const left = await db.syncQueue.where('rqcHeaderId').equals(item.rqcHeaderId).count();
        if (left === 0) {
            if (draft) {
                const { _localOnly, _pendingSync, ...view } = draft.view;
                await db.masterCache.put({ url, data: view, savedAt: Date.now() });
                await db.inspectionDrafts.delete(item.rqcHeaderId);
            }
            // Its photos are on the server now
            await db.inspectionPhotos.where('rqcHeaderId').equals(item.rqcHeaderId).delete();
        }
    });
}

// ── Needs attention ─────────────────────────────────────────────────────────────

/** "Coba lagi" on a change that needs attention: back in the queue, sent now. */
export async function retryChange(seq: number) {
    await offlineDb()?.syncQueue.update(seq, { status: 'PENDING_SYNC', attempts: 0, error: undefined });
    failures = 0;
    void syncNow();
}

/**
 * "Buang" on a change that needs attention. Discarding the start of an audit discards the whole
 * audit made offline (its other changes and photos too), since none of it can reach the server.
 */
export async function discardChange(item: QueueItem) {
    const db = offlineDb();
    if (!db) return;
    await db.transaction('rw', db.syncQueue, db.inspectionDrafts, db.inspectionPhotos, async () => {
        if (item.type === 'createHeader') {
            await db.syncQueue.where('rqcHeaderId').equals(item.rqcHeaderId).delete();
            await db.inspectionDrafts.delete(item.rqcHeaderId);
            await db.inspectionPhotos.where('rqcHeaderId').equals(item.rqcHeaderId).delete();
        } else {
            await db.syncQueue.delete(item.seq!);
        }
    });
    void syncNow();
}

// ── Triggers ────────────────────────────────────────────────────────────────────

let started = false;

/**
 * Syncs when the app opens, when the browser comes back online, and when the inspector returns
 * to the tab. Background Sync isn't used: browsers don't support it consistently.
 */
export function startSyncTriggers() {
    if (started || typeof window === 'undefined') return;
    started = true;
    const now = () => { failures = 0; void syncNow(); };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') now(); });
    // Any page load that gets through after an outage (the browser may not fire 'online' for that)
    onApiBackOnline(() => requestSync(0));
    void syncNow();
}
