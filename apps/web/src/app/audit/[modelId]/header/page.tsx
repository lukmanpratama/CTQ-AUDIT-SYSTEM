'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { use } from 'react';
import { isAreaAllowedForFactory } from '../../../../lib/factory-area-mapping';
import { useAuditNav } from '../../../../features/rqc/audit-nav';
import { OfflineUnavailableError, createHeader, getHeader, getJson, updateHeader } from '../../../../lib/offline/inspection-repository';

// BOTTOM "INCOMING MIDSOLE" has one fixed cell, named after its Setup CTQ area
const INCOMING_CELL = 'INCOMING BOTTOM';

// Shared top bar + stepper so the loading state keeps the same layout as the form
function HeaderPageChrome({ onBack, backLabel, children }: { onBack: () => void; backLabel: string; children: React.ReactNode }) {
    // Inside the admin layout the page fills the content area (cancelling its p-6) so the sidebar stays visible
    const { isAdmin } = useAuditNav();
    return (
        <div className={isAdmin ? '-m-6 min-h-full bg-gray-50 flex flex-col pb-10' : 'min-h-screen bg-gray-50 flex flex-col pb-20'}>
            {/* Top bar + Header / Inspection / Summary stepper stay pinned together while the form scrolls */}
            <div className="sticky top-0 z-20 shadow-sm mb-6">
                <nav className="bg-white px-4 py-4 flex items-center justify-between">
                    <button onClick={onBack} className="flex items-center text-gray-600 font-medium">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        {backLabel}
                    </button>
                    <div className="text-gray-500 font-medium flex items-center gap-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Save
                    </div>
                </nav>

                {/* Stepper UI Progress */}
                <div className="bg-white px-4 py-5 border-t border-gray-100 flex justify-center items-center text-sm font-medium">
                    <div className="flex items-center text-gray-900 font-bold">
                        <span className="w-4 h-4 rounded-full bg-gray-900 flex-shrink-0 mr-2"></span> Header
                    </div>
                    <div className="w-8 h-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center text-gray-400">
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 mr-2"></span> Inspection
                    </div>
                    <div className="w-8 h-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center text-gray-400">
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0 mr-2"></span> Summary
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto w-full px-4">{children}</div>
        </div>
    );
}

function HeaderFormSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden animate-pulse">
            <div className="border-b border-gray-100 px-8 py-5">
                <div className="h-6 w-40 bg-gray-200 rounded" />
            </div>
            <div className="px-8 py-6 space-y-6">
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i}>
                        <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                        <div className="h-12 w-full bg-gray-100 rounded-lg" />
                    </div>
                ))}
                <div className="pt-4 flex gap-4">
                    <div className="flex-1 h-12 bg-gray-100 rounded-lg" />
                    <div className="flex-1 h-12 bg-gray-200 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

export default function HeaderAuditPage({ params }: { params: Promise<{ modelId: string }> }) {
    return (
        <Suspense fallback={<HeaderPageChrome onBack={() => { }} backLabel=""><HeaderFormSkeleton /></HeaderPageChrome>}>
            <HeaderAuditInner params={params} />
        </Suspense>
    );
}

function HeaderAuditInner({ params }: { params: Promise<{ modelId: string }> }) {
    const router = useRouter();
    // In Next.js 15, params is a Promise that needs to be unwrapped
    const resolvedParams = use(params);
    const modelId = resolvedParams.modelId;
    // When coming back from the Inspection step, the existing header id is passed so the form is pre-filled
    const searchParams = useSearchParams();
    const editHeaderId = searchParams.get('headerId');
    const isEditMode = !!editHeaderId;
    // Admin edits stay inside the admin layout (/admin/inspections/[id]/edit/...)
    const { urls, isAdmin } = useAuditNav();
    const sessionUrl = (id: string) => urls.session(id);

    const [modelName, setModelName] = useState('');
    // The Setup CTQ model, kept to label an audit started offline
    const [modelInfo, setModelInfo] = useState<{ modelName: string; modelNo?: string | null } | null>(null);
    const [hasArticles, setHasArticles] = useState(false);
    const [factories, setFactories] = useState<any[]>([]);
    const [poOptions, setPoOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [po, setPo] = useState('');
    const [factoryId, setFactoryId] = useState('');
    const [part, setPart] = useState('');
    const [cell, setCell] = useState('');
    const [checkingTime, setCheckingTime] = useState('');
    // Edit mode: original factory and the areas that already have inspections, to warn on a mismatching factory change
    const [originalFactoryId, setOriginalFactoryId] = useState('');
    const [recordedAreas, setRecordedAreas] = useState<string[]>([]);
    const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
    const [date, setDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    useEffect(() => {
        const applyExistingHeader = (h: any) => {
            if (h.date) setDate(String(h.date).slice(0, 10));
            setCheckingTime(h.checkingTime || '');
            setPo(h.po || '');
            const factoryName: string = h.factory?.factory || '';
            const savedCell: string = h.cell && h.cell !== '-' ? h.cell : '';
            if (factoryName === 'INHOUSE' || factoryName === 'BOTTOM 1' || factoryName === 'BOTTOM 2') {
                // Part is not stored; derive it from the cell (e.g. "NOSEW 3" -> "NOSEW")
                setFactoryId(factoryName);
                if (factoryName !== 'INHOUSE' && (!savedCell || savedCell === INCOMING_CELL)) {
                    // Incoming midsole: older audits were saved without a cell, fill in the fixed one
                    setPart('INCOMING MIDSOLE');
                    setCell(INCOMING_CELL);
                } else {
                    setPart(savedCell.replace(/\s+\d+$/, ''));
                    setCell(savedCell);
                }
            } else {
                setFactoryId(h.factoryId != null ? String(h.factoryId) : '');
                setPart('');
                setCell(savedCell);
            }
            setOriginalFactoryId(['INHOUSE', 'BOTTOM 1', 'BOTTOM 2'].includes(factoryName) ? factoryName : String(h.factoryId ?? ''));
        };

        const fetchInitialData = async () => {
            try {
                // Through the offline layer: without a connection the copies kept on this device are used
                const [models, factoryData, h] = await Promise.all([
                    getJson<any[]>('/api/ctq-setup/models'),
                    getJson<any[]>('/api/master/factories'),
                    editHeaderId
                        ? getHeader(editHeaderId).catch(e => { alert(e instanceof OfflineUnavailableError ? e.message : 'Failed to load the existing header data.'); return null; })
                        : Promise.resolve(null),
                ]);

                if (h) {
                    applyExistingHeader(h);
                    // Names of the areas that already have inspections in this audit
                    const usedAreaIds = new Set((h.rqcAreas || []).filter((a: any) => a.rqcProcesses?.length).map((a: any) => String(a.setupAreaId)));
                    if (usedAreaIds.size > 0) {
                        const tree = await getJson(`/api/ctq-setup/models/${modelId}/tree`).catch(() => null);
                        setRecordedAreas((tree?.areas || [])
                            .filter((a: any) => usedAreaIds.has(String(a.setupAreaId)))
                            .map((a: any) => a.masterArea?.area)
                            .filter(Boolean));
                    }
                }

                let currentName = '';
                const currentModel = models.find((m: any) => String(m.setupModelId) === String(modelId));
                if (currentModel) {
                    currentName = currentModel.modelName;
                    setModelInfo({ modelName: currentModel.modelName, modelNo: currentModel.modelNo });
                    setModelName(currentModel.modelNo ? `${currentName} (${currentModel.modelNo})` : currentName);
                    setHasArticles((currentModel.articles || []).length > 0);
                }

                // POs of this model: by its articles when set (models can share a name), else by name
                let poData = [];
                if (currentName) {
                    poData = await getJson(`/api/master/pos?setupModelId=${encodeURIComponent(String(modelId))}`).catch(() => []);
                }

                setPoOptions(poData);
                setFactories(factoryData);
                setLoading(false);
            } catch (error) {
                console.error("Failed fetching initial data:", error);
                if (error instanceof OfflineUnavailableError) alert(error.message);
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [modelId, editHeaderId]);

    // Prefetch the next step so moving back to Inspection feels instant
    useEffect(() => {
        if (editHeaderId) router.prefetch(sessionUrl(editHeaderId));
    }, [editHeaderId]);

    // Editing returns to the Inspection step; a new report goes back to this model's Inspection History
    const handleCancel = () => {
        if (editHeaderId) router.push(sessionUrl(editHeaderId));
        else if (isAdmin) router.push('/dashboard');
        else router.push(`/audit/${modelId}/history`);
    };
    const backLabel = editHeaderId || isAdmin ? 'Inspection' : 'Inspection History';


    // Helper: is BOTTOM factory selected
    const isBottomFactory = factoryId === 'BOTTOM 1' || factoryId === 'BOTTOM 2';

    // Parts definition for BOTTOM factories
    const BOTTOM_PARTS: { value: string; label: string; maxCell: number | null }[] = [
        { value: 'STOCKFIT', label: 'STOCKFIT', maxCell: 10 },
        { value: 'HOTPRESS', label: 'HOTPRESS', maxCell: 20 },
        { value: 'INCOMING MIDSOLE', label: 'INCOMING MIDSOLE', maxCell: null }, // single fixed cell: INCOMING_CELL
    ];

    const selectedBottomPart = BOTTOM_PARTS.find(p => p.value === part) ?? null;

    // Factory name for an audit kept offline (factoryId is an id, or a name like "BOTTOM 1")
    const factoryNameOf = (id: string) => factories.find(f => String(f.factoryId) === String(id))?.factory || id;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!po) {
            alert('Please select a Purchase Order (PO).');
            return;
        }

        if (poOptions.length > 0 && !poOptions.some(p => p.po === po)) {
            alert('Please select a valid PO from the list.');
            return;
        }

        if (!cell) {
            alert('Please select a Cell.');
            return;
        }

        const nik = localStorage.getItem('nik');
        if (!nik) {
            alert('You are not logged in!');
            router.push('/login');
            return;
        }

        if (editHeaderId) {
            // Changing the factory to one that doesn't fit the recorded inspections (e.g. an ASSEMBLY audit
            // moved to BOTTOM 1) makes the audit inconsistent. Ask before saving.
            if (factoryId !== originalFactoryId && recordedAreas.length > 0) {
                const newFactoryName = factories.find(f => String(f.factoryId) === String(factoryId))?.factory || factoryId;
                const mismatched = recordedAreas.filter(a => !isAreaAllowedForFactory(a, newFactoryName));
                if (mismatched.length > 0 && !confirm(
                    `Audit ini sudah berisi inspeksi area ${mismatched.join(', ')}, yang tidak termasuk factory ${newFactoryName}.

` +
                    `Pastikan Anda mengedit audit yang benar. Tetap simpan perubahan factory?`
                )) {
                    return;
                }
            }
            setSubmitting(true);
            try {
                // Offline: the change is kept on this device and sent when the connection is back
                await updateHeader(editHeaderId, { date, checkingTime, po, factoryId, cell }, {
                    factoryName: factoryNameOf(factoryId),
                    poRow: poOptions.find(p => p.po === po),
                });
                router.push(sessionUrl(editHeaderId));
            } catch (error) {
                console.error("Update error:", error);
                alert('Failed to update header: ' + (error instanceof Error ? error.message : 'Unknown error'));
                setSubmitting(false);
            }
            return;
        }

        const payload = {
            date: date,
            checkingTime: checkingTime,
            setupModelId: modelId,
            po: po,
            factoryId: factoryId,
            cell: cell,
            nik: nik
        };

        setSubmitting(true);
        try {
            // Offline: the audit starts on this device and is sent when the connection is back
            const { rqcHeaderId } = await createHeader(payload, {
                setupModel: modelInfo ?? undefined,
                factoryName: factoryNameOf(factoryId),
                poRow: poOptions.find(p => p.po === po),
            });
            // Navigate to the actual audit session page for this header.
            // Replace (not push) so the browser Back button doesn't reopen an empty "new" form
            // and create a duplicate session; "Previous" on the Inspection step reopens it pre-filled.
            router.replace(sessionUrl(rqcHeaderId));
        } catch (error) {
            console.error("Submission error:", error);
            alert('Failed to start session: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <HeaderPageChrome onBack={handleCancel} backLabel={backLabel}>
                <HeaderFormSkeleton />
            </HeaderPageChrome>
        );
    }

    // Get selected PO data for read-only preview
    const selectedPoData = poOptions.find(p => p.po === po);

    // Determine Cell options based on selected Factory + Part
    const renderCellOptions = () => {
        if (!factoryId) {
            return <option value="" disabled>Select Factory First</option>;
        }

        if (factoryId === 'INHOUSE') {
            if (!part) {
                return <option value="" disabled>Select Part First</option>;
            }
            const options = [];
            options.push(<option key="default" value="" disabled>Select Cell ({part})</option>);
            for (let i = 1; i <= 60; i++) {
                const val = `${part} ${i}`;
                options.push(<option key={val} value={val}>{val}</option>);
            }
            return options;
        }

        // BOTTOM 1 / BOTTOM 2
        if (isBottomFactory) {
            if (!part) {
                return <option value="" disabled>Select Part First</option>;
            }
            // Incoming Midsole has one fixed cell
            if (selectedBottomPart?.maxCell === null) {
                return <option value={INCOMING_CELL}>{INCOMING_CELL}</option>;
            }
            const maxCell = selectedBottomPart?.maxCell ?? 10;
            const options: React.JSX.Element[] = [];
            options.push(<option key="default" value="" disabled>Select Cell ({part})</option>);
            for (let i = 1; i <= maxCell; i++) {
                const val = `${part} ${i}`;
                options.push(<option key={val} value={val}>{val}</option>);
            }
            return options;
        }

        const selectedFactory = factories.find(f => String(f.factoryId) === String(factoryId));
        if (!selectedFactory) return null;

        // Extract factory number (e.g. "Factory 1" -> "1")
        const fNumMatch = selectedFactory.factory.match(/\d+/);
        const fNum = fNumMatch ? fNumMatch[0] : null;

        if (!fNum) {
            return <option value="" disabled>Invalid Factory Format</option>;
        }

        const options: React.JSX.Element[] = [];
        options.push(<option key="default" value="" disabled>Select Cell (F{fNum}-xxx)</option>);
        for (let i = 1; i <= 23; i++) {
            const val = `F${fNum}-${i}`;
            options.push(<option key={val} value={val}>{val}</option>);
        }
        return options;
    };

    return (
        <HeaderPageChrome onBack={handleCancel} backLabel={backLabel}>
                <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 px-8 py-5 bg-white">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{isEditMode ? 'Edit Header Audit' : 'Header Audit'}</h1>
                    </div>

                    <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Inspection Date</label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 mb-6"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />

                            <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Order (PO)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="Search or select PO Number..."
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={po}
                                    onChange={(e) => {
                                        setPo(e.target.value);
                                        setIsPoDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsPoDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsPoDropdownOpen(false), 200)}
                                />
                                {isPoDropdownOpen && poOptions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {poOptions
                                            .filter(p => p.po.toLowerCase().includes(po.toLowerCase()))
                                            .map(p => (
                                                <div
                                                    key={p.po}
                                                    className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-sm font-medium text-gray-800 border-b border-gray-50 last:border-0"
                                                    onClick={() => {
                                                        setPo(p.po);
                                                        setIsPoDropdownOpen(false);
                                                    }}
                                                >
                                                    {p.po}
                                                </div>
                                            ))}
                                        {poOptions.filter(p => p.po.toLowerCase().includes(po.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No PO matches "{po}"</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {poOptions.length === 0 && (
                                <p className="mt-2 text-sm text-amber-600 font-medium">
                                    {hasArticles
                                        ? <>No PO found for the articles of "{modelName}". Ensure Master PO data is updated.</>
                                        : <>No PO found matching the model name "{modelName}". Ensure Master PO data is updated.</>}
                                </p>
                            )}
                            {/* Auto-filled Preview Details */}
                            {selectedPoData && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Article</p>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{selectedPoData.article}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Master PO Model</p>
                                            <p className="text-sm font-medium text-gray-900 mt-1">{selectedPoData.model}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Factory Line</label>
                            <select
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                value={factoryId}
                                onChange={(e) => {
                                    setFactoryId(e.target.value);
                                    setPart(''); // Reset part when factory changes
                                    setCell(''); // Reset cell when factory changes
                                }}
                            >
                                <option value="" disabled>Select Factory Line</option>
                                {factories
                                    // Filter strict to 1-4
                                    .filter(f => /Factory [1-4]/.test(f.factory))
                                    .map(f => (
                                        <option key={f.factoryId} value={f.factoryId}>{f.factory.toUpperCase()}</option>
                                    ))
                                }
                                <option value="INHOUSE">INHOUSE</option>
                                <option value="BOTTOM 1">BOTTOM 1</option>
                                <option value="BOTTOM 2">BOTTOM 2</option>
                            </select>
                        </div>

                        {(factoryId === 'INHOUSE' || isBottomFactory) && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Part</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={part}
                                    onChange={(e) => {
                                        setPart(e.target.value);
                                        setCell(e.target.value === 'INCOMING MIDSOLE' ? INCOMING_CELL : '');
                                    }}
                                >
                                    {factoryId === 'INHOUSE' ? (
                                        <>
                                            <option value="" disabled>Select Part</option>
                                            <option value="NOSEW">NOSEW</option>
                                            <option value="PRINTING">PRINTING</option>
                                            <option value="EMBOSS">EMBOSS</option>
                                            <option value="EMBROIDERY">EMBROIDERY</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="" disabled>Select Part</option>
                                            <option value="STOCKFIT">STOCKFIT</option>
                                            <option value="HOTPRESS">HOTPRESS</option>
                                            <option value="INCOMING MIDSOLE">INCOMING MIDSOLE</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Cell</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                                    value={cell}
                                    onChange={(e) => setCell(e.target.value)}
                                    disabled={!factoryId || (isBottomFactory && !part)}
                                >
                                    {renderCellOptions()}
                                </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Checking Time</label>
                            <select
                                required
                                value={checkingTime}
                                onChange={(e) => setCheckingTime(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                            >
                                <option value="" disabled>Select Checking Time</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                            </select>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                            >
                                {isEditMode
                                    ? (submitting ? 'Saving...' : 'Save & Continue')
                                    : (submitting ? 'Starting Session...' : 'Start Audit')}
                            </button>
                        </div>
                    </form>
                </div>
        </HeaderPageChrome>
    );
}
