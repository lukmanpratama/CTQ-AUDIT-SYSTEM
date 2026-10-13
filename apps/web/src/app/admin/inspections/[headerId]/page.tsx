'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const processImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('/ctqaudit/')) {
        const parts = url.split('/ctqaudit/');
        if (parts.length > 1) return `/api/files/${parts[1]}`;
    }
    return url;
};

const hasText = (v: any) => !!(v && String(v).trim());

const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AdminInspectionSummaryPage({ params }: { params: Promise<{ headerId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const headerId = resolvedParams.headerId;

    const [loading, setLoading] = useState(true);
    const [header, setHeader] = useState<any>(null);
    const [defectNames, setDefectNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchHeader = async () => {
            try {
                const res = await fetch(`/api/rqc/headers/${headerId}`);
                if (res.ok) {
                    const data = await res.json();
                    setHeader(data);
                    // Defect names come from the model's CTQ setup (same source as the Defect Type dropdown)
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
            <div className="flex justify-center items-center h-64 text-gray-500 font-medium animate-pulse">
                Loading inspection details...
            </div>
        );
    }

    if (!header) {
        return (
            <div className="flex justify-center items-center h-64 text-red-500 font-medium">
                Data was not found.
            </div>
        );
    }

    // Metrics computation
    let totalQtyChecking = 0;
    let totalQtyDefect = 0;
    const findings: any[] = [];

    if (header.rqcAreas) {
        header.rqcAreas.forEach((area: any) => {
            if (area.rqcProcesses) {
                area.rqcProcesses.forEach((proc: any) => {
                    totalQtyChecking += proc.qtyChecking;

                    proc.rqcInspections?.forEach((insp: any) => {
                        totalQtyDefect += insp.qtyDefect;
                        if (insp.qtyDefect > 0 || insp.photoDefect || insp.photoAfterActionPlan) {
                            findings.push({
                                id: insp.rqcInspectionId,
                                processName: proc.setupProcess?.masterProcess?.process || 'Unknown Process',
                                defectName: insp.masterDefect?.defect || defectNames[String(insp.defectId)] || `Defect #${insp.defectId}`,
                                qtyDefect: insp.qtyDefect,
                                qtyChecking: proc.qtyChecking,
                                isCap: insp.status === 'CAP',
                                actionPlan: insp.actionPlan,
                                rootCause: insp.rootCause,
                                corrective: insp.corrective,
                                photoDefect: insp.photoDefect,
                                photoAfterActionPlan: insp.photoAfterActionPlan,
                            });
                        }
                    });
                });
            }
        });
    }

    const defectRate = totalQtyChecking > 0 ? (totalQtyDefect / totalQtyChecking) * 100 : 0;
    const passRate = 100 - defectRate;

    // Resolution tracking is counted per defect (same rows as Defect Evidence), so a process
    // that has both an Immediate Action defect and a CAP defect shows up in both lists.
    const defectFindings = findings.filter(f => f.qtyDefect > 0);
    const iaFindings = defectFindings.filter(f => !f.isCap);
    const capFindings = defectFindings.filter(f => f.isCap);
    const iaCount = iaFindings.length;
    const capCount = capFindings.length;
    const iaPercent = defectFindings.length > 0 ? (iaCount / defectFindings.length) * 100 : 0;
    const capPercent = defectFindings.length > 0 ? (capCount / defectFindings.length) * 100 : 0;

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center space-x-3 mb-6">
                <Link href="/admin/inspections" className="p-2 border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-gray-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </Link>
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Inspection Summary</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Detailed view of `{header.po}` for {header.model}.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Information */}
                <div>
                    <h2 className="text-gray-900 font-bold mb-3">Report Details</h2>
                    <div className="bg-white border text-sm border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex border-b border-gray-100 pb-3">
                            <span className="text-gray-500 w-40 font-medium">Date</span>
                            <span className="text-gray-900 font-semibold">{formatDate(header.date)}</span>
                        </div>
                        <div className="flex border-b border-gray-100 pb-3">
                            <span className="text-gray-500 w-40 font-medium">Checking Time</span>
                            <span className="text-gray-900 font-semibold">{header.checkingTime}</span>
                        </div>
                        <div className="flex border-b border-gray-100 pb-3">
                            <span className="text-gray-500 w-40 font-medium">Model</span>
                            <span className="text-gray-900 font-semibold">{header.model}</span>
                        </div>
                        <div className="flex border-b border-gray-100 pb-3">
                            <span className="text-gray-500 w-40 font-medium">PO Number</span>
                            <span className="text-gray-900 font-bold px-2 py-0.5 rounded bg-gray-100">{header.po}</span>
                        </div>
                        <div className="flex border-b border-gray-100 pb-3">
                            <span className="text-gray-500 w-40 font-medium">Factory / Cell</span>
                            <span className="text-gray-900 font-semibold">{header.factory?.factory || '-'} / {header.cell || '-'}</span>
                        </div>
                        <div className="flex pt-1">
                            <span className="text-gray-500 w-40 font-medium">Inspector ID</span>
                            <span className="text-gray-900 font-semibold">{header.nik}</span>
                        </div>
                    </div>
                </div>

                {/* Metrics */}
                <div>
                    <h2 className="text-gray-900 font-bold mb-3">Overall Metrics</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Qty Checking</span>
                            <div className="text-2xl font-extrabold text-gray-900">{totalQtyChecking.toLocaleString()} <span className="text-sm font-medium text-gray-500">Pcs</span></div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Qty Defect</span>
                            <div className="text-2xl font-extrabold text-red-600">{totalQtyDefect.toLocaleString()} <span className="text-sm font-medium text-red-400">Pcs</span></div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-full translate-x-4 -translate-y-4"></div>
                            <span className="text-xs text-green-700 font-bold uppercase tracking-wider mb-2 block relative z-10">Pass Rate</span>
                            <div className="text-3xl font-extrabold text-green-600 relative z-10">{passRate.toFixed(2)}%</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-full translate-x-4 -translate-y-4"></div>
                            <span className="text-xs text-red-700 font-bold uppercase tracking-wider mb-2 block relative z-10">Defect Rate</span>
                            <div className="text-3xl font-extrabold text-red-600 relative z-10">{defectRate.toFixed(2)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI & CAP */}
            <div className="mt-8">
                <h2 className="text-gray-900 font-bold mb-3">Resolution Tracking</h2>
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Immediate Action */}
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-sm font-bold text-gray-800">Immediate Action Triggered</span>
                                <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{iaCount} Defect{iaCount !== 1 && 's'}</span>
                            </div>
                            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-4 relative">
                                <div className="h-full bg-orange-500" style={{ width: `${iaPercent}%` }}></div>
                                <div className="h-full bg-gray-200 striped-bg opacity-30" style={{ width: `${100 - iaPercent}%` }}></div>
                            </div>
                            {iaFindings.length > 0 ? (
                                <ul className="space-y-2 mt-4 bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                                    {iaFindings.map(f => (
                                        <li key={f.id} className="text-sm flex items-start">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2.5 mt-2 flex-shrink-0"></span>
                                            <span>
                                                <span className="font-semibold text-gray-900">{f.defectName}</span>
                                                <span className="block text-xs text-gray-500">{f.processName}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-400 italic mt-2">No immediate actions found.</p>
                            )}
                        </div>

                        {/* CAP */}
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-sm font-bold text-gray-800">Corrective Action Plan (CAP) Triggered</span>
                                <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{capCount} Defect{capCount !== 1 && 's'}</span>
                            </div>
                            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-4 relative">
                                <div className="h-full bg-red-600" style={{ width: `${capPercent}%` }}></div>
                                <div className="h-full bg-gray-200 striped-bg opacity-30" style={{ width: `${100 - capPercent}%` }}></div>
                            </div>
                            {capFindings.length > 0 ? (
                                <ul className="space-y-2 mt-4 bg-red-50/50 p-4 rounded-lg border border-red-100">
                                    {capFindings.map(f => (
                                        <li key={f.id} className="text-sm flex items-start">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2.5 mt-2 flex-shrink-0"></span>
                                            <span>
                                                <span className="font-semibold text-gray-900">{f.defectName}</span>
                                                <span className="block text-xs text-gray-500">{f.processName}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-400 italic mt-2">No CAPs found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Defect Evidence */}
            <div className="mt-8">
                <h2 className="text-gray-900 font-bold mb-3">Defect Evidence</h2>
                {findings.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-sm text-gray-400 italic">
                        No defects recorded in this inspection.
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-3">Defect / Process</th>
                                    <th className="px-4 py-3 text-right">Defect</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 min-w-[260px]">Follow-up</th>
                                    <th className="px-4 py-3">Photos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {findings.map(f => {
                                    // Immediate Action only has an Action Plan; CAP has Root Cause + Corrective Action
                                    const fields = f.isCap
                                        ? [{ label: 'Root Cause', value: f.rootCause }, { label: 'Corrective Action', value: f.corrective }]
                                        : [{ label: 'Action Plan', value: f.actionPlan }];
                                    const rate = f.qtyChecking > 0 ? (f.qtyDefect / f.qtyChecking) * 100 : 0;
                                    return (
                                        <tr key={f.id} className="align-top">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-gray-900">{f.defectName}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{f.processName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <div className="font-semibold text-red-600">{f.qtyDefect} / {f.qtyChecking}</div>
                                                <div className="text-xs text-gray-500">{rate.toFixed(2)}%</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${f.isCap ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                    {f.isCap ? 'CAP' : 'Immediate Action'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <dl className="space-y-1.5">
                                                    {fields.map(field => (
                                                        <div key={field.label}>
                                                            <dt className="text-xs font-medium text-gray-500">{field.label}</dt>
                                                            <dd className={`whitespace-pre-line break-words ${hasText(field.value) ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                                {hasText(field.value) ? field.value : 'Belum diisi'}
                                                            </dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    {[
                                                        { label: 'Defect', url: f.photoDefect },
                                                        { label: 'Improvement', url: f.photoAfterActionPlan },
                                                    ].map(photo => (
                                                        <div key={photo.label} className="w-24">
                                                            {photo.url ? (
                                                                <a href={processImageUrl(photo.url)} target="_blank" rel="noopener noreferrer" title={`Open ${photo.label} photo`}>
                                                                    <img src={processImageUrl(photo.url)} alt={photo.label} className="w-24 h-16 object-cover rounded-md border border-gray-200 hover:opacity-80 transition-opacity" />
                                                                </a>
                                                            ) : (
                                                                <div className="w-24 h-16 rounded-md border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400">No photo</div>
                                                            )}
                                                            <p className="text-[10px] text-gray-500 mt-1 text-center">{photo.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Striped Background Style */}
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
