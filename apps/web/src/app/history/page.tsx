'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getJson } from '../../lib/offline/inspection-repository';
import { useDataRefresh } from '../../lib/use-data-refresh';
import { inspectorSessionUrl } from '../../features/rqc/audit-nav';

export default function HistoryPage() {
    const router = useRouter();
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { refreshKey } = useDataRefresh();

    useEffect(() => {
        getJson<any[]>('/api/rqc/headers')
            .then(headers => setHistoryList(headers || []))
            .catch(err => console.error('Error fetching history', err))
            .finally(() => setLoading(false));
    }, [refreshKey]);

    return (
        <main className="py-6 px-4 sm:px-6 max-w-2xl mx-auto w-full min-h-[calc(100vh-7.5rem)] bg-gray-50">
            <div className="mb-6">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0E2947] to-[#1A3A60]">
                    Audit History
                </h2>
                <p className="text-gray-500 text-sm">Riwayat inspeksi audit yang telah dibuat.</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="text-gray-500 font-medium animate-pulse">Memuat riwayat audit...</span>
                </div>
            ) : historyList.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                    <p className="text-gray-500 text-base font-medium mb-3">Belum ada riwayat inspeksi audit.</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-5 py-2.5 bg-[#0E2947] text-white text-sm font-semibold rounded-xl hover:bg-[#091E35] transition-colors"
                    >
                        Mulai Audit Baru
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {historyList.slice(0, 30).map((h) => {
                        const dateStr = h.createdAt
                            ? new Date(h.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-';
                        const modelName = h.setupModel?.modelName || 'Unknown Model';
                        const modelNo = h.setupModel?.modelNo || '';
                        return (
                            <div
                                key={h.rqcHeaderId}
                                onClick={() => router.push(inspectorSessionUrl(h.rqcHeaderId))}
                                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-gray-900 text-sm truncate">{modelName}</span>
                                        {modelNo && <span className="text-xs font-mono text-gray-500">({modelNo})</span>}
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-100">
                                            Cell {h.cell || '-'} • {h.factory?.factoryName || 'Factory'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
