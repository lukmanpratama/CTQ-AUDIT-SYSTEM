'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api-client';

interface CapData {
    id: string;
    date: string;
    weekStr: string;
    areaName: string;
    processName: string;
    defectName: string;
    qtyDefect: number;
    rootCause: string;
    actionPlan: string;
    corrective: string;
    photoAfterActionPlan: string | null;
}

export function CapDefectTrendModal({ isOpen, onClose, modelId, startDate, endDate }: {
    isOpen: boolean;
    onClose: () => void;
    modelId?: string;
    startDate?: string;
    endDate?: string;
}) {
    const [capData, setCapData] = useState<CapData[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        const fetchCap = async () => {
            setLoading(true);
            try {
                let url = `/rqc/dashboard/cap-data?_=1`;
                if (modelId) url += `&modelId=${modelId}`;
                if (startDate) url += `&startDate=${startDate}`;
                if (endDate) url += `&endDate=${endDate}`;
                const res = await apiClient.get(url) as any;
                if (active && res && res.capData) {
                    setCapData(res.capData);
                }
            } catch (err) {
                console.error("Failed to load CAP data", err);
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchCap();
        return () => { active = false; };
    }, [isOpen, modelId, startDate, endDate]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex bg-[#111827] text-white py-3 px-5 items-center justify-between shadow-sm">
                    <h2 className="text-sm font-bold tracking-wider">CAP DEFECT TREND DATA</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition-colors"
                        title="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto bg-gray-50/50">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <span className="animate-pulse text-gray-500 font-medium">Loading CAP Data...</span>
                        </div>
                    ) : capData.length === 0 ? (
                        <div className="flex h-40 items-center justify-center flex-col gap-2">
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span className="text-gray-500 font-medium">No CAP reports logged by RQC within this period.</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {capData.map((cap, i) => (
                                <div key={i} className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
                                    <div className="bg-[#FFB00F]/10 px-3 py-2 border-b border-[#FFB00F]/30 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[#B45309] font-bold text-[11px] uppercase">{cap.defectName}</span>
                                            <span className="text-gray-500 text-[10px] font-medium">{cap.areaName} › {cap.processName}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="bg-[#DC2626] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">{cap.qtyDefect} QTY</span>
                                            <span className="text-gray-400 text-[9px] mt-0.5">{cap.weekStr}</span>
                                        </div>
                                    </div>
                                    <div className="p-3 flex flex-col gap-3 text-xs flex-1">
                                        <div>
                                            <span className="text-gray-400 font-semibold text-[10px] uppercase mb-0.5 block">Root Cause</span>
                                            <p className="text-gray-800 font-medium leading-relaxed bg-gray-50 p-2 rounded border border-gray-100 min-h-[40px]">{cap.rootCause || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 font-semibold text-[10px] uppercase mb-0.5 block">Corrective Action</span>
                                            <p className="text-gray-800 font-medium leading-relaxed bg-gray-50 p-2 rounded border border-gray-100 min-h-[40px]">{cap.corrective || cap.actionPlan || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
