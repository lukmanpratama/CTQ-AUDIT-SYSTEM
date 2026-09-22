'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { ChevronDown, Search, ArrowRight, LayoutDashboard } from 'lucide-react';

export default function DashboardViewPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModel, setSelectedModel] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await apiClient.get('/rqc/filters') as any;
                if (res && res.models) {
                    setModels(res.models);
                }
            } catch (err) {
                console.error('Failed to fetch models:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchFilters();
    }, []);

    const filteredModels = models.filter(m =>
        m.modelName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleProceed = () => {
        if (!selectedModel) return;
        // Proceed to new dedicated model dashboard route
        router.push(`/model-dashboard?modelId=${selectedModel}`);
    };

    const selectedModelName = models.find(m => m.setupModelId === selectedModel)?.modelName || 'Select a Model';

    return (
        <main className="min-h-screen flex items-center justify-center bg-[#F9FAFB] relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <div className="w-full max-w-lg relative z-20 px-4">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-br from-blue-50 to-white px-8 py-6 text-center border-b border-gray-100">
                        <div className="mx-auto w-32 h-20 flex items-center justify-center mb-6">
                            <img src="/parkland-logo.jfif" alt="Parkland Logo" className="max-w-full max-h-full object-contain mix-blend-multiply" />
                        </div>
                        <h1 className="text-2xl font-extrabold text-blue-900 tracking-wide">DASHBOARD CTQ AUDIT</h1>
                        <p className="text-blue-600/70 text-sm mt-2 font-medium">Select a shoe model to view inspection insights</p>
                    </div>

                    <div className="p-8">
                        <div className="space-y-6">
                            <div className="relative">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Model CTQ Audit
                                </label>

                                {/* Custom Dropdown */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="w-full text-left px-4 py-3.5 bg-white border border-gray-300 rounded-xl shadow-sm flex items-center justify-between hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    >
                                        <span className={`font-medium truncate ${selectedModel ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {loading ? 'Loading models...' : selectedModelName}
                                        </span>
                                        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="p-2 border-b border-gray-100">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search model..."
                                                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-0"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                                {filteredModels.length === 0 ? (
                                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">No models found</div>
                                                ) : (
                                                    filteredModels.map((model) => (
                                                        <button
                                                            key={model.setupModelId}
                                                            onClick={() => {
                                                                setSelectedModel(model.setupModelId);
                                                                setIsDropdownOpen(false);
                                                                setSearchQuery('');
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedModel === model.setupModelId
                                                                ? 'bg-blue-50 text-blue-700'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {model.modelName}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleProceed}
                                disabled={!selectedModel}
                                className={`w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md ${selectedModel
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:shadow-lg hover:-translate-y-0.5'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                    }`}
                            >
                                View Dashboard
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-8 text-center">
                            <button onClick={() => router.push('/login')} className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
                                Back to CTQ Audit System
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Click outside overlay */}
            {isDropdownOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                ></div>
            )}
        </main>
    );
}
