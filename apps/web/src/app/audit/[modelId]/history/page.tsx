'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { use } from 'react';

export default function RqcModelHistoryPage({ params }: { params: Promise<{ modelId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const modelId = resolvedParams.modelId;

    const [loading, setLoading] = useState(true);
    const [headers, setHeaders] = useState<any[]>([]);

    useEffect(() => {
        fetch(`/api/rqc/headers?modelId=${modelId}`)
            .then(res => res.json())
            .then(data => {
                setHeaders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load headers', err);
                setLoading(false);
            });
    }, [modelId]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative">
            {/* Top Navigation Bar */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                <button onClick={() => router.push('/dashboard')} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                </button>
            </nav>

            <div className="flex-1 p-5 overflow-y-auto max-w-2xl mx-auto w-full">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Inspection History</h1>
                <p className="text-sm text-gray-500 mb-6">Past records for this model.</p>

                {loading ? (
                    <p className="text-gray-500 text-sm animate-pulse text-center mt-10">Loading records...</p>
                ) : headers.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 border border-gray-200 border-dashed rounded-xl mt-4">
                        <p className="text-gray-500 text-sm mb-2">Belum ada riwayat inspeksi.</p>
                    </div>
                ) : (
                    <>
                        {headers.length > 0 && headers[0].setupModel?.modelName && (
                            <p className="text-xs font-bold text-gray-800 bg-gray-100 uppercase tracking-widest inline-block px-3 py-1 rounded-full mb-4">
                                {headers[0].setupModel.modelName}
                            </p>
                        )}
                        <div className="space-y-4 mt-2">
                            {headers.map(h => {
                                let checks = 0;
                                let defects = 0;
                                h.rqcAreas?.forEach((a: any) => {
                                    a.rqcProcesses?.forEach((p: any) => {
                                        checks += p.qtyChecking || 0;
                                        p.rqcInspections?.forEach((i: any) => {
                                            defects += i.qtyDefect || 0;
                                        });
                                    });
                                });

                                const defectRate = checks > 0 ? ((defects / checks) * 100).toFixed(2) : '0';

                                return (
                                    <div
                                        key={h.rqcHeaderId}
                                        onClick={() => router.push(`/audit/session/${h.rqcHeaderId}/summary?view=true`)}
                                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-gray-400 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-gray-900 text-sm">{formatDate(h.date)}</div>
                                            <div className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600 border">PO: {h.po}</div>
                                        </div>
                                        <div className="text-xs text-gray-500 mb-3">{h.checkingTime} • Inspector: {h.nik}</div>

                                        <div className="flex justify-between text-xs align-bottom">
                                            <div>
                                                <span className="font-semibold text-gray-800">{checks}</span> Checked<br />
                                                <span className="font-semibold text-red-500">{defects}</span> Defects
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="text-right mb-2">
                                                    Rate<br />
                                                    <span className="text-sm font-bold text-red-600">{defectRate}%</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/audit/session/${h.rqcHeaderId}`);
                                                        }}
                                                        className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100"
                                                        title="Edit"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('Yakin ingin menghapus form inspeksi ini beserta seluruh data proses?')) {
                                                                const targetBtn = e.currentTarget as HTMLButtonElement | null;
                                                                if (targetBtn) targetBtn.disabled = true;
                                                                fetch(`/api/rqc/headers/${h.rqcHeaderId}`, { method: 'DELETE' })
                                                                    .then(res => {
                                                                        if (res.ok) setHeaders(headers.filter((r: any) => r.rqcHeaderId !== h.rqcHeaderId));
                                                                        else alert('Failed to delete.');
                                                                    });
                                                            }
                                                        }}
                                                        className="p-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors border border-red-100"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Floating Button for New Report */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-2xl mx-auto w-full">
                    <button
                        onClick={() => router.push(`/audit/${modelId}/header`)}
                        className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Report
                    </button>
                </div>
            </div>
        </div>
    );
}
