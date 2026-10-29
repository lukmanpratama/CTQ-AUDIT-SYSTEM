'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { use } from 'react';
import { isAreaAllowedForFactory } from '../../../../lib/factory-area-mapping';
import { inspectorSummaryUrl, useAuditNav } from '../../../../features/rqc/audit-nav';
import { missingFollowUp } from '../../../../lib/followup';
import { OfflineUnavailableError, deleteProcess, getHeader, getJson, savePhoto, saveProcess } from '../../../../lib/offline/inspection-repository';
import { compressImage } from '../../../../lib/compress-image';

const processImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('/ctqaudit/')) {
        const parts = url.split('/ctqaudit/');
        if (parts.length > 1) return `/api/files/${parts[1]}`;
    }
    return url;
};

export default function AuditSessionPage(props: { params: Promise<{ headerId: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const router = useRouter();
    const resolvedParams = use(props.params);
    const headerId = resolvedParams.headerId;

    // Read through Next.js so the server render sees ?view=true too (window-only reads broke hydration)
    const searchParams = useSearchParams();
    const viewOnly = searchParams?.get('view') === 'true';
    const { isAdmin, urls } = useAuditNav();

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
    const [savingProcessId, setSavingProcessId] = useState<string | null>(null);

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

    // Edit mode tracking
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingDefectId, setEditingDefectId] = useState<string | null>(null);

    // Validation State
    const [attemptedNext, setAttemptedNext] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // 1. Saved session state (offline: the copy on this device, with changes not yet sent)
                const header = await getHeader(headerId);
                setHeaderData(header);

                if (header.setupModelId) {
                    // 2. CTQ tree
                    const treeData = await getJson(`/api/ctq-setup/models/${header.setupModelId}/tree`);
                    const allAreas = treeData.areas || [];
                    setTree(allAreas);

                    const currentFactoryLine = header?.factory?.factory || (header?.factoryId ? String(header.factoryId) : '');
                    const savedAreaIds = new Set((header.rqcAreas || []).map((a: any) => String(a.setupAreaId)));
                    const withData = allAreas.find((a: any) => savedAreaIds.has(String(a.setupAreaId)));
                    const filtered = allAreas.filter((a: any) => isAreaAllowedForFactory(a.masterArea?.area, currentFactoryLine));
                    if (withData) {
                        setExpandedArea(withData.setupAreaId); // open the area that already has inspections
                    } else if (filtered.length > 0) {
                        setExpandedArea(filtered[0].setupAreaId);
                    } else if (allAreas.length > 0) {
                        setExpandedArea(allAreas[0].setupAreaId);
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error("Failed fetching session data", err);
                if (err instanceof OfflineUnavailableError) alert(err.message);
                setLoading(false);
            }
        };
        fetchAllData();
    }, [headerId]);

    // Admin edits run through the same wizard inside the admin layout (/admin/inspections/[id]/edit/...)
    const headerEditUrl = headerData?.setupModelId ? urls.headerEdit(headerData.setupModelId, headerId) : null;

    // Prefetch neighbouring wizard steps so Previous / Next feel instant
    useEffect(() => {
        if (viewOnly) return;
        router.prefetch(urls.summary(headerId));
        if (headerEditUrl) router.prefetch(headerEditUrl);
    }, [headerId, headerEditUrl, viewOnly]);

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

    const handleOpenDefectModal = (area: any, process: any, existingInsp?: any) => {
        setModalArea(area);
        setModalProcess(process);
        if (existingInsp) {
            // Edit mode: pre-fill all fields from existing inspection
            setIsEditMode(true);
            setModalDefectId(String(existingInsp.defectId));
            setEditingDefectId(String(existingInsp.defectId));
            const savedProc = getSavedProcessState(area.setupAreaId, process.setupProcessId);
            setQtyChecking(String(savedProc?.qtyChecking || 20));
            setQtyDefect(String(existingInsp.qtyDefect || ''));
            setActionPlan(existingInsp.actionPlan || '');
            setRootCause(existingInsp.rootCause || '');
            setCorrective(existingInsp.corrective || '');
            setDurasiStopline(String(existingInsp.durasiStopline || 15));
            setDefectPhotoPreview(existingInsp.photoDefect || null);
            setImprovementPhotoPreview(existingInsp.photoAfterActionPlan || null);
            setDefectPhotoFile(null);
            setImprovementPhotoFile(null);
        } else {
            // New mode: reset all fields
            setIsEditMode(false);
            setModalDefectId('');
            setEditingDefectId(null);
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
        }
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

    // Uploaded to MinIO, or kept on this device while offline (sent with the inspection later)
    const uploadToMinio = async (file: File): Promise<string | undefined> => {
        try {
            // Camera photos are several MB; shrink them first so saving doesn't wait on a slow upload
            return await savePhoto(headerId, await compressImage(file));
        } catch (err) {
            console.error('Failed to upload file to MinIO', err);
            return undefined;
        }
    };

    // Re-reads the audit after a save (offline: the device copy with the change applied)
    const refreshHeader = async () => setHeaderData(await getHeader(headerId));

    const handleSaveNoDefect = async (area: any, process: any) => {
        setSavingProcessId(process.setupProcessId);
        const payload = {
            qtyChecking: 20,
            defects: []
        };

        try {
            await saveProcess(headerId, area.setupAreaId, process.setupProcessId, payload, { processName: process.masterProcess?.process });
            await refreshHeader();
        } catch (err) {
            console.error(err);
            alert('Failed to save status.');
        } finally {
            setSavingProcessId(null);
        }
    };

    const handleDeleteProcess = async (area: any, process: any) => {
        if (!confirm('Are you sure you want to delete this inspection and reset the process?')) return;

        try {
            await deleteProcess(headerId, area.setupAreaId, process.setupProcessId);
            await refreshHeader();
        } catch (err) {
            console.error(err);
            alert('Failed to delete inspection.');
        }
    };

    const handleSaveDefect = async () => {
        if (!modalDefectId || !qtyChecking || !qtyDefect) {
            alert('Please select defect and fill quantities.');
            return;
        }

        setSavingDefect(true);

        // Upload photos to MinIO if captured
        let photoDefectUrl: string | undefined;
        let photoAfterUrl: string | undefined;
        try {
            // Both photos at the same time instead of one after the other
            [photoDefectUrl, photoAfterUrl] = await Promise.all([
                defectPhotoFile ? uploadToMinio(defectPhotoFile) : undefined,
                improvementPhotoFile ? uploadToMinio(improvementPhotoFile) : undefined,
            ]);
        } catch (err) {
            console.error('Failed to upload photos to MinIO', err);
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
                    photoDefect: photoDefectUrl || undefined,
                    photoAfterActionPlan: photoAfterUrl || undefined
                }
            ]
        };

        try {
            await saveProcess(headerId, modalArea.setupAreaId, modalProcess.setupProcessId, payload, { processName: modalProcess.masterProcess?.process });
            await refreshHeader();
            setIsDefectModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Failed to save defect.');
        } finally {
            setSavingDefect(false);
        }
    };

    const modalDefectRate = (qtyChecking && qtyDefect && parseInt(qtyChecking) > 0)
        ? (parseInt(qtyDefect) / parseInt(qtyChecking))
        : 0;
    const modalCapRequired = modalDefectRate > 0.20;

    const factoryLine = headerData?.factory?.factory || (headerData?.factoryId ? String(headerData.factoryId) : '');

    // Dynamically filter areas according to Factory Line from Header Audit
    // An area that already has saved inspections in this audit is always shown,
    // so recorded data never disappears when the factory/area mapping doesn't list it.
    const visibleAreas = useMemo(() => {
        if (!factoryLine) return tree;
        const savedAreaIds = new Set((headerData?.rqcAreas || []).map((a: any) => String(a.setupAreaId)));
        return tree.filter(area =>
            isAreaAllowedForFactory(area.masterArea?.area, factoryLine) || savedAreaIds.has(String(area.setupAreaId))
        );
    }, [tree, factoryLine, headerData?.rqcAreas]);

    useEffect(() => {
        if (visibleAreas.length > 0) {
            const isCurrentlyExpanded = visibleAreas.some(a => String(a.setupAreaId) === String(expandedArea));
            if (!isCurrentlyExpanded) {
                setExpandedArea(visibleAreas[0].setupAreaId);
            }
        }
    }, [visibleAreas, expandedArea]);

    // Check completion across all visible areas
    const totalProgress = visibleAreas.reduce((acc, area) => {
        const { total, completed } = getAreaProgress(area);
        return { total: acc.total + total, completed: acc.completed + completed };
    }, { total: 0, completed: 0 });

    // New validation rule: user can proceed if at least 1 process is completed across inspection
    const canProceed = totalProgress.completed >= 1;

    // Defects already recorded on the process are hidden from the "Add Defect" dropdown.
    // When editing, the defect being edited stays in the list so it remains selected.
    const usedDefectIds = new Set<string>(
        (modalArea && modalProcess
            ? getSavedProcessState(modalArea.setupAreaId, modalProcess.setupProcessId)?.rqcInspections || []
            : []
        ).map((insp: any) => String(insp.defectId))
    );
    const availableDefects = (modalProcess?.setupDefects || []).filter((sd: any) =>
        !usedDefectIds.has(String(sd.defectId)) || (isEditMode && String(sd.defectId) === editingDefectId)
    );

    const handleNextClick = () => {
        if (!canProceed) {
            setAttemptedNext(true);
            return;
        }
        router.push(urls.summary(headerId));
    };

    if (loading) {
        return (
            <div className={`${isAdmin ? 'min-h-[60vh]' : 'min-h-screen'} bg-gray-50 flex flex-col items-center justify-center`}>
                <p className="animate-pulse text-gray-500 font-medium">Loading Inspection Session...</p>
            </div>
        );
    }

    // In the admin layout the page fills the content area (cancelling its p-6) and the bottom bar is sticky, not fixed, so the sidebar stays visible
    return (
        <div className={isAdmin ? '-m-6 min-h-full bg-gray-50 flex flex-col relative' : 'min-h-screen bg-gray-50 flex flex-col pb-28 relative'}>

            {/* Top bar + Header / Inspection / Summary stepper stay pinned together while the form scrolls */}
            <div className="sticky top-0 z-20 shadow-sm mb-6">
                {/* Top Navigation Bar from Design */}
                <nav className="bg-white px-4 py-4 flex items-center justify-between">
                    {isAdmin ? (
                        <button onClick={() => router.push(urls.adminReport)} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
                            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Inspection Report
                        </button>
                    ) : viewOnly ? (
                        <button onClick={() => router.push(inspectorSummaryUrl(headerId, '?view=true'))} className="flex items-center text-gray-600 font-medium hover:text-gray-900 transition-colors">
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
                <div className="bg-white px-2 py-5 border-t border-gray-100 flex justify-center items-center text-sm font-medium">
                    <button
                        type="button"
                        disabled={viewOnly || !headerEditUrl}
                        onClick={() => headerEditUrl && router.push(headerEditUrl)}
                        className="flex items-center text-primary-600 enabled:hover:underline disabled:cursor-default"
                        title={viewOnly ? undefined : 'Edit Header'}
                    >
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> Header
                    </button>
                    <div className="w-8 h-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center text-gray-900 font-bold">
                        <span className="w-4 h-4 rounded-full bg-gray-900 flex-shrink-0 mr-2"></span> Inspection
                    </div>
                    <div className="w-8 h-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center text-gray-400">
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 mr-2"></span> Summary
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 px-4 overflow-y-auto w-full pb-10 max-w-2xl mx-auto">
                {visibleAreas.length === 0 && (
                    <div className="bg-white rounded-xl p-8 text-center border border-gray-200 text-gray-500 my-4 shadow-sm">
                        <p className="font-semibold text-gray-700">Tidak ada Area untuk {factoryLine || 'Factory Line ini'}</p>
                        <p className="text-sm mt-1 text-gray-500">Model ini belum memiliki konfigurasi Area yang sesuai.</p>
                    </div>
                )}
                {visibleAreas.map(area => {
                    const { total, completed } = getAreaProgress(area);
                    const isExpanded = expandedArea === area.setupAreaId;
                    // Area is considered completed if at least one process in it has been filled
                    const isAreaCompleted = completed > 0;

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
                                <span className={`flex items-center gap-1 ${isAreaCompleted ? 'text-green-500 font-bold' : ''}`}>
                                    {isAreaCompleted && (
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
                                        // Only highlight error if user attempted next and no process has been completed yet
                                        const showError = attemptedNext && totalProgress.completed === 0 && !isCompleted;

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
                                                        <div key={insp.rqcInspectionId} className={`ml-4 mb-3 p-4 bg-white border rounded-xl shadow-sm ${!viewOnly ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all' : ''}`}
                                                            onClick={() => { if (!viewOnly) handleOpenDefectModal(area, proc, insp); }}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <p className="font-bold text-gray-900 text-sm">{defectName}</p>
                                                                {!viewOnly && (
                                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">✏️ Edit</span>
                                                                )}
                                                            </div>
                                                            <div className="border-b my-2"></div>
                                                            <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                                                                <span className="font-semibold">Qty : {insp.qtyDefect} / {savedProcess.qtyChecking}</span>
                                                                <span className="font-semibold">Rate : {ratePct}%</span>
                                                            </div>
                                                            {/* Status row: Done on the left, Immediate Action / CAP follow-up on the right */}
                                                            {(() => {
                                                                const isCap = insp.status === 'CAP';
                                                                // Complete only when every part is filled in, photos included (lib/followup.ts)
                                                                const missing = missingFollowUp(insp);
                                                                const followUpFilled = missing.length === 0;
                                                                return (
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                            Done
                                                                        </span>
                                                                        <span
                                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${followUpFilled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                                                                            title={followUpFilled ? 'Sudah lengkap' : `Belum ada: ${missing.join(', ')}`}
                                                                        >
                                                                            {followUpFilled ? (
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                                            ) : (
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            )}
                                                                            {isCap ? 'CAP' : 'Immediate Action'} {followUpFilled ? 'lengkap' : `belum lengkap (${missing.length})`}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {/* Photo Thumbnails */}
                                                            {(insp.photoDefect || insp.photoAfterActionPlan) && (
                                                                <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                                                                    {insp.photoDefect && (
                                                                        <div className="flex-1">
                                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">📷 Foto Defect</p>
                                                                            <img src={processImageUrl(insp.photoDefect)} alt="Defect" className="w-full h-24 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); window.open(processImageUrl(insp.photoDefect), '_blank'); }} />
                                                                        </div>
                                                                    )}
                                                                    {insp.photoAfterActionPlan && (
                                                                        <div className="flex-1">
                                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">📷 Foto Improvement</p>
                                                                            <img src={processImageUrl(insp.photoAfterActionPlan)} alt="Improvement" className="w-full h-24 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); window.open(processImageUrl(insp.photoAfterActionPlan), '_blank'); }} />
                                                                        </div>
                                                                    )}
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
                                                                disabled={savingProcessId === proc.setupProcessId}
                                                                className="flex-1 py-3 text-sm font-semibold text-green-600 hover:text-green-700 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 hover:border-green-400 transition-colors flex items-center justify-center disabled:opacity-50"
                                                            >
                                                                {savingProcessId === proc.setupProcessId ? (
                                                                    <svg className="animate-spin h-5 w-5 mr-1 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                )}
                                                                {savingProcessId === proc.setupProcessId ? 'Saving...' : 'No Defect'}
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
            <div className={`${isAdmin ? 'sticky p-4' : 'fixed left-0 px-4 pt-4 pb-8'} bottom-0 w-full bg-white border-t z-10`}>
                <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
                    {!viewOnly && attemptedNext && !canProceed && (
                        <div className="text-center text-red-600 text-xs font-bold bg-red-50 p-2 rounded-lg border border-red-200 mb-[-4px]">
                            Harap isi minimal satu proses inspeksi sebelum melanjutkan ({totalProgress.completed}/{totalProgress.total} selesai)
                        </div>
                    )}
                    {viewOnly ? (
                        <button
                            onClick={() => router.push(urls.summary(headerId, '?view=true'))}
                            className="w-full flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg shadow-md hover:bg-gray-800 transition-colors"
                        >
                            Back to Summary
                        </button>
                    ) : (
                        <div className="flex justify-between gap-4">
                            <button
                                onClick={() => {
                                    // Open the header form for THIS session so it is pre-filled for editing
                                    if (headerEditUrl) {
                                        router.push(headerEditUrl);
                                    } else {
                                        router.back();
                                    }
                                }}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg"
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleNextClick}
                                disabled={!canProceed && attemptedNext}
                                className={`flex-1 py-3 font-bold rounded-lg shadow-md transition-colors ${!canProceed && attemptedNext ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Defect Modal */}
            {isDefectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm sm:max-w-md sm:mx-auto">
                    <div className="bg-white w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
                            <h2 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Defect' : 'Add Defect'}</h2>
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
                                    {availableDefects.map((sd: any) => (
                                        <option key={sd.defectId} value={sd.defectId}>
                                            {sd.masterDefect.defect}
                                        </option>
                                    ))}
                                </select>
                                {availableDefects.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-600 font-medium">Semua defect untuk proses ini sudah dipilih.</p>
                                )}
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
                                            <div className="flex items-center gap-2 text-yellow-700 mb-3 font-bold border-l-4 border-yellow-400 pl-3">
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
