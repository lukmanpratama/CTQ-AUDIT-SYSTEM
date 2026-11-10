'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { ModelCard } from '../../features/rqc/components/ModelCard';
import { getJson, prefetchMasterData } from '../../lib/offline/inspection-repository';
import { getSession } from '../../lib/session';
import { useDataRefresh } from '../../lib/use-data-refresh';
import { HeaderFilter, ShellSlot } from '../../components/shell/InspectorShell';

export default function DashboardPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Unfinished Immediate Action / CAP follow-ups per model, for the red badge on each card
    const [followUpPending, setFollowUpPending] = useState<Record<string, number>>({});
    const { refreshKey } = useDataRefresh();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterActiveOnly, setFilterActiveOnly] = useState(true);
    const [filterWithFollowUps, setFilterWithFollowUps] = useState(false);

    // Active filter count for the header badge
    const activeFilterCount = (filterActiveOnly ? 1 : 0) + (filterWithFollowUps ? 1 : 0);

    useEffect(() => {
        if (!getSession()) {
            router.push('/login');
            return;
        }
        const load = async () => {
            try {
                // Offline: the lists kept on this device
                const [modelsData, followUpData] = await Promise.all([
                    getJson<any[]>('/api/ctq-setup/models'),
                    getJson<{ setupModelId: string; count: number }[]>('/api/rqc/followup-pending').catch(() => []),
                ]);
                setModels(modelsData || []);
                setFollowUpPending(Object.fromEntries((followUpData || []).map(r => [String(r.setupModelId), r.count])));
                // While online, keep what starting an audit needs for every model, for use without a connection
                prefetchMasterData(modelsData || []);
            } catch (err) {
                console.error('Error fetching dashboard data', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [router, refreshKey]);

    const handleModelSelect = (model: any) => {
        router.push(`/audit/${model.setupModelId}/history`);
    };

    // Filtered models according to search and filter options
    const filteredModels = useMemo(() => {
        return models.filter(model => {
            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = model.modelName?.toLowerCase().includes(q);
                const matchNo = model.modelNo?.toLowerCase().includes(q);
                const matchArticle = (model.articles || []).some((a: any) => a.article?.toLowerCase().includes(q));
                if (!matchName && !matchNo && !matchArticle) return false;
            }

            // Filter Active Only
            if (filterActiveOnly && !model.isActive) {
                return false;
            }

            // Filter With Pending Follow-ups
            if (filterWithFollowUps && !(followUpPending[String(model.setupModelId)] > 0)) {
                return false;
            }

            return true;
        });
    }, [models, searchQuery, filterActiveOnly, filterWithFollowUps, followUpPending]);
    return (
        <div className="min-h-[calc(100vh-7.5rem)] bg-gray-50">
            {/* Header: search + filter */}
            <ShellSlot name="search">
                <div className="flex items-center bg-[#091E35] border border-[#1A3A60] rounded-xl px-3 py-1.5 focus-within:border-[#F5A623] transition-colors">
                    <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search model..."
                        className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white p-0.5 ml-1 rounded-full" aria-label="Clear search">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </ShellSlot>
            <ShellSlot name="filter">
                <HeaderFilter
                    count={activeFilterCount}
                    title="Filter Model"
                    onReset={() => { setFilterActiveOnly(true); setFilterWithFollowUps(false); }}
                >
                    <div className="space-y-3">
                        <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                            <input type="checkbox" checked={filterActiveOnly} onChange={(e) => setFilterActiveOnly(e.target.checked)}
                                className="w-4 h-4 rounded text-[#F5A623] bg-[#0E2947] border-[#1A3A60] focus:ring-0" />
                            <span>Active Models Only</span>
                        </label>
                        <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                            <input type="checkbox" checked={filterWithFollowUps} onChange={(e) => setFilterWithFollowUps(e.target.checked)}
                                className="w-4 h-4 rounded text-[#F5A623] bg-[#0E2947] border-[#1A3A60] focus:ring-0" />
                            <span>With Pending Action (CAP / Immed)</span>
                        </label>
                    </div>
                </HeaderFilter>
            </ShellSlot>

            <main className="py-6 px-4 sm:px-6 max-w-7xl mx-auto w-full">
                                        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#0E2947] to-[#1A3A60]">
                                    Select Model
                                </h2>
                                <p className="text-gray-500 text-sm">Choose an active model to start auditing.</p>
                            </div>

                            {activeFilterCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">
                                        Showing {filteredModels.length} of {models.length} models
                                    </span>
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <span className="text-gray-500 font-medium animate-pulse">Loading active models...</span>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                                    {filteredModels.map(model => (
                                        <ModelCard
                                            key={model.setupModelId}
                                            model={model}
                                            isSelected={false}
                                            onClick={handleModelSelect}
                                            pendingCount={followUpPending[String(model.setupModelId)] ?? 0}
                                        />
                                    ))}
                                </div>

                                {filteredModels.length === 0 && (
                                    <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 shadow-sm mt-4 p-8">
                                        <p className="text-gray-500 text-base font-medium mb-3">
                                            {searchQuery
                                                ? `No models found matching "${searchQuery}"`
                                                : 'No models available with active filters.'}
                                        </p>
                                        {(searchQuery || filterWithFollowUps) && (
                                            <button
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setFilterActiveOnly(true);
                                                    setFilterWithFollowUps(false);
                                                }}
                                                className="px-4 py-2 bg-[#0E2947] text-white text-xs font-semibold rounded-xl hover:bg-[#091E35] transition-colors"
                                            >
                                                Reset Search & Filters
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
            </main>
        </div>
    );
}
