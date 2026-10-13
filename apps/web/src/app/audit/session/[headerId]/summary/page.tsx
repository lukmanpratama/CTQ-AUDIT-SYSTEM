'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { use } from 'react';

const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const processImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('/ctqaudit/')) {
        const parts = url.split('/ctqaudit/');
        if (parts.length > 1) return `/api/files/${parts[1]}`;
    }
    return url;
};

function AuditSummaryInner(props: { params: Promise<{ headerId: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const router = useRouter();
    const resolvedParams = use(props.params);
    const headerId = resolvedParams.headerId;

    // In Next 15, searchParams is also a promise, but it might be undefined if not provided explicitly in the type depending on route structure.
    // To safely unwrap, we use `use` conditionally or handle it via a wrapper. But since `searchParams` is standardized, we can assume it's passed or fallback to hook.
    // Better yet, since it's a client component, let's use `useSearchParams` hook to avoid Promise issues entirely.
    const searchParams = useSearchParams();
    const viewOnly = searchParams.get('view') === 'true';
    const source = searchParams.get('source');

    const [loading, setLoading] = useState(true);
    const [header, setHeader] = useState<any>(null);
    const [defectNames, setDefectNames] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchHeader = async () => {
            try {
                const res = await fetch(`/api/rqc/headers/${headerId}`);
                if (res.ok) {
                    const data = await res.json();
                    setHeader(data);
                    if (data.setupModelId) {
                        try {
                            const treeRes = await fetch(`/api/ctq-setup/models/${data.setupModelId}/tree`);
                            if (treeRes.ok) {
                                const tree = await treeRes.json();
                                const names: Record<string, string> = {};
                                tree.areas?.forEach((area: any) => {
                                    area.setupProcesses?.forEach((proc: any) => {
                                        proc.setupDefects?.forEach((sd: any) => {
                                            if (sd.masterDefect?.defect) names[String(sd.defectId)] = sd.masterDefect.defect;
                                        });
                                    });
                                });
                                setDefectNames(names);
                            }
                        } catch (e) {
                            console.error('Failed to fetch defect names', e);
                        }
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch summary data', err);
                setLoading(false);
            }
        };
        fetchHeader();
    }, [headerId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <p className="animate-pulse text-gray-500 font-medium">Loading Summary...</p>
            </div>
        );
    }

    if (!header) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <p className="text-red-500 font-medium">Error loading data.</p>
            </div>
        );
    }

    // Computing metrics
    let totalQtyChecking = 0;
    let totalQtyDefect = 0;
    let iaCount = 0;
    let capCount = 0;
    let totalProcesses = 0;

    const iaProcesses: string[] = [];
    const capProcesses: string[] = [];

    if (header.rqcAreas) {
        header.rqcAreas.forEach((area: any) => {
            if (area.rqcProcesses) {
                area.rqcProcesses.forEach((proc: any) => {
                    totalProcesses++;
                    totalQtyChecking += proc.qtyChecking;

                    let hasCap = false;
                    let hasIa = false;

                    proc.rqcInspections?.forEach((insp: any) => {
                        totalQtyDefect += insp.qtyDefect;
                        if (insp.status === 'CAP') hasCap = true;
                        if (insp.status === 'IMMEDIATE_ACTION' || insp.status === 'IA') hasIa = true;
                    });

                    if (hasCap) {
                        capCount++;
                        capProcesses.push(proc.setupProcess?.masterProcess?.process || 'Unknown Process');
                    } else if (hasIa) {
                        iaCount++;
                        iaProcesses.push(proc.setupProcess?.masterProcess?.process || 'Unknown Process');
                    }
                });
            }
        });
    }

    const defectRate = totalQtyChecking > 0 ? (totalQtyDefect / totalQtyChecking) * 100 : 0;
    const passRate = 100 - defectRate;

    const iaPercent = totalProcesses > 0 ? (iaCount / totalProcesses) * 100 : 0;
    const capPercent = totalProcesses > 0 ? (capCount / totalProcesses) * 100 : 0;

    const handleSubmit = async () => {
        setSubmitting(true);
        // Usually transitions to a success screen or history
        setTimeout(() => {
            router.push('/dashboard');
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative">
            {/* Top Navigation Bar */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                <button
                    onClick={() => {
                        if (source === 'admin') router.push('/admin/inspections');
                        else if (viewOnly) {
                            if (header?.setupModelId) {
                                router.push(`/audit/${header.setupModelId}/history`);
                            } else {
                                router.push('/dashboard');
                            }
                        }
                        else router.push(`/audit/session/${headerId}`);
                    }}
                    className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors"
                >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {source === 'admin' ? 'Inspection Report' : viewOnly ? 'Inspection History' : 'New Report'}
                </button>
                <div className="flex items-center text-gray-400 text-sm font-semibold">
                    {viewOnly ? '✅ Completed' : '💾 Draft'}
                </div>
            </nav>

            {/* Stepper UI Progress - Summary is Active */}
            <div className="bg-white px-2 py-4 shadow-sm mb-4 flex justify-center items-center text-sm font-bold border-b border-gray-100 sticky top-[56px] z-20">
                <div className="flex items-center text-primary-600">
                    <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                    </svg>
                    Header
                </div>
                <div className="w-8 h-px bg-gray-300 mx-2"></div>
                <div className="flex items-center text-primary-600">
                    <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                    </svg>
                    Inspection
                </div>
                <div className="w-8 h-px bg-gray-300 mx-2"></div>
                <div className="flex items-center text-gray-900">
                    <span className="w-4 h-4 rounded-full bg-gray-900 flex-shrink-0 mr-2"></span> Summary
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 px-4 overflow-y-auto w-full pb-10 space-y-6 max-w-2xl mx-auto">

                {/* 1. Report Information */}
                <div>
                    <h2 className="text-gray-900 font-bold mb-3">Report Information</h2>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gray-900"></div>
                        <div className="flex text-sm">
                            <span className="text-gray-500 w-32 font-medium">Date</span>
                            <span className="text-gray-900 font-semibold">: {formatDate(header.date)}</span>
                        </div>
                        <div className="flex text-sm">
                            <span className="text-gray-500 w-32 font-medium">Checking Time</span>
                            <span className="text-gray-900 font-semibold">: {header.checkingTime === 'Morning' ? '🌅 ' : (header.checkingTime === 'Afternoon' ? '🌤️ ' : '')}{header.checkingTime}</span>
                        </div>
                        <div className="flex text-sm">
                            <span className="text-gray-500 w-32 font-medium">Model</span>
                            <span className="text-gray-900 font-semibold">: {header.model}</span>
                        </div>
                        <div className="flex text-sm">
                            <span className="text-gray-500 w-32 font-medium">PO</span>
                            <span className="text-gray-900 font-semibold">: {header.po}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Inspection Summary */}
                <div>
                    <h2 className="text-gray-900 font-bold mb-3">Inspection Summary</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Qty Checking */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Qty Checking</span>
                            <div className="text-xl font-extrabold text-gray-900">{totalQtyChecking.toLocaleString()} <span className="text-sm font-medium">Pcs</span></div>
                        </div>
                        {/* Qty Defect */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Qty Defect</span>
                            <div className="text-xl font-extrabold text-red-600">{totalQtyDefect.toLocaleString()} <span className="text-sm font-medium">Pcs</span></div>
                        </div>
                        {/* Pass Rate */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
                            <span className="text-xs text-green-600 font-bold uppercase tracking-wider mb-2">Pass Rate</span>
                            <div className="text-2xl font-extrabold text-green-600">{passRate.toFixed(2)} %</div>
                        </div>
                        {/* Defect Rate */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
                            <span className="text-xs text-red-600 font-bold uppercase tracking-wider mb-2">Defect Rate</span>
                            <div className="text-2xl font-extrabold text-red-600">{defectRate.toFixed(2)} %</div>
                        </div>
                    </div>
                </div>

                {/* 3. Result Summary */}
                <div>
                    <h2 className="text-gray-900 font-bold mb-3">Result Summary</h2>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-6">
                        {/* Immediate Action */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-700">Immediate Action</span>
                                <span className="text-sm font-bold text-orange-600">{iaCount} Process</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-orange-500" style={{ width: `${iaPercent}%` }}></div>
                                <div className="h-full bg-gray-200 striped-bg opacity-30" style={{ width: `${100 - iaPercent}%` }}></div>
                            </div>
                            {iaProcesses.length > 0 && (
                                <ul className="mt-3 space-y-1.5 pl-1">
                                    {iaProcesses.map((p, i) => (
                                        <li key={i} className="text-xs font-semibold text-gray-500 flex items-start">
                                            <svg className="w-4 h-4 text-orange-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* CAP */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-gray-700">CAP</span>
                                <span className="text-sm font-bold text-red-600">{capCount} Process</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-red-600" style={{ width: `${capPercent}%` }}></div>
                                <div className="h-full bg-gray-200 striped-bg opacity-30" style={{ width: `${100 - capPercent}%` }}></div>
                            </div>
                            {capProcesses.length > 0 && (
                                <ul className="mt-3 space-y-1.5 pl-1">
                                    {capProcesses.map((p, i) => (
                                        <li key={i} className="text-xs font-semibold text-gray-500 flex items-start">
                                            <svg className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. Defect Evidence Photos */}
                {(() => {
                    const photoInspections: any[] = [];
                    header.rqcAreas?.forEach((area: any) => {
                        area.rqcProcesses?.forEach((proc: any) => {
                            proc.rqcInspections?.forEach((insp: any) => {
                                // Show every finding (with or without photos) so its action details are visible
                                if (insp.qtyDefect > 0 || insp.photoDefect || insp.photoAfterActionPlan) {
                                    photoInspections.push({
                                        processName: proc.setupProcess?.masterProcess?.process || 'Unknown',
                                        defectName: insp.masterDefect?.defect || defectNames[String(insp.defectId)] || (insp.defectId ? `Defect #${insp.defectId}` : '-'),
                                        photoDefect: insp.photoDefect,
                                        photoAfterActionPlan: insp.photoAfterActionPlan,
                                        status: insp.status,
                                        actionPlan: insp.actionPlan,
                                        rootCause: insp.rootCause,
                                        corrective: insp.corrective,
                                    });
                                }
                            });
                        });
                    });

                    if (photoInspections.length === 0) return null;

                    return (
                        <div>
                            <h2 className="text-gray-900 font-bold mb-3">Defect Evidence</h2>
                            <div className="space-y-4">
                                {photoInspections.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex justify-between items-start gap-3 mb-3">
                                            <p className="text-sm font-bold text-gray-900">{item.processName}</p>
                                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${item.status === 'CAP' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                {item.status === 'CAP' ? 'CAP' : 'Immediate Action'}
                                            </span>
                                        </div>
                                        <dl className="mb-3 rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100 text-xs">
                                            {[
                                                { label: 'Defect Name', value: item.defectName },
                                                // Immediate Action only has an Action Plan; CAP has Root Cause + Corrective Action
                                                ...(item.status === 'CAP'
                                                    ? [
                                                        { label: 'Root Cause', value: item.rootCause },
                                                        { label: 'Corrective Action', value: item.corrective },
                                                    ]
                                                    : [{ label: 'Action Plan', value: item.actionPlan }]),
                                            ].map(row => (
                                                <div key={row.label} className="flex gap-3 px-3 py-2">
                                                    <dt className="w-32 flex-shrink-0 font-semibold text-gray-500">{row.label}</dt>
                                                    <dd className={`flex-1 min-w-0 break-words whitespace-pre-line ${row.value && String(row.value).trim() ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                                                        {row.value && String(row.value).trim() ? row.value : 'Belum diisi'}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                        {(item.photoDefect || item.photoAfterActionPlan) && (
                                        <div className="flex gap-3">
                                            {item.photoDefect && (
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">📷 Foto Defect</p>
                                                    <a href={processImageUrl(item.photoDefect)} target="_blank" rel="noopener noreferrer">
                                                        <img src={processImageUrl(item.photoDefect)} alt="Defect" className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm hover:opacity-80 transition-opacity" />
                                                    </a>
                                                </div>
                                            )}
                                            {item.photoAfterActionPlan && (
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">📷 Foto Improvement</p>
                                                    <a href={processImageUrl(item.photoAfterActionPlan)} target="_blank" rel="noopener noreferrer">
                                                        <img src={processImageUrl(item.photoAfterActionPlan)} alt="Improvement" className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm hover:opacity-80 transition-opacity" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-10">
                <div className="max-w-2xl mx-auto w-full flex justify-between gap-4">
                    {viewOnly ? (
                        <button
                            onClick={() => router.push(`/audit/session/${headerId}?view=true${source ? `&source=${source}` : ''}`)}
                            className="w-full flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg shadow-md hover:bg-gray-800 transition-colors"
                        >
                            View Details
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => router.push(`/audit/session/${headerId}`)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg"
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg shadow-md disabled:bg-gray-400"
                            >
                                {submitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Striped Background Style for progress bars */}
            <style jsx>{`
                .striped-bg {
                    background-image: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 4px,
                        #9ca3af 4px,
                        #9ca3af 8px
                    );
                }
            `}</style>
        </div>
    );
}

export default function AuditSummaryPage(props: { params: Promise<{ headerId: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center"><p className="animate-pulse text-gray-500 font-medium">Loading Summary...</p></div>}>
            <AuditSummaryInner {...props} />
        </Suspense>
    );
}
