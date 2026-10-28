'use client';

// Connection / sync status for inspectors: works offline, changes waiting to be sent, sending,
// and changes the server refused (with Coba lagi / Buang). Hidden when online with nothing queued.
// Also starts the sync triggers (app open, back online, back to the tab).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { liveQuery } from 'dexie';
import { offlineDb, type QueueItem } from '../lib/offline/db';
import { useOffline } from '../lib/offline/connectivity';
import { discardChange, retryChange, startSyncTriggers, syncNow, useSyncing } from '../lib/offline/sync-engine';

const changeLabel = (item: QueueItem) => {
    switch (item.type) {
        case 'createHeader': return 'Mulai audit';
        case 'updateHeader': return 'Ubah header audit';
        case 'saveProcess': return `Simpan proses ${item.display?.processName ?? ''}`.trim();
        case 'deleteProcess': return 'Reset proses';
    }
};

/** "21 Okt 2026 · Morning · PO 0903616417" for the audit a change belongs to, from the device copy. */
async function auditLabel(rqcHeaderId: string) {
    const db = offlineDb();
    const view: any = (await db?.inspectionDrafts.get(rqcHeaderId))?.view
        ?? (await db?.masterCache.get(`/api/rqc/headers/${rqcHeaderId}`))?.data;
    if (!view) return `Audit ${rqcHeaderId.slice(0, 8)}`;
    const date = view.date ? new Date(view.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return [date, view.checkingTime, view.po && `PO ${view.po}`].filter(Boolean).join(' · ');
}

export function OfflineSyncStatus() {
    const pathname = usePathname();
    const offline = useOffline();
    const syncing = useSyncing();
    const [items, setItems] = useState<QueueItem[]>([]);
    const [panelOpen, setPanelOpen] = useState(false);
    const [labels, setLabels] = useState<Record<string, string>>({});

    useEffect(() => {
        startSyncTriggers();
        const db = offlineDb();
        if (!db) return;
        // Updates by itself whenever the queue changes (also from another tab)
        const subscription = liveQuery(() => db.syncQueue.orderBy('seq').toArray()).subscribe({
            next: setItems,
            error: () => setItems([]),
        });
        return () => subscription.unsubscribe();
    }, []);

    const attention = items.filter(i => i.status === 'NEEDS_ATTENTION');
    const waiting = items.length - attention.length;

    useEffect(() => {
        if (!panelOpen) return;
        Promise.all([...new Set(attention.map(i => i.rqcHeaderId))].map(async id => [id, await auditLabel(id)] as const))
            .then(entries => setLabels(Object.fromEntries(entries)));
        if (attention.length === 0) setPanelOpen(false);
    }, [panelOpen, items]); // eslint-disable-line react-hooks/exhaustive-deps

    if (pathname === '/login' || (!offline && !syncing && items.length === 0)) return null;

    const pill =
        attention.length > 0
            ? { style: 'bg-red-600 text-white', dot: 'bg-white', text: `${attention.length} perubahan perlu tindakan`, onClick: () => setPanelOpen(true) }
            : syncing
                ? { style: 'bg-blue-600 text-white', dot: 'bg-white animate-pulse', text: `Mengirim ${waiting} perubahan...`, onClick: undefined }
                : offline
                    ? { style: 'bg-gray-900 text-white', dot: 'bg-amber-400', text: `Offline · data disimpan di perangkat${waiting ? ` · ${waiting} belum terkirim` : ''}`, onClick: undefined }
                    : { style: 'bg-amber-100 text-amber-900 border border-amber-300', dot: 'bg-amber-500', text: `${waiting} perubahan menunggu dikirim · ketuk untuk kirim`, onClick: () => void syncNow() };

    return (
        <>
            <div className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[9998]" role="status" aria-live="polite">
                <button
                    type="button"
                    onClick={pill.onClick}
                    disabled={!pill.onClick}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg whitespace-nowrap ${pill.style} ${pill.onClick ? '' : 'cursor-default'}`}
                >
                    <span className={`h-2 w-2 rounded-full ${pill.dot}`} />
                    {pill.text}
                </button>
            </div>

            {panelOpen && (
                <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setPanelOpen(false)}>
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                            <h2 className="text-sm font-bold text-gray-900">Perubahan yang ditolak server</h2>
                            <button onClick={() => setPanelOpen(false)} className="px-2 text-gray-400 hover:text-gray-700" aria-label="Tutup">✕</button>
                        </div>
                        <p className="px-4 pt-3 text-xs text-gray-500">
                            Data ini masih tersimpan di perangkat. Perbaiki penyebabnya lalu <b>Coba lagi</b>, atau <b>Buang</b> jika memang tidak perlu dikirim.
                            Perubahan lain pada audit yang sama menunggu di belakangnya.
                        </p>
                        <ul className="divide-y divide-gray-100 px-4 py-2">
                            {attention.map(item => (
                                <li key={item.mutationId} className="py-3">
                                    <p className="text-sm font-semibold text-gray-900">{changeLabel(item)}</p>
                                    <p className="text-xs text-gray-500">{labels[item.rqcHeaderId] ?? '...'}</p>
                                    <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 break-words">{item.error}</p>
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                const what = item.type === 'createHeader'
                                                    ? 'Buang audit ini beserta semua isinya dari perangkat? Data ini belum ada di server dan tidak bisa dikembalikan.'
                                                    : 'Buang perubahan ini dari perangkat? Perubahan ini tidak akan dikirim ke server.';
                                                if (confirm(what)) void discardChange(item);
                                            }}
                                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                        >
                                            Buang
                                        </button>
                                        <button
                                            onClick={() => void retryChange(item.seq!)}
                                            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                                        >
                                            Coba lagi
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
}
