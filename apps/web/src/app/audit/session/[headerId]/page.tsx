'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { use } from 'react';

export default function AuditSessionPage(props: { params: Promise<{ headerId: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const router = useRouter();
    const resolvedParams = use(props.params);
    const headerId = resolvedParams.headerId;

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const viewOnly = searchParams?.get('view') === 'true';
    const source = searchParams?.get('source');

    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<any[]>([]);
    const [headerData, setHeaderData] = useState<any>(null);

    // Modal State
    const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
    const [modalProcess, setModalProcess] = useState<any>(null);
    const [modalArea, setModalArea] = useState<any>(null);
    const [modalDefectId, setModalDefectId] = useState('');
    const [qtyChecking, setQtyChecking] = useState('20');
    const [qtyDefect, setQtyDefect] = useState('');
    const [savingDefect, setSavingDefect] = useState(false);

    // Form Action Fields
    const [actionPlan, setActionPlan] = useState('');
    const [rootCause, setRootCause] = useState('');
    const [corrective, setCorrective] = useState('');
    const [durasiStopline, setDurasiStopline] = useState('15');

    // Photo Capture States
    const [defectPhotoPreview, setDefectPhotoPreview] = useState<string | null>(null);
    const [improvementPhotoPreview, setImprovementPhotoPreview] = useState<string | null>(null);
    const [defectPhotoFile, setDefectPhotoFile] = useState<File | null>(null);
    const [improvementPhotoFile, setImprovementPhotoFile] = useState<File | null>(null);
    const defectPhotoInputRef = useRef<HTMLInputElement>(null);
    const improvementPhotoInputRef = useRef<HTMLInputElement>(null);

    // Accordion state
    const [expandedArea, setExpandedArea] = useState<string | null>(null);

    // Validation State
    const [attemptedNext, setAttemptedNext] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // 1. Fetch saved session state
                const headerRes = await fetch(`/api/rqc/headers/${headerId}`);
                const header = await headerRes.json();
                setHeaderData(header);

                if (header.setupModelId) {
                    // 2. Fetch CTQ tree
                    const treeRes = await fetch(`/api/ctq-setup/models/${header.setupModelId}/tree`);
                    const treeData = await treeRes.json();
                    setTree(treeData.areas || []);
                    if (treeData.areas && treeData.areas.length > 0) {
                        setExpandedArea(treeData.areas[0].setupAreaId);
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error("Failed fetching session data", err);
                setLoading(false);
            }
        };
        fetchAllData();
    }, [headerId]);

    // Derived states to map saved DB records against setup tree
    const getSavedProcessState = (setupAreaId: string, setupProcessId: string) => {
        if (!headerData || !headerData.rqcAreas) return null;
        const area = headerData.rqcAreas.find((a: any) => String(a.setupAreaId) === String(setupAreaId));
        if (!area) return null;
        const process = area.rqcProcesses.find((p: any) => String(p.setupProcessId) === String(setupProcessId));
        return process || null;
    };

    const getAreaProgress = (area: any) => {
        const total = area.setupProcesses?.length || 0;
        let completed = 0;
        area.setupProcesses?.forEach((proc: any) => {
            const saved = getSavedProcessState(area.setupAreaId, proc.setupProcessId);
            if (saved) completed++;
        });
        return { total, completed };
    };

    const handleOpenDefectModal = (area: any, process: any) => {
        setModalArea(area);
        setModalProcess(process);
        setModalDefectId('');
        setQtyChecking('20');
        setQtyDefect('');
        setActionPlan('');
        setRootCause('');
        setCorrective('');
        setDurasiStopline('15');
        setDefectPhotoPreview(null);
        setImprovementPhotoPreview(null);
        setDefectPhotoFile(null);
        setImprovementPhotoFile(null);
        setIsDefectModalOpen(true);
    };

    const handleDefectPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setDefectPhotoPreview(URL.createObjectURL(file));
            setDefectPhotoFile(file);
        }
    };

    const handleImprovementPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImprovementPhotoPreview(URL.createObjectURL(file));
            setImprovementPhotoFile(file);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSaveNoDefect = async (area: any, process: any) => {
        const payload = {
            qtyChecking: 20,
            defects: []
        };

        try {
            const res = await fetch(
                `/api/rqc/headers/${headerId}/areas/${area.setupAreaId}/processes/${process.setupProcessId}/inspections`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (res.ok) {
                // Refresh header data locally
                const headerRes = await fetch(`/api/rqc/headers/${headerId}`);
                const updatedHeader = await headerRes.json();
                setHeaderData(updatedHeader);
            } else {
                alert('Failed to save status.');
            }
        } catch (err) {
            console.error(err);
            alert('A network error occurred.');
        }
    };

    const handleDeleteProcess = async (area: any, process: any) => {
        if (!confirm('Are you sure you want to delete this inspection and reset the process?')) return;

        try {
            const res = await fetch(
                `/api/rqc/headers/${headerId}/areas/${area.setupAreaId}/processes/${process.setupProcessId}/inspections`,
                { method: 'DELETE' }
            );

            if (res.ok) {
                // Refresh header data locally
                const headerRes = await fetch(`/api/rqc/headers/${headerId}`);
                const updatedHeader = await headerRes.json();
                setHeaderData(updatedHeader);
            } else {
                alert('Failed to delete inspection.');
            }
        } catch (err) {
            console.error(err);
            alert('A network error occurred.');
        }
    };

    const handleSaveDefect = async () => {
        if (!modalDefectId || !qtyChecking || !qtyDefect) {
            alert('Please select defect and fill quantities.');
            return;
        }

        setSavingDefect(true);

        // Convert photos to base64 if captured
        let photoDefectBase64: string | undefined;
        let photoAfterBase64: string | undefined;
        try {
            if (defectPhotoFile) {
                photoDefectBase64 = await fileToBase64(defectPhotoFile);
            }
            if (improvementPhotoFile) {
                photoAfterBase64 = await fileToBase64(improvementPhotoFile);
            }
        } catch (err) {
            console.error('Failed to convert photo to base64', err);
        }

        const payload = {
            qtyChecking: parseInt(qtyChecking),
            defects: [
                {
                    defectId: modalDefectId,
                    qtyDefect: parseInt(qtyDefect),
                    actionPlan: actionPlan || undefined,
                    rootCause: rootCause || undefined,
                    corrective: corrective || undefined,
                    durasiStopline: parseInt(durasiStopline) || undefined,
                    photoDefect: photoDefectBase64 || undefined,
                    photoAfterActionPlan: photoAfterBase64 || undefined
                }
            ]
        };

        try {
            const res = await fetch(
                `/api/rqc/headers/${headerId}/areas/${modalArea.setupAreaId}/processes/${modalProcess.setupProcessId}/inspections`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (res.ok) {
                // Refresh header data locally
                const headerRes = await fetch(`/api/rqc/headers/${headerId}`);
                const updatedHeader = await headerRes.json();
                setHeaderData(updatedHeader);
                setIsDefectModalOpen(false);
            } else {
                alert('Failed to save defect.');
            }
        } catch (err) {
            console.error(err);
            alert('A network error occurred.');
        } finally {
            setSavingDefect(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <p className="animate-pulse text-gray-500 font-medium">Loading Inspection Session...</p>
            </div>
        );
    }

    const modalDefectRate = (qtyChecking && qtyDefect && parseInt(qtyChecking) > 0)
        ? (parseInt(qtyDefect) / parseInt(qtyChecking))
        : 0;
    const modalCapRequired = modalDefectRate > 0.20;

    // Check completion across all areas
    const totalProgress = tree.reduce((acc, area) => {
        const { total, completed } = getAreaProgress(area);
        return { total: acc.total + total, completed: acc.completed + completed };
    }, { total: 0, completed: 0 });

    const isAllCompleted = totalProgress.total > 0 && totalProgress.completed === totalProgress.total;

    const handleNextClick = () => {
        if (!isAllCompleted) {
            setAttemptedNext(true);
            // Optionally, scroll to the top or show a toast
            return;
        }
        router.push(`/audit/session/${headerId}/summary`);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative sm:max-w-md sm:mx-auto shadow-xl bg-white border-x">

            {/* Top Navigation Bar from Design */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                {source === 'admin' ? (
                    <button onClick={() => router.push('/admin/inspections')} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Inspection Report
                    </button>
                ) : viewOnly ? (
                    <button onClick={() => router.push(`/audit/session/${headerId}/summary?view=true`)} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Inspection Summary
                    </button>
                ) : (
                    <button onClick={() => {
                        if (headerData?.setupModelId) {
                            router.push(`/audit/${headerData.setupModelId}/history`);
                        } else {
                            router.push('/dashboard');
                        }
                    }} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Inspection History
                    </button>
                )}
            </nav>

            {/* Stepper UI Progress - Inspection is Active */}
            <div className="bg-white px-2 py-4 shadow-sm mb-4 flex justify-center items-center text-xs font-bold border-b border-gray-100 sticky top-14 z-20">
                <div className="flex items-center text-primary-600">
                    <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> Header
                </div>
                <div className="w-6 h-px bg-gray-300 mx-2"></div>
                <div className="flex items-center text-gray-900">
                    <span className="w-3 h-3 rounded-full bg-gray-900 flex-shrink-0 mr-1"></span> Inspection
                </div>
                <div className="w-6 h-px bg-gray-300 mx-2"></div>
                <div className="flex items-center text-gray-400">
                    <span className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0 mr-1"></span> Summary
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 px-4 overflow-y-auto w-full pb-10">
                {tree.map(area => {
                    const { total, completed } = getAreaProgress(area);
                    const isExpanded = expandedArea === area.setupAreaId;

                    return (
                        <div key={area.setupAreaId} className="mb-4">
                            {/* Accordion Header */}
                            <button
                                onClick={() => setExpandedArea(isExpanded ? null : area.setupAreaId)}
                                className={`w-full flex items-center justify-between p-4 rounded-lg font-bold uppercase tracking-wider text-sm transition-colors ${isExpanded ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}
                            >
                                <div className="flex items-center">
                                    <svg className={`w-4 h-4 mr-2 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    {area.masterArea.area}
                                </div>
                                <span className={`flex items-center gap-1 ${completed === total && total > 0 ? 'text-green-400 font-bold' : ''}`}>
                                    {completed === total && total > 0 && (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    )}
                                    {completed}/{total}
                                </span>
                            </button>

                            {/* Processes Inside Area */}
                            {isExpanded && (
                                <div className="mt-3 pl-4 border-l-2 border-gray-200 ml-2 relative">
                                    {area.setupProcesses?.map((proc: any, index: number) => {
                                        const savedProcess = getSavedProcessState(area.setupAreaId, proc.setupProcessId);
                                        const isCompleted = savedProcess !== null;
                                        const showError = attemptedNext && !isCompleted;

                                        return (
                                            <div key={proc.setupProcessId} className="mb-8 relative">
                                                {/* Left structural visual lines */}
                                                <div className="absolute -left-6 top-5 w-4 h-px bg-gray-200"></div>
                                                <div className={`absolute -left-6 top-3 w-2 h-2 rounded-full border-2 bg-white shadow-sm ${showError ? 'border-red-500' : 'border-gray-300'}`}></div>

                                                <div className={`flex flex-col p-4 bg-white border rounded-xl shadow-sm mb-3 transition-colors ${showError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <span className="font-semibold text-gray-800 text-sm mr-2">{proc.masterProcess.process}</span>
                                                            {!isCompleted && (
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${showError ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                                                                    Belum Diisi
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isCompleted ? (
                                                            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                        ) : (
                                                            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${showError ? 'border-red-400' : 'border-gray-300'}`}></span>
                                                        )}
                                                    </div>

                                                    {/* Badges */}
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {(() => {
                                                            const riskClasses = proc.masterProcess.riskLevel?.toLowerCase() === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                proc.masterProcess.riskLevel?.toLowerCase() === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    'bg-green-50 text-green-700 border-green-200';
                                                            return (
                                                                <>
                                                                    {proc.masterProcess.ctq && (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${riskClasses}`}>
                                                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                            {proc.masterProcess.ctq}
                                                                        </span>
                                                                    )}
                                                                    {proc.masterProcess.riskLevel && (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${riskClasses}`}>
                                                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                                            Risk: {proc.masterProcess.riskLevel}
                                                                        </span>
                                                                    )}
                                                                    {proc.masterProcess.sellingPoint && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold uppercase tracking-widest">
                                                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                                                            {proc.masterProcess.sellingPoint}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Listed Defects */}
                                                {savedProcess?.rqcInspections?.map((insp: any) => {
                                                    // Reverse map Defect ID to Name
                                                    const defectDef = proc.setupDefects?.find((sd: any) => String(sd.defectId) === String(insp.defectId));
                                                    const defectName = defectDef?.masterDefect?.defect || `Defect #${insp.defectId}`;
                                                    const ratePct = (insp.defectRate * 100).toFixed(2);

                                                    return (
                                                        <div key={insp.rqcInspectionId} className="ml-4 mb-3 p-4 bg-white border rounded-xl shadow-sm">
                                                            <p className="font-bold text-gray-900 border-b pb-2 mb-2 text-sm">{defectName}</p>
                                                            <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                                                                <span className="font-semibold">Qty : {insp.qtyDefect} / {savedProcess.qtyChecking}</span>
                                                                <span className="font-semibold">Rate : {ratePct}%</span>
                                                            </div>
                                                            <div className="px-2 py-1.5 rounded-md text-center text-xs font-bold uppercase tracking-wider bg-green-50 text-green-600 border border-green-200">
                                                                ✔️ DONE
                                                            </div>
                                                            {insp.status === 'IMMEDIATE_ACTION' && (
                                                                <div className={`mt-2 px-2 py-1.5 rounded-md text-xs font-bold text-center border ${insp.actionPlan ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                    {insp.actionPlan ? '✔️ Immediate Action sudah diisi' : '❌ Immediate Action belum diisi'}
                                                                </div>
                                                            )}
                                                            {insp.status === 'CAP' && (
                                                                <div className={`mt-2 px-2 py-1.5 rounded-md text-xs font-bold text-center border ${insp.rootCause ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                    {insp.rootCause ? '✔️ CAP sudah diisi' : '❌ CAP belum diisi'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Add Defect & No Defect Buttons */}
                                                {!viewOnly && (
                                                    <div className="flex gap-3 w-full mt-2">
                                                        <button
                                                            onClick={() => handleOpenDefectModal(area, proc)}
                                                            className="flex-1 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center"
                                                        >
                                                            <span className="text-xl leading-none mr-2">+</span> Add Defect
                                                        </button>

                                                        {/* Hide "No Defect" if the process is already completed */}
                                                        {!isCompleted && (
                                                            <button
                                                                onClick={() => handleSaveNoDefect(area, proc)}
                                                                className="flex-1 py-3 text-sm font-semibold text-green-600 hover:text-green-700 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 hover:border-green-400 transition-colors flex items-center justify-center"
                                                            >
                                                                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                No Defect
                                                            </button>
                                                        )}

                                                        {isCompleted && (
                                                            <button
                                                                onClick={() => handleDeleteProcess(area, proc)}
                                                                className="flex-1 py-3 text-sm font-semibold text-red-600 hover:text-red-700 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-50 hover:border-red-400 transition-colors flex items-center justify-center"
                                                            >
                                                                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                Hapus/Reset
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-10 flex flex-col gap-3 sm:max-w-md sm:translate-x-[-50%] sm:left-1/2 rounded-b-lg">
                {!viewOnly && attemptedNext && !isAllCompleted && (
                    <div className="text-center text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg border border-red-200 mb-[-4px]">
                        Harap isi semua inspeksi sebelum melanjutkan ({totalProgress.completed}/{totalProgress.total} selesai)
                    </div>
                )}
                {viewOnly ? (
                    <button
                        onClick={() => router.push(`/audit/session/${headerId}/summary?view=true${source ? `&source=${source}` : ''}`)}
                        className="w-full flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg shadow-md hover:bg-gray-800 transition-colors"
                    >
                        Back to Summary
                    </button>
                ) : (
                    <div className="flex justify-between gap-4">
                        <button
                            onClick={() => router.push('history')}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg"
                        >
                            Previous
                        </button>
                        <button
                            onClick={handleNextClick}
                            disabled={!isAllCompleted && attemptedNext}
                            className={`flex-1 py-3 font-bold rounded-lg shadow-md transition-colors ${!isAllCompleted && attemptedNext ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Add Defect Modal */}
            {isDefectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm sm:max-w-md sm:mx-auto">
                    <div className="bg-white w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
                            <h2 className="text-lg font-bold text-gray-900">Add Defect</h2>
                            <p className="text-xs text-gray-500 mt-1 uppercase">{modalProcess?.masterProcess.process}</p>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            {/* Defect Picker */}
                            <div className="mb-5">
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-2">Defect Type</label>
                                <select
                                    required
                                    value={modalDefectId}
                                    onChange={e => setModalDefectId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-gray-50 font-medium"
                                >
                                    <option value="" disabled>Search Defect...</option>
                                    {modalProcess?.setupDefects?.map((sd: any) => (
                                        <option key={sd.defectId} value={sd.defectId}>
                                            {sd.masterDefect.defect}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-2">Qty Checking</label>
                                    <input
                                        type="number"
                                        value={qtyChecking}
                                        readOnly
                                        disabled
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-center font-bold text-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-2">Qty Defect</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={qtyDefect}
                                        onChange={e => setQtyDefect(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-red-600 shadow-sm"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Show details ONLY when defect is selected */}
                            {modalDefectId && (
                                <>
                                    {/* Defect Photo */}
                                    <div className="mb-6">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            ref={defectPhotoInputRef}
                                            onChange={handleDefectPhotoChange}
                                            className="hidden"
                                        />
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span>📷 Defect Photo</span>
                                        </label>
                                        <div
                                            onClick={() => defectPhotoInputRef.current?.click()}
                                            className="w-full relative flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors shadow-sm overflow-hidden min-h-[140px]"
                                        >
                                            {defectPhotoPreview ? (
                                                <img src={defectPhotoPreview} alt="Defect" className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center flex flex-col items-center">
                                                    <svg className="h-8 w-8 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                    <span className="text-sm font-medium">Capture Photo</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Auto Calculate Rate */}
                                    <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Defect Rate</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1">{(modalDefectRate * 100).toFixed(2)}% <span className="text-sm font-normal text-gray-400">(Auto Calculate)</span></div>
                                    </div>

                                    {/* Actions Form logic depending on Rate */}
                                    {modalCapRequired ? (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 text-red-600 mb-3 font-bold border-l-4 border-red-500 pl-3">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                Defect Rate &gt; 20% (CAP Required)
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Root Cause</label>
                                                    <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2" rows={2}></textarea>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Corrective Action</label>
                                                    <textarea value={corrective} onChange={e => setCorrective(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2" rows={2}></textarea>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Stopline Duration</label>
                                                    <select value={durasiStopline} onChange={e => setDurasiStopline(e.target.value)} className="w-full px-4 py-3 rounded-lg border bg-gray-50 focus:outline-none">
                                                        <option value="15">15 Minutes</option>
                                                        <option value="30">30 Minutes</option>
                                                        <option value="60">1 Hour</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    ref={improvementPhotoInputRef}
                                                    onChange={handleImprovementPhotoChange}
                                                    className="hidden"
                                                />
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <span>📷 Photo Improvement</span>
                                                </label>
                                                <div
                                                    onClick={() => improvementPhotoInputRef.current?.click()}
                                                    className="w-full relative flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors shadow-sm overflow-hidden min-h-[140px]"
                                                >
                                                    {improvementPhotoPreview ? (
                                                        <img src={improvementPhotoPreview} alt="Improvement" className="absolute inset-0 w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-center flex flex-col items-center">
                                                            <svg className="h-8 w-8 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                            <span className="text-sm font-medium">Capture Improvement</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 text-orange-600 mb-3 font-bold border-l-4 border-orange-500 pl-3">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                                Immediate Action
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Action Plan</label>
                                                <textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2" rows={2}></textarea>
                                            </div>
                                            <div className="mt-4">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    ref={improvementPhotoInputRef}
                                                    onChange={handleImprovementPhotoChange}
                                                    className="hidden"
                                                />
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <span>📷 Photo Improvement</span>
                                                </label>
                                                <div
                                                    onClick={() => improvementPhotoInputRef.current?.click()}
                                                    className="w-full relative flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors shadow-sm overflow-hidden min-h-[140px]"
                                                >
                                                    {improvementPhotoPreview ? (
                                                        <img src={improvementPhotoPreview} alt="Improvement" className="absolute inset-0 w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-center flex flex-col items-center">
                                                            <svg className="h-8 w-8 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                            <span className="text-sm font-medium">Capture Improvement</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex gap-3 rounded-b-2xl sticky bottom-0 z-10">
                            <button
                                onClick={() => setIsDefectModalOpen(false)}
                                className="flex-1 py-3 font-bold text-gray-600 bg-white border border-gray-300 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDefect}
                                disabled={savingDefect}
                                className="flex-1 py-3 font-bold text-white bg-gray-900 rounded-xl disabled:bg-gray-400"
                            >
                                {savingDefect ? 'Saving...' : 'Save Defect'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
