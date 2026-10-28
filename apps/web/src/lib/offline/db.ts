'use client';

// The app's offline store (IndexedDB via Dexie). Temporary storage on the device, not a
// replacement for the server database: drafts and the sync queue stay here until the server
// has confirmed them (stage 4), and are never deleted while unsynced.

import Dexie, { type Table } from 'dexie';

/** Last good response of a GET the audit pages need offline (models, tree, factories, POs, headers). */
export interface MasterCacheEntry {
    url: string;
    data: unknown;
    savedAt: number;
}

/** An inspection header created on this device while offline (the server doesn't know it yet). */
export interface InspectionDraft {
    /** Client-generated UUID, also used as the server id when it syncs */
    rqcHeaderId: string;
    setupModelId: string;
    /** Exactly what POST /api/rqc/headers expects */
    payload: { date: string; checkingTime: string; setupModelId: string; po: string; factoryId: string; cell: string; nik: string };
    /** Header as the pages show it (same shape as GET /api/rqc/headers/:id), without the queued process saves */
    view: Record<string, any>;
    createdAt: number;
}

/** A photo taken offline; it goes to the server (POST /api/files/upload) when the queue syncs. */
export interface InspectionPhoto {
    photoId: string;
    rqcHeaderId: string;
    blob: Blob;
    createdAt: number;
}

export type SyncStatus = 'PENDING_SYNC' | 'SYNCING' | 'NEEDS_ATTENTION';

/**
 * A change made offline, replayed against the API in order when the connection is back.
 * `display` holds names the server would add (shown while the change is still on the device).
 */
export type SyncMutation =
    | { type: 'createHeader' }
    | { type: 'updateHeader'; payload: { date: string; checkingTime: string; po: string; factoryId: string; cell: string }; display?: { factoryName?: string } }
    | { type: 'saveProcess'; setupAreaId: string; setupProcessId: string; payload: ProcessPayload; display?: { processName?: string } }
    | { type: 'deleteProcess'; setupAreaId: string; setupProcessId: string };

export type QueueItem = SyncMutation & {
    /** Unique per change and kept on retries (idempotency key for the sync) */
    mutationId: string;
    /** Auto-increment: the replay order */
    seq?: number;
    rqcHeaderId: string;
    status: SyncStatus;
    createdAt: number;
    error?: string;
};

/** Body of POST /api/rqc/headers/:id/areas/:a/processes/:p/inspections. Photos may be `local-photo:<photoId>`. */
export interface ProcessPayload {
    qtyChecking: number;
    defects: {
        defectId: string;
        qtyDefect: number;
        actionPlan?: string;
        rootCause?: string;
        corrective?: string;
        durasiStopline?: number;
        photoDefect?: string;
        photoAfterActionPlan?: string;
    }[];
}

class CtqOfflineDb extends Dexie {
    masterCache!: Table<MasterCacheEntry, string>;
    inspectionDrafts!: Table<InspectionDraft, string>;
    inspectionPhotos!: Table<InspectionPhoto, string>;
    syncQueue!: Table<QueueItem, number>;

    constructor() {
        super('ctq-audit-offline');
        this.version(1).stores({
            masterCache: 'url',
            inspectionDrafts: 'rqcHeaderId, setupModelId',
            inspectionPhotos: 'photoId, rqcHeaderId',
            syncQueue: '++seq, &mutationId, rqcHeaderId, status',
        });
    }
}

let instance: CtqOfflineDb | null = null;

/** The database, or null where IndexedDB isn't available (server render, some private modes). */
export function offlineDb(): CtqOfflineDb | null {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
    if (!instance) instance = new CtqOfflineDb();
    return instance;
}
