'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function HeaderAuditPage({ params }: { params: Promise<{ modelId: string }> }) {
    const router = useRouter();
    // In Next.js 15, params is a Promise that needs to be unwrapped
    const resolvedParams = use(params);
    const modelId = resolvedParams.modelId;

    const [modelName, setModelName] = useState('');
    const [factories, setFactories] = useState<any[]>([]);
    const [poOptions, setPoOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [po, setPo] = useState('');
    const [factoryId, setFactoryId] = useState('');
    const [part, setPart] = useState('');
    const [cell, setCell] = useState('');
    const [checkingTime, setCheckingTime] = useState('');
    const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
    const [date, setDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [modelsRes, factoriesRes] = await Promise.all([
                    fetch('/api/ctq-setup/models'),
                    fetch('/api/master/factories')
                ]);

                const models = await modelsRes.json();
                const factoryData = await factoriesRes.json();

                let currentName = '';
                const currentModel = models.find((m: any) => String(m.setupModelId) === String(modelId));
                if (currentModel) {
                    currentName = currentModel.modelName;
                    setModelName(currentName);
                }

                // Fetch relevant POs by fuzzy matching the model name
                let poData = [];
                if (currentName) {
                    const poRes = await fetch(`/api/master/pos?modelLike=${encodeURIComponent(currentName)}`);
                    if (poRes.ok) poData = await poRes.json();
                }

                setPoOptions(poData);
                setFactories(factoryData);
                setLoading(false);
            } catch (error) {
                console.error("Failed fetching initial data:", error);
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [modelId]);


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
            const res = await fetch('/api/rqc/headers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.rqcHeaderId) {
                // Navigate to the actual audit session page for this header
                router.push(`/audit/session/${data.rqcHeaderId}`);
            } else {
                alert('Failed to start session: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error("Submission error:", error);
            alert('A network error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <p className="animate-pulse text-gray-500">Loading audit setup...</p>
            </div>
        );
    }

    // Get selected PO data for read-only preview
    const selectedPoData = poOptions.find(p => p.po === po);

    // Determine Cell options based on selected Factory
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

        const selectedFactory = factories.find(f => String(f.factoryId) === String(factoryId));
        if (!selectedFactory) return null;

        // Extract factory number (e.g. "Factory 1" -> "1")
        const fNumMatch = selectedFactory.factory.match(/\d+/);
        const fNum = fNumMatch ? fNumMatch[0] : null;

        if (!fNum) {
            return <option value="" disabled>Invalid Factory Format</option>;
        }

        const options = [];
        options.push(<option key="default" value="" disabled>Select Cell (F{fNum}-xxx)</option>);
        for (let i = 1; i <= 23; i++) {
            const val = `F${fNum}-${i}`;
            options.push(<option key={val} value={val}>{val}</option>);
        }
        return options;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
            {/* Top Navigation Bar from Design */}
            <nav className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <button onClick={() => router.push('/dashboard')} className="flex items-center text-gray-600 font-medium">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    New Report
                </button>
                <div className="text-gray-500 font-medium flex items-center gap-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Save
                </div>
            </nav>

            {/* Stepper UI Progress */}
            <div className="bg-white px-4 py-5 shadow-sm mb-6 flex justify-center items-center text-sm font-medium">
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

            <div className="max-w-2xl mx-auto w-full px-4">
                <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-100 px-8 py-5 bg-white">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Header Audit</h1>
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
                                    No PO found matching the model name "{modelName}". Ensure Master PO data is updated.
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
                                        <option key={f.factoryId} value={f.factoryId}>{f.factory}</option>
                                    ))
                                }
                                <option value="INHOUSE">INHOUSE</option>
                            </select>
                        </div>

                        {factoryId === 'INHOUSE' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Part</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={part}
                                    onChange={(e) => {
                                        setPart(e.target.value);
                                        setCell('');
                                    }}
                                >
                                    <option value="" disabled>Select Part</option>
                                    <option value="NOSEW">NOSEW</option>
                                    <option value="PRINTING">PRINTING</option>
                                    <option value="EMBOSS">EMBOSS</option>
                                    <option value="EMBROIDERY">EMBROIDERY</option>
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
                                disabled={!factoryId}
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
                                onClick={() => router.push('/dashboard')}
                                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-4 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                            >
                                {submitting ? 'Starting Session...' : 'Start Audit'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
