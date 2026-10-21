'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { modelLabel } from '../../../../../lib/model-label';

const CTQ_CATEGORIES = [
    'External Compliance',
    'Safety',
    'Function',
    'Durability',
    'Appearance',
    'Color',
    'Fit & Comfort'
];

const RISK_LEVELS = [
    { label: 'Low', val: 'Low', color: 'text-green-700 bg-green-50' },
    { label: 'Medium', val: 'Medium', color: 'text-yellow-700 bg-yellow-50' },
    { label: 'Critical', val: 'Critical', color: 'text-red-700 bg-red-50' }
];

export default function SetupTreePage() {
    const router = useRouter();
    const params = useParams();
    const modelId = params.modelId as string;

    const [tree, setTree] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isUploadingAudit, setIsUploadingAudit] = useState(false);

    const [masterAreas, setMasterAreas] = useState<any[]>([]);
    const [masterProcesses, setMasterProcesses] = useState<any[]>([]);
    const [masterDefects, setMasterDefects] = useState<any[]>([]);
    const [modelUsps, setModelUsps] = useState<any[]>([]);

    useEffect(() => {
        if (!modelId) return;
        fetchTree();
        fetchMasters();
    }, [modelId]);

    const fetchTree = async () => {
        try {
            const res = await fetch(`/api/ctq-setup/models/${modelId}/tree`);
            const data = await res.json();
            if (res.ok) {
                setTree(data);
            } else {
                console.error("Failed to fetch tree:", data);
                setTree(null);
            }
        } catch (e) {
            console.error(e);
            setTree(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchMasters = async () => {
        const [ar, pr, de, us] = await Promise.all([
            fetch('/api/master/areas').then(r => r.json()),
            fetch('/api/master/processes').then(r => r.json()),
            fetch('/api/master/defects').then(r => r.json()),
            fetch(`/api/master/usps?modelId=${modelId}&status=ACTIVE`).then(r => r.json()),
        ]);
        setMasterAreas(ar);
        setMasterProcesses(pr);
        setMasterDefects(de);
        setModelUsps(Array.isArray(us) ? us : []);
    };

    const linkArea = async (e: React.FormEvent) => {
        e.preventDefault();
        const areaId = (e.target as any).areaId.value;
        if (!areaId) return;
        await fetch(`/api/ctq-setup/models/${modelId}/areas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaId })
        });
        fetchTree();
    };

    const linkProcess = async (setupAreaId: string, processId: string) => {
        if (!processId) return;
        await fetch(`/api/ctq-setup/areas/${setupAreaId}/processes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ processId })
        });
        fetchTree();
    };

    const linkDefect = async (setupProcessId: string, defectId: string) => {
        if (!defectId) return;
        await fetch(`/api/ctq-setup/processes/${setupProcessId}/defects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defectId })
        });
        fetchTree();
    };

    // --- Deletion Handlers ---
    const deleteSetupArea = async (setupAreaId: string) => {
        if (!window.confirm("Remove this Area from the Model? All nested Processes/Defects will be disconnected.")) return;
        await fetch(`/api/ctq-setup/areas/${setupAreaId}`, { method: 'DELETE' });
        fetchTree();
    };

    const deleteSetupProcess = async (setupProcessId: string) => {
        if (!window.confirm("Remove this Process from the Area?")) return;
        await fetch(`/api/ctq-setup/processes/${setupProcessId}`, { method: 'DELETE' });
        fetchTree();
    };

    const deleteSetupDefect = async (setupDefectId: string) => {
        if (!window.confirm("Remove this Defect from the Process?")) return;
        await fetch(`/api/ctq-setup/defects/${setupDefectId}`, { method: 'DELETE' });
        fetchTree();
    };

    // --- MasterProcess Updates ---
    const updateMasterProcess = async (processId: string, payload: any) => {
        await fetch(`/api/master/processes/${processId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        fetchTree();
    };

    const updateSetupProcess = async (setupProcessId: string, payload: any) => {
        await fetch(`/api/ctq-setup/processes/${setupProcessId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        fetchTree();
    };

    const handleUploadAuditFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validating type
        if (!['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(file.type)) {
            alert('Only PDF and PPT/PPTX files are allowed.');
            return;
        }

        setIsUploadingAudit(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64str = reader.result as string;

            try {
                const res = await fetch(`/api/ctq-setup/models/${modelId}/audit-file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auditFileBase64: base64str })
                });

                if (res.ok) {
                    alert('Internal Audit File uploaded successfully!');
                    fetchTree();
                } else {
                    alert('Failed to upload file.');
                }
            } catch (err) {
                console.error('File upload error', err);
                alert('File upload failed.');
            } finally {
                setIsUploadingAudit(false);
            }
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <div className="p-10 font-bold text-gray-500">Scanning CTQ Configuration Topology...</div>;
    if (!tree || !tree.model) return <div className="p-10 font-bold text-red-500">Failed to load CTQ Configuration. Please try again.</div>;

    return (
        <div className="space-y-6">
            {/* Title and the Add Area bar stay at the top while the tree scrolls */}
            <div className="admin-sticky-head space-y-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/admin/setup-ctq')} className="text-gray-500 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg font-medium text-sm transition-colors">&larr; Back</button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">CTQ Tree Builder</h1>
                        <div className="text-sm font-medium text-gray-500">Configuring hierarchies for Model: <span className="text-blue-600 font-bold">{modelLabel(tree.model)}</span></div>
                    </div>
                </div>
                {/* Link Area */}
                <form onSubmit={linkArea} className="flex gap-4 p-4 border border-blue-200 bg-blue-50/50 rounded-xl items-center">
                    <span className="font-bold text-blue-800 text-sm w-32">ADD NEW AREA</span>
                    <select name="areaId" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-sm" required defaultValue="">
                        <option value="" disabled>Select Master Area to inject into this Model...</option>
                        {masterAreas.map(a => <option key={a.areaId} value={a.areaId}>{a.area}</option>)}
                    </select>
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow flex items-center gap-2 text-sm transition-colors">
                        Inject Area
                    </button>

                    <div className="border-l-2 border-blue-200 pl-4 flex items-center ml-2 h-full gap-3">
                        <label className="flex items-center gap-2 bg-white text-blue-700 border border-blue-300 font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors shadow-sm text-sm">
                            <input type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={handleUploadAuditFile} disabled={isUploadingAudit} />
                            {isUploadingAudit ? 'Uploading...' : 'Upload Data Internal Audit'}
                        </label>
                        {tree?.model?.internalAuditFile && (
                            <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-200">
                                File Attached ✅
                            </span>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

                {/* Tree View */}
                <div className="space-y-6">
                    {tree.areas.length === 0 && (
                        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center flex flex-col items-center justify-center">
                            <span className="text-4xl mb-4">🌳</span>
                            <h3 className="font-bold text-gray-800 text-lg mb-1">Tree is empty</h3>
                            <p className="text-sm text-gray-500">Select an Area from the top bar to begin building the CTQ Tree.</p>
                        </div>
                    )}

                    {tree.areas.map((area: any) => (
                        <div key={area.setupAreaId} className="border border-gray-200 rounded-xl p-6 bg-gray-50 hover:border-gray-300 transition-colors">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
                                <h3 className="text-lg font-black text-gray-800 uppercase flex items-center gap-2">
                                    <span className="text-gray-400">└</span> {area.masterArea.area}
                                </h3>
                                <button onClick={() => deleteSetupArea(area.setupAreaId)} className="px-3 py-1 bg-red-100 text-red-700 rounded font-bold text-xs hover:bg-red-200 transition-colors">
                                    Remove Area
                                </button>
                            </div>

                            <div className="pl-6 space-y-4">
                                {(area.setupProcesses || []).map((proc: any) => {
                                    const mProc = proc.masterProcess;
                                    return (
                                        <div key={proc.setupProcessId} className="border border-gray-200 bg-white p-5 rounded-xl shadow-sm relative hover:border-gray-300 transition-colors">

                                            <div className="flex items-start justify-between mb-4">
                                                <h4 className="font-extrabold text-gray-800 text-base">{mProc.process}</h4>
                                                <button onClick={() => deleteSetupProcess(proc.setupProcessId)} className="text-red-500 hover:text-red-700 p-1 text-xs font-bold underline">Remove Process</button>
                                            </div>

                                            {/* Configuration Panel */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">

                                                {/* CTQ Selector */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">CTQ CATEGORY</label>
                                                    <select
                                                        className="w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none truncate"
                                                        value={mProc.ctq || ''}
                                                        onChange={(e) => updateMasterProcess(mProc.processId, { ctq: e.target.value })}
                                                    >
                                                        <option value="" disabled>-- Not Assigned --</option>
                                                        {CTQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>

                                                {/* Risk Level Selector */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1 tracking-wide">RISK LEVEL</label>
                                                    <select
                                                        className={`w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-semibold ${mProc.riskLevel === 'Critical' ? 'text-red-700 bg-red-50' :
                                                            mProc.riskLevel === 'Medium' ? 'text-yellow-700 bg-yellow-50' :
                                                                mProc.riskLevel === 'Low' ? 'text-green-700 bg-green-50' : ''
                                                            }`}
                                                        value={mProc.riskLevel || ''}
                                                        onChange={(e) => updateMasterProcess(mProc.processId, { riskLevel: e.target.value })}
                                                    >
                                                        <option value="" disabled>-- Not Assigned --</option>
                                                        {RISK_LEVELS.map(r => <option key={r.val} value={r.val} className="text-gray-900 bg-white">{r.label}</option>)}
                                                    </select>
                                                </div>

                                                {/* Selling Point Checkbox */}
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider whitespace-nowrap">SELLING POINT</label>
                                                    <div className="flex items-center gap-2 h-[34px]">
                                                        <input
                                                            type="checkbox"
                                                            id={`sellingPoint-${proc.setupProcessId}`}
                                                            className="w-[18px] h-[18px] text-red-600 rounded bg-white focus:ring-red-500 border-gray-300 cursor-pointer shadow-sm"
                                                            checked={proc.isSellingPoint || false}
                                                            onChange={(e) => updateSetupProcess(proc.setupProcessId, { isSellingPoint: e.target.checked })}
                                                        />
                                                        <label htmlFor={`sellingPoint-${proc.setupProcessId}`} className="text-sm font-bold text-red-700 tracking-wide select-none cursor-pointer flex items-center group">
                                                            Selling Point (USP)
                                                            <span className="ml-1 text-[10px] text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity" title="Indicates whether this Process is classified as a Selling Point.">ⓘ</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* USP Name Group */}
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-blue-600 mb-1 tracking-wider whitespace-nowrap flex items-center">
                                                        USP GROUPING
                                                        <span className="ml-1 text-[10px] text-blue-400" title="USP Name is used to group related CTQ Processes under the same USP. It is independent of the Selling Point checkbox.">ⓘ</span>
                                                    </label>
                                                    <select
                                                        className={`w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none font-semibold ${proc.uspId ? 'text-blue-800 bg-blue-50' : 'text-gray-900 bg-white'}`}
                                                        value={proc.uspId || ''}
                                                        onChange={(e) => updateSetupProcess(proc.setupProcessId, { uspId: e.target.value || null })}
                                                    >
                                                        <option value="" className="text-gray-500 font-normal">-- Not Assigned --</option>
                                                        {modelUsps.map((u: any) => (
                                                            <option key={u.uspId} value={u.uspId}>{u.uspName}</option>
                                                        ))}
                                                        {modelUsps.length === 0 ? <option value="" disabled className="italic">No active USP available</option> : null}
                                                    </select>
                                                </div>

                                            </div>

                                            <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-gray-100">
                                                {(proc.setupDefects || []).map((def: any) => (
                                                    <div key={def.setupDefectId} className="flex items-center gap-1 px-3 py-1 bg-white border shadow-sm border-gray-200 rounded-lg group">
                                                        <span className="text-xs font-semibold text-gray-700">{def.masterDefect.defect}</span>
                                                        <button
                                                            onClick={() => deleteSetupDefect(def.setupDefectId)}
                                                            className="ml-1 text-gray-300 hover:text-red-600 focus:outline-none"
                                                            title="Delete Defect"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}

                                                <select
                                                    className="px-3 py-1 border border-dashed border-gray-400 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold outline-none cursor-pointer max-w-[200px]"
                                                    onChange={e => {
                                                        linkDefect(proc.setupProcessId, e.target.value);
                                                        e.target.value = "";
                                                    }}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>+ Add Process Defect</option>
                                                    {masterDefects.map(d => <option key={d.defectId} value={d.defectId}>{d.defect}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )
                                })}

                                <div className="border-2 border-dashed border-gray-300 bg-transparent hover:bg-gray-100 transition-colors p-4 rounded-xl flex justify-center">
                                    <select
                                        className="px-4 py-2 w-full max-w-sm border border-gray-300 rounded-lg text-sm font-bold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                        onChange={e => {
                                            linkProcess(area.setupAreaId, e.target.value);
                                            e.target.value = "";
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+ Pick Master Process to assign into {area.masterArea.area}</option>
                                        {masterProcesses.map(p => <option key={p.processId} value={p.processId}>{p.process}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Save & Finish Actions */}
                <div className="pt-8 border-t border-gray-200 mt-8 flex justify-end">
                    <button
                        onClick={() => router.push('/admin/setup-ctq')}
                        className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                    >
                        <span className="text-xl">✅</span> Save Configuration & Exit
                    </button>
                </div>
            </div>
        </div>
    );
}
