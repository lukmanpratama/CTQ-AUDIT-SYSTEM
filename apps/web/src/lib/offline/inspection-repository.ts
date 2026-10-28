'use client';

// Offline data layer for the RQC audit pages (dashboard, history, header, inspection, summary).
//
// Reads: online they come from the API and the response is kept on the device; offline (or API
// down) the kept copy is used. Writes: online they go straight to the API as before; offline they
// are queued on the device (syncQueue) and applied on top of what the pages show, so an inspector
// sees their own entries. Stage 4 sends the queue to the server.
//
// Once a header has queued changes, later changes to it are queued too (even online), so the
// server receives them in the order they were made.

import { isUnreachableResponse, reportApiReachable } from './connectivity';
import { offlineDb, type InspectionDraft, type ProcessPayload, type QueueItem, type SyncMutation } from './db';

// Same rule as the API (CAP_DAILY_THRESHOLD): a defect above 20% is a CAP
const CAP_DAILY_RATE = 0.20;

export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

/** No connection and nothing kept on this device for what was asked. */
export class OfflineUnavailableError extends Error {
    constructor(what = 'Data ini') {
        super(`${what} belum tersimpan di perangkat ini. Buka sekali saat online agar bisa dipakai offline.`);
    }
}

const LOCAL_PHOTO = 'local-photo:';

const uuid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

async function readError(res: Response) {
    const body = await res.json().catch(() => null);
    const msg = body?.message;
    return Array.isArray(msg) ? msg.join(', ') : msg || `Request failed (${res.status})`;
}

// ── Reads ───────────────────────────────────────────────────────────────────────

/**
 * GET an API URL; the answer is kept on the device. When the API can't be reached the kept
 * copy is returned instead (OfflineUnavailableError if there is none).
 */
export async function getJson<T = any>(url: string): Promise<T> {
    const db = offlineDb();
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
            reportApiReachable(true);
            const data = await res.json();
            db?.masterCache.put({ url, data, savedAt: Date.now() }).catch(() => { /* storage full: still show the data */ });
            return data as T;
        }
        if (!isUnreachableResponse(res)) {
            reportApiReachable(true);
            throw new ApiError(await readError(res), res.status);
        }
    } catch (e) {
        if (e instanceof ApiError) throw e;
        // fetch() threw: no network / server unreachable
    }
    reportApiReachable(false);
    const kept = await db?.masterCache.get(url);
    if (kept) return kept.data as T;
    throw new OfflineUnavailableError();
}

/** Queued changes of one header, oldest first. */
async function queueFor(rqcHeaderId: string): Promise<QueueItem[]> {
    const db = offlineDb();
    if (!db) return [];
    return (await db.syncQueue.where('rqcHeaderId').equals(rqcHeaderId).toArray()).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

const photoUrls = new Map<string, string>();

/** Display URL for a photo value: object URL for one kept on the device, else unchanged. */
async function displayPhoto(value?: string | null) {
    if (!value || !value.startsWith(LOCAL_PHOTO)) return value;
    const photoId = value.slice(LOCAL_PHOTO.length);
    if (!photoUrls.has(photoId)) {
        const photo = await offlineDb()?.inspectionPhotos.get(photoId);
        if (!photo) return undefined;
        photoUrls.set(photoId, URL.createObjectURL(photo.blob));
    }
    return photoUrls.get(photoId);
}

/** Applies queued changes to a header the way the API would have stored them. */
async function applyQueue(header: any, items: QueueItem[]) {
    if (items.length === 0) return header;
    const view = structuredClone(header);
    view.rqcAreas = view.rqcAreas || [];

    for (const item of items) {
        if (item.type === 'updateHeader') {
            Object.assign(view, item.payload, {
                date: `${item.payload.date}T00:00:00.000Z`,
                factory: { ...(view.factory || {}), factoryId: item.payload.factoryId, factory: item.display?.factoryName ?? view.factory?.factory },
            });
        } else if (item.type === 'saveProcess' || item.type === 'deleteProcess') {
            let area = view.rqcAreas.find((a: any) => String(a.setupAreaId) === String(item.setupAreaId));
            if (item.type === 'deleteProcess') {
                if (area) area.rqcProcesses = (area.rqcProcesses || []).filter((p: any) => String(p.setupProcessId) !== String(item.setupProcessId));
                continue;
            }
            if (!area) {
                area = { rqcAreaId: `local-area-${item.setupAreaId}`, setupAreaId: item.setupAreaId, rqcProcesses: [] };
                view.rqcAreas.push(area);
            }
            area.rqcProcesses = area.rqcProcesses || [];
            let proc = area.rqcProcesses.find((p: any) => String(p.setupProcessId) === String(item.setupProcessId));
            if (!proc) {
                proc = {
                    rqcProcessId: `local-process-${item.setupProcessId}`,
                    setupProcessId: item.setupProcessId,
                    rqcInspections: [],
                    setupProcess: { masterProcess: { process: item.display?.processName } },
                };
                area.rqcProcesses.push(proc);
            }
            const { qtyChecking, defects } = item.payload;
            proc.qtyChecking = qtyChecking;
            proc.rqcInspections = proc.rqcInspections || [];
            // Same rule as the API: only the defects sent are inserted / updated, missing fields are kept
            for (const d of defects) {
                const defectRate = qtyChecking > 0 ? d.qtyDefect / qtyChecking : 0;
                let insp = proc.rqcInspections.find((i: any) => String(i.defectId) === String(d.defectId));
                if (!insp) {
                    insp = { rqcInspectionId: `local-${item.setupProcessId}-${d.defectId}`, defectId: d.defectId };
                    proc.rqcInspections.push(insp);
                }
                Object.assign(insp, {
                    qtyDefect: d.qtyDefect,
                    defectRate,
                    passRate: Math.max(0, 1 - defectRate),
                    status: defectRate > CAP_DAILY_RATE ? 'CAP' : 'IMMEDIATE_ACTION',
                });
                for (const key of ['actionPlan', 'rootCause', 'corrective', 'durasiStopline', 'photoDefect', 'photoAfterActionPlan'] as const) {
                    if (d[key] !== undefined) insp[key] = d[key];
                }
            }
        }
    }

    // Photos still on the device are shown from there
    for (const area of view.rqcAreas) {
        for (const proc of area.rqcProcesses || []) {
            for (const insp of proc.rqcInspections || []) {
                insp.photoDefect = await displayPhoto(insp.photoDefect);
                insp.photoAfterActionPlan = await displayPhoto(insp.photoAfterActionPlan);
            }
        }
    }
    view._pendingSync = true;
    return view;
}

/** GET /api/rqc/headers/:id, a header created offline, or the kept copy — with queued changes applied. */
export async function getHeader(rqcHeaderId: string) {
    const db = offlineDb();
    const draft = await db?.inspectionDrafts.get(rqcHeaderId);
    const base = draft ? draft.view : await getJson(`/api/rqc/headers/${rqcHeaderId}`).catch(e => {
        if (e instanceof OfflineUnavailableError) throw new OfflineUnavailableError('Inspeksi ini');
        throw e;
    });
    return applyQueue(base, await queueFor(rqcHeaderId));
}

/** GET /api/rqc/headers?modelId= plus headers created offline, with queued changes applied. */
export async function listHeaders(setupModelId: string) {
    const db = offlineDb();
    let server: any[] = [];
    try {
        server = await getJson<any[]>(`/api/rqc/headers?modelId=${encodeURIComponent(setupModelId)}`);
    } catch (e) {
        if (!(e instanceof OfflineUnavailableError)) throw e;
    }
    const drafts = db ? await db.inspectionDrafts.where('setupModelId').equals(String(setupModelId)).toArray() : [];
    const serverIds = new Set(server.map(h => h.rqcHeaderId));
    const all = [...server, ...drafts.filter(d => !serverIds.has(d.rqcHeaderId)).map(d => d.view)];
    return Promise.all(all.map(async h => applyQueue(h, await queueFor(h.rqcHeaderId))));
}

// ── Writes ──────────────────────────────────────────────────────────────────────

async function enqueue(rqcHeaderId: string, mutation: SyncMutation) {
    const db = offlineDb();
    if (!db) throw new Error('Penyimpanan offline tidak tersedia di browser ini.');
    await db.syncQueue.add({ ...mutation, mutationId: uuid(), rqcHeaderId, status: 'PENDING_SYNC', createdAt: Date.now() });
}

/** True when changes to this header must be queued (made offline, or older changes still queued). */
async function mustQueue(rqcHeaderId: string) {
    const db = offlineDb();
    if (!db) return false;
    if (await db.inspectionDrafts.get(rqcHeaderId)) return true;
    return (await db.syncQueue.where('rqcHeaderId').equals(rqcHeaderId).count()) > 0;
}

/**
 * Sends a write to the API. Returns the response, or null when the API couldn't be reached
 * (the caller then queues it). A real error answer from the API is thrown as ApiError.
 */
async function trySend(url: string, init: RequestInit): Promise<Response | null> {
    try {
        const res = await fetch(url, init);
        if (isUnreachableResponse(res)) {
            reportApiReachable(false);
            return null;
        }
        reportApiReachable(true);
        if (!res.ok) throw new ApiError(await readError(res), res.status);
        return res;
    } catch (e) {
        if (e instanceof ApiError) throw e;
        reportApiReachable(false);
        return null;
    }
}

export type HeaderPayload = InspectionDraft['payload'];

/**
 * Starts an audit. Online: POST /api/rqc/headers as before. Offline: kept on the device with a
 * client UUID (stage 4 creates it on the server with that same id). `display` fills in what the
 * server would add (model / factory names, PO snapshot) so the pages can show it offline.
 */
export async function createHeader(
    payload: HeaderPayload,
    display: { setupModel?: { modelName: string; modelNo?: string | null }; factoryName?: string; poRow?: { article?: string; model?: string; qtyOrder?: number } },
): Promise<{ rqcHeaderId: string; queued: boolean }> {
    const res = await trySend('/api/rqc/headers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res) {
        const data = await res.json();
        return { rqcHeaderId: data.rqcHeaderId, queued: false };
    }

    const db = offlineDb();
    if (!db) throw new Error('Penyimpanan offline tidak tersedia di browser ini.');
    const rqcHeaderId = uuid();
    const view = {
        rqcHeaderId,
        date: `${payload.date}T00:00:00.000Z`,
        checkingTime: payload.checkingTime,
        setupModelId: payload.setupModelId,
        setupModel: display.setupModel ? { setupModelId: payload.setupModelId, ...display.setupModel } : undefined,
        po: payload.po,
        article: display.poRow?.article,
        model: display.poRow?.model ?? display.setupModel?.modelName,
        qtyOrder: display.poRow?.qtyOrder,
        factoryId: payload.factoryId,
        factory: { factoryId: payload.factoryId, factory: display.factoryName ?? payload.factoryId },
        cell: payload.cell,
        nik: payload.nik,
        createdAt: new Date().toISOString(),
        rqcAreas: [],
        _localOnly: true,
    };
    await db.transaction('rw', db.inspectionDrafts, db.syncQueue, async () => {
        await db.inspectionDrafts.add({ rqcHeaderId, setupModelId: String(payload.setupModelId), payload, view, createdAt: Date.now() });
        await enqueue(rqcHeaderId, { type: 'createHeader' });
    });
    return { rqcHeaderId, queued: true };
}

/** Edits an audit's header (PUT). A header made offline is edited in place on the device. */
export async function updateHeader(
    rqcHeaderId: string,
    payload: { date: string; checkingTime: string; po: string; factoryId: string; cell: string },
    display: { factoryName?: string; poRow?: { article?: string; model?: string; qtyOrder?: number } },
): Promise<{ queued: boolean }> {
    const db = offlineDb();
    const draft = await db?.inspectionDrafts.get(rqcHeaderId);
    if (db && draft) {
        const view = {
            ...draft.view,
            ...payload,
            date: `${payload.date}T00:00:00.000Z`,
            factory: { factoryId: payload.factoryId, factory: display.factoryName ?? payload.factoryId },
            article: display.poRow?.article ?? draft.view.article,
            model: display.poRow?.model ?? draft.view.model,
        };
        await db.inspectionDrafts.put({ ...draft, payload: { ...draft.payload, ...payload }, view });
        return { queued: true };
    }
    if (!(await mustQueue(rqcHeaderId))) {
        const res = await trySend(`/api/rqc/headers/${rqcHeaderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res) return { queued: false };
    }
    await enqueue(rqcHeaderId, { type: 'updateHeader', payload, display: { factoryName: display.factoryName } });
    return { queued: true };
}

/**
 * A photo for an inspection: uploaded right away when the API can be reached (returns its URL),
 * otherwise kept on the device (returns `local-photo:<id>`, uploaded by the sync).
 */
export async function savePhoto(rqcHeaderId: string, blob: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', blob, (blob as File).name || 'photo.jpg');
    const res = await trySend('/api/files/upload', { method: 'POST', body: form });
    if (res) return (await res.json()).url;

    const db = offlineDb();
    if (!db) throw new Error('Penyimpanan offline tidak tersedia di browser ini.');
    const photoId = uuid();
    await db.inspectionPhotos.add({ photoId, rqcHeaderId, blob, createdAt: Date.now() });
    return LOCAL_PHOTO + photoId;
}

/** POST of one process's inspection (qty checking + the defects sent). */
export async function saveProcess(
    rqcHeaderId: string,
    setupAreaId: string,
    setupProcessId: string,
    payload: ProcessPayload,
    display: { processName?: string },
): Promise<{ queued: boolean }> {
    if (!(await mustQueue(rqcHeaderId))) {
        const res = await trySend(
            `/api/rqc/headers/${rqcHeaderId}/areas/${setupAreaId}/processes/${setupProcessId}/inspections`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        );
        if (res) return { queued: false };
    }
    await enqueue(rqcHeaderId, { type: 'saveProcess', setupAreaId: String(setupAreaId), setupProcessId: String(setupProcessId), payload, display });
    return { queued: true };
}

/** DELETE of one process's inspection (resets the process). */
export async function deleteProcess(rqcHeaderId: string, setupAreaId: string, setupProcessId: string): Promise<{ queued: boolean }> {
    if (!(await mustQueue(rqcHeaderId))) {
        const res = await trySend(`/api/rqc/headers/${rqcHeaderId}/areas/${setupAreaId}/processes/${setupProcessId}/inspections`, { method: 'DELETE' });
        if (res) return { queued: false };
    }
    await enqueue(rqcHeaderId, { type: 'deleteProcess', setupAreaId: String(setupAreaId), setupProcessId: String(setupProcessId) });
    return { queued: true };
}

/**
 * Deletes an audit. One made offline (never sent) is removed from the device with its queue and
 * photos. A server audit needs the connection: deleting can't wait for a sync.
 */
export async function deleteHeader(rqcHeaderId: string) {
    const db = offlineDb();
    if (db && (await db.inspectionDrafts.get(rqcHeaderId))) {
        await db.transaction('rw', db.inspectionDrafts, db.syncQueue, db.inspectionPhotos, async () => {
            await db.inspectionDrafts.delete(rqcHeaderId);
            await db.syncQueue.where('rqcHeaderId').equals(rqcHeaderId).delete();
            await db.inspectionPhotos.where('rqcHeaderId').equals(rqcHeaderId).delete();
        });
        return;
    }
    const res = await trySend(`/api/rqc/headers/${rqcHeaderId}`, { method: 'DELETE' });
    if (!res) throw new Error('Menghapus inspeksi butuh koneksi ke server. Coba lagi saat online.');
    // Changes still queued for it would fail against a deleted header
    await db?.syncQueue.where('rqcHeaderId').equals(rqcHeaderId).delete();
}

// ── Master data for offline use ─────────────────────────────────────────────────

const MASTER_REFRESH_MS = 6 * 60 * 60 * 1000;

/**
 * Keeps what starting an audit needs on the device for every active model: CTQ tree, POs and
 * factories (a few hundred KB in total). Runs when the dashboard opens online, at most every 6h.
 */
export async function prefetchMasterData(models: { setupModelId: string | number }[]) {
    const db = offlineDb();
    if (!db) return;
    const urls = [
        '/api/master/factories',
        '/api/ctq-setup/models',
        ...models.flatMap(m => [
            `/api/ctq-setup/models/${m.setupModelId}/tree`,
            `/api/master/pos?setupModelId=${encodeURIComponent(String(m.setupModelId))}`,
        ]),
    ];
    for (const url of urls) {
        const kept = await db.masterCache.get(url);
        if (kept && Date.now() - kept.savedAt < MASTER_REFRESH_MS) continue;
        try {
            await getJson(url);
        } catch {
            return; // offline or API down: try again next time
        }
    }

    // Each model's History and Header pages, so they open offline even if never visited on this
    // device (the service worker keeps HTML it fetches; see src/app/sw.ts)
    if (!navigator.serviceWorker?.controller) return;
    const PAGES_KEY = 'ctq_offline_pages_at';
    try {
        if (Date.now() - Number(localStorage.getItem(PAGES_KEY) || 0) < MASTER_REFRESH_MS) return;
    } catch { /* storage blocked: just fetch */ }
    for (const m of models) {
        for (const page of [`/audit/${m.setupModelId}/history`, `/audit/${m.setupModelId}/header`]) {
            await fetch(page, { headers: { Accept: 'text/html' } }).catch(() => null);
        }
    }
    try { localStorage.setItem(PAGES_KEY, String(Date.now())); } catch { /* ignore */ }
}

/** Number of changes waiting to be sent (for the status indicator). */
export async function pendingCount() {
    return (await offlineDb()?.syncQueue.count()) ?? 0;
}
