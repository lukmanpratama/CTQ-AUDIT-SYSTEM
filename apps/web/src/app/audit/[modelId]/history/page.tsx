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
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative sm:max-w-md sm:mx-auto shadow-xl bg-white border-x">
            {/* Top Navigation Bar */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                <button onClick={() => router.push('/dashboard')} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Dashboard
                </button>
            </nav>

            <div className="flex-1 p-5 overflow-y-auto">
                <h1 className="text-xl font-bold text-gray-900 mb-1">Inspection History</h1>
                <p className="text-sm text-gray-500 mb-6">Past records for this model.</p>

                {loading ? (
                    <p className="text-gray-500 text-sm animate-pulse text-center mt-10">Loading records...</p>
                ) : headers.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 border border-gray-200 border-dashed rounded-xl mt-4">
                        <p className="text-gray-500 text-sm mb-2">Belum ada riwayat inspeksi.</p>
                    </div>
                ) : (
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
                                <Link href={`/audit/session/${h.rqcHeaderId}/summary?view=true`} key={h.rqcHeaderId} className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-gray-300 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-gray-900 text-sm">{formatDate(h.date)}</div>
                                        <div className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600">PO: {h.po}</div>
                                    </div>
                                    <div className="text-xs text-gray-500 mb-3">{h.checkingTime} • Inspector: {h.nik}</div>

                                    <div className="flex justify-between text-xs align-bottom">
                                        <div>
                                            <span className="font-semibold text-gray-800">{checks}</span> Checked<br />
                                            <span className="font-semibold text-red-500">{defects}</span> Defects
                                        </div>
                                        <div className="text-right">
                                            Rate<br />
                                            <span className="text-sm font-bold text-red-600">{defectRate}%</span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Floating Button for New Report */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-10 sm:max-w-md sm:translate-x-[-50%] sm:left-1/2 rounded-b-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => router.push(`/audit/${modelId}/header`)}
                    className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New Report
                </button>
            </div>
        </div>
    );
}
