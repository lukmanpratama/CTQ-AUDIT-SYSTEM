'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api-client';
import { ProcessDefectModal } from './ProcessDefectModal';

interface DefectItem {
    defectName: string;
    qtyDefect: number;
}

interface ProcessItem {
    processName: string;
    setupProcessId: string;
    defectRate: number;
    totalDefect: number;
    totalChecking: number;
    defects: DefectItem[];
    qtyCheckingMorning: number;
    qtyCheckingAfternoon: number;
    qtyDefectMorning: number;
    qtyDefectAfternoon: number;
    usp?: string | null;
    ctq?: string | null;
}

interface AreaItem {
    areaName: string;
    processes: ProcessItem[];
}

const AREA_ORDER = ['CUTTING', 'SEWING', 'ASSEMBLY'];

// One x-axis scale per section (RQC / TQC), just above the largest rate, so small rates still show as
// readable bars (1,88% on a 0-2,5% axis instead of a 0-10% one) and panels stay comparable.
const NICE_STEPS = [0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 50, 100];
function sectionScale(areas: AreaItem[]): number {
    const max = Math.max(0, ...areas.flatMap(a => a.processes.map(p => p.defectRate || 0)));
    if (max <= 0) return 1;
    const target = max * 1.15;
    return NICE_STEPS.find(s => s >= target) ?? Math.ceil(target / 10) * 10;
}
const axisLabel = (v: number) => `${Number(v.toFixed(2))}%`.replace('.', ',');



function AreaPanel({ area, onProcessClick, baseColor, scaleMax }: { area: AreaItem; onProcessClick: (proc: ProcessItem) => void; baseColor: string; scaleMax: number }) {
    const maxRate = scaleMax;

    return (
        <div className="flex-1 border border-gray-200 rounded-sm relative pt-4 pb-6 bg-white overflow-hidden flex flex-col min-w-[280px]">
            <h3 className="text-center font-bold text-base tracking-wide mb-2">{area.areaName}</h3>
            {/* Rows share the panel height (36-72px each), so a few processes fill the panel instead of sitting at the top */}
            <div className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto min-h-0">
                {area.processes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                        No process data
                    </div>
                ) : (
                    area.processes.map((proc, idx) => (
                        <div
                            key={idx}
                            className="flex items-center flex-[1_0_auto] min-h-[36px] py-1 cursor-pointer hover:bg-blue-50/50 rounded transition-colors group"
                            onClick={() => onProcessClick(proc)}
                            title={`Click to view details: ${proc.processName}`}
                        >
                            <div className="w-[40%] text-[11px] font-semibold leading-tight text-right text-gray-700 uppercase break-words pr-2 group-hover:text-blue-700 transition-colors">
                                {proc.processName}
                            </div>
                            <div className="flex-1 flex items-center h-full border-l border-gray-300">
                                <div
                                    className="h-7 rounded-r-sm transition-all group-hover:opacity-80"
                                    style={{
                                        width: proc.defectRate > 0 ? `${Math.max((proc.defectRate / maxRate) * 85, 1)}%` : '0px',
                                        backgroundColor: proc.defectRate > 0 ? baseColor : '#D1D5DB'
                                    }}
                                />
                                {proc.defectRate > 0 ? (
                                    <span className="text-sm font-bold text-gray-700 ml-1.5 leading-none whitespace-nowrap group-hover:text-blue-700">
                                        {proc.defectRate.toFixed(2)}%
                                    </span>
                                ) : (
                                    <span className="text-sm font-bold ml-1.5 leading-none" style={{ color: baseColor }}>0%</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            {/* X-axis (the bar area is 85% wide so the value label always fits beside the longest bar) */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-between text-[11px] text-gray-500 font-medium ml-[40%] pl-2 pr-[15%]">
                <span>0%</span><span>{axisLabel(maxRate / 2)}</span><span>{axisLabel(maxRate)}</span>
            </div>
        </div>
    );
}

export function ProcessDefectCharts({ modelId, startDate, endDate, cell }: { modelId?: string, startDate?: string, endDate?: string, cell?: string }) {
    const [areas, setAreas] = useState<AreaItem[]>([]);
    const [tqcAreas, setTqcAreas] = useState<AreaItem[]>([]);
    const [tqcOverallStats, setTqcOverallStats] = useState<any>(null);
    const [rqcOverallStats, setRqcOverallStats] = useState<any>(null);
    const [setupAreas, setSetupAreas] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
    const [summaryModal, setSummaryModal] = useState<{ type: 'RQC' | 'TQC', stats: any } | null>(null);

    useEffect(() => {
        if (!modelId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                let url = `/rqc/process-defects?modelId=${modelId}`;
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;
                if (cell) url += `&cell=${encodeURIComponent(cell)}`;

                const [res, treeRes] = await Promise.all([
                    apiClient.get(url) as any,
                    apiClient.get(`/ctq-setup/models/${modelId}/tree`) as any
                ]);

                if (res && res.areas) {
                    setAreas(res.areas);
                }
                if (res && res.tqcAreas) {
                    setTqcAreas(res.tqcAreas);
                }
                if (res) {
                    setTqcOverallStats(res.tqcOverallStats || null);
                    setRqcOverallStats(res.rqcOverallStats || null);
                }
                if (treeRes && treeRes.areas) {
                    setSetupAreas(treeRes.areas.map((a: any) => a.masterArea.area));
                }
            } catch (err) {
                console.error('Failed to fetch process defects:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [modelId, startDate, endDate, cell]);

    // Organize areas into setup area order
    const getArea = (name: string): AreaItem => {
        return areas.find(a => a.areaName.toUpperCase() === name.toUpperCase()) || { areaName: name, processes: [] };
    };

    const displayAreas = setupAreas.length > 0
        ? setupAreas.map(name => getArea(name))
        : areas; // Fallback if no tree found
    const rqcScale = sectionScale(displayAreas);
    const tqcScale = sectionScale(tqcAreas);

    if (loading) {
        return (
            <div className="flex gap-4 h-full overflow-hidden min-h-0 items-center justify-center">
                <div className="text-gray-400 text-sm animate-pulse">Loading process defect data...</div>
            </div>
        );
    }

    return (
        <>
            <div className="flex gap-6 h-full overflow-hidden min-h-0">
                {/* RQC Section */}
                <div className="flex-[3] flex flex-col min-h-0 overflow-hidden pr-2 border-r-2 border-gray-100">
                    <div
                        className="bg-[#FFB00F] text-white text-center font-bold text-lg py-1 rounded-sm shadow-sm shrink-0 mb-2 cursor-pointer hover:bg-orange-600 transition-colors"
                        onClick={() => rqcOverallStats && setSummaryModal({ type: 'RQC', stats: rqcOverallStats })}
                        title="Click to view RQC overall stats"
                    >
                        RQC
                    </div>
                    {displayAreas.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium">
                            No CTQ Areas configured for this model.
                        </div>
                    ) : (
                        <div className="flex gap-2 flex-1 min-h-0 overflow-x-auto pb-2 custom-scrollbar" style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: `minmax(250px, 1fr)` }}>
                            {displayAreas.map((area, idx) => (
                                <AreaPanel
                                    key={idx}
                                    area={area}
                                    onProcessClick={(proc) => setSelectedProcess(proc)}
                                    baseColor="#FFB00F"
                                    scaleMax={rqcScale}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* TQC Section */}
                <div className="flex-[2] flex flex-col min-h-0 overflow-hidden pl-2">
                    <div
                        className="bg-[#DC2626] text-white text-center font-bold text-lg py-1 rounded-sm shadow-sm shrink-0 mb-2 cursor-pointer hover:bg-red-700 transition-colors"
                        onClick={() => tqcOverallStats && setSummaryModal({ type: 'TQC', stats: tqcOverallStats })}
                        title="Click to view TQC overall stats"
                    >
                        TQC
                    </div>
                    {tqcAreas.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium">
                            No TQC Data uploaded for this model.
                        </div>
                    ) : (
                        <div className="flex gap-2 flex-1 min-h-0 overflow-x-auto pb-2 custom-scrollbar" style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: `minmax(250px, 1fr)` }}>
                            {tqcAreas.map((area, idx) => (
                                <AreaPanel
                                    key={`tqc-${idx}`}
                                    area={area}
                                    onProcessClick={(proc) => setSelectedProcess(proc)}
                                    baseColor="#DC2626"
                                    scaleMax={tqcScale}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {selectedProcess && (
                <ProcessDefectModal
                    process={selectedProcess}
                    onClose={() => setSelectedProcess(null)}
                />
            )}

            {/* Summary KPI Modal */}
            {summaryModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cursor-pointer"
                    onClick={() => setSummaryModal(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`${summaryModal.type === 'TQC' ? 'bg-[#DC2626]' : 'bg-[#FFB00F]'} px-4 py-3 flex justify-between items-center`}>
                            <h3 className="text-white font-black text-sm tracking-widest uppercase">SUMMARY {summaryModal.type}</h3>
                            <button onClick={() => setSummaryModal(null)} className="text-white/80 hover:text-white font-bold">✕</button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="flex justify-between items-center px-4 py-3 bg-green-50 rounded-lg border border-green-100">
                                <span className="text-xs font-extrabold text-green-700 uppercase tracking-widest">Pass Rate</span>
                                <span className="text-xl font-black text-green-600">{summaryModal.stats?.passRate?.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3 bg-red-50 rounded-lg border border-red-100">
                                <span className="text-xs font-extrabold text-red-700 uppercase tracking-widest">Defect Rate</span>
                                <span className="text-xl font-black text-red-600">{summaryModal.stats?.defectRate?.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Qty Checking</span>
                                <span className="text-lg font-bold text-gray-800">{summaryModal.stats?.totalChecking?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Qty Defect</span>
                                <span className="text-lg font-bold text-red-600">{summaryModal.stats?.totalDefect?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
