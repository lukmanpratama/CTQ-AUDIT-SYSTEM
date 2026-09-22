'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/api-client';

interface CtqDetailProps {
    searchParams: any;
}

export function CtqDetailClient({ searchParams }: CtqDetailProps) {
    const router = useRouter();
    const modelId = searchParams?.modelId;
    const ctqType = searchParams?.ctqType || 'UNKNOWN CTQ';

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sellingPoints, setSellingPoints] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDetails = async () => {
        if (!modelId || !ctqType) return;
        setLoading(true);
        try {
            let url = `/rqc/ctq-details?modelId=${modelId}&ctqType=${encodeURIComponent(ctqType)}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const res = await apiClient.get(url) as any;
            if (res) {
                setSellingPoints(res.sellingPoints || []);
                setAreas(res.areas || []);
            }
        } catch (err) {
            console.error("Failed to fetch CTQ Details", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [modelId, ctqType, startDate, endDate]);

    return (
        <div className="w-full h-screen bg-gray-50 flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="bg-[#11B7C6] w-full text-white text-center py-2 shrink-0">
                <h1 className="text-xl md:text-2xl font-extrabold uppercase tracking-widest">{ctqType}</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">

                {/* Date Filter */}
                <div className="mb-6 flex gap-2">
                    <div className="bg-[#2482E4] p-1.5 flex gap-2 rounded items-center shadow">
                        <span className="text-white text-xs font-semibold px-2">Pilih rentang tanggal:</span>
                        <input
                            type="date"
                            className="text-xs px-2 py-1 rounded border-none outline-none cursor-pointer"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-white text-xs font-bold">-</span>
                        <input
                            type="date"
                            className="text-xs px-2 py-1 rounded border-none outline-none cursor-pointer"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <button
                            onClick={() => { setStartDate(''); setEndDate(''); }}
                            className="bg-white text-red-500 font-bold px-2 py-1 text-xs rounded hover:bg-gray-100"
                        >
                            CLEAR
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex h-40 items-center justify-center text-gray-400 font-semibold mt-10">Memuat Data...</div>
                ) : (
                    <div className="flex flex-col gap-6">

                        {/* 1. SELLING POINTS (Top Cards) */}
                        {sellingPoints.length > 0 && (
                            <div className="flex flex-wrap gap-4 items-stretch">
                                {sellingPoints.map((sp: any, idx: number) => (
                                    <div key={idx} className="flex-1 bg-white border border-gray-200 shadow-sm flex flex-col min-w-[280px]">
                                        <div className="bg-[#FFB00F] text-center py-1.5">
                                            <span className="text-white font-black text-sm uppercase tracking-wider drop-shadow-sm">{sp.name}</span>
                                        </div>
                                        <div className="flex p-3 gap-2">
                                            <div className="flex-1 border border-gray-200 rounded p-2 flex flex-col items-start bg-white shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">PASS RATE</span>
                                                <span className="text-2xl font-light text-[#16A34A] leading-none mb-1">{sp.passRate.toFixed(2).replace('.', ',')}%</span>
                                            </div>
                                            <div className="flex-1 border border-gray-200 rounded p-2 flex flex-col items-start bg-white shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">DEFECT RATE</span>
                                                <span className="text-2xl font-light text-[#DC2626] leading-none mb-1">{sp.defectRate.toFixed(2).replace('.', ',')}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 2. AREAS AND PROCESSES */}
                        <div className="flex gap-4 items-start w-full mt-4 flex-wrap pb-20">
                            {areas.map((area: any, aidx: number) => (
                                <div key={aidx} className="flex flex-col flex-1 min-w-[300px]">
                                    {/* Area Header */}
                                    <div className="bg-[#55C3D1] text-white text-center py-1 rounded-sm shadow-sm mb-3">
                                        <h3 className="font-bold text-xs uppercase tracking-widest">{area.areaName}</h3>
                                    </div>

                                    {/* Processes List */}
                                    <div className="flex flex-col gap-2">
                                        {area.processes.map((proc: any, pidx: number) => (
                                            <div key={pidx} className="bg-white border border-gray-200 rounded shadow-sm p-2 flex flex-col">
                                                <div className="text-center mb-2 px-1">
                                                    <span className="text-[11px] font-black text-gray-800 uppercase tracking-wide">
                                                        {proc.processName}
                                                        {proc.sellingPoint && proc.sellingPoint !== '-' && (
                                                            <span className="text-[#FFB00F]"> - {proc.sellingPoint.toUpperCase()}</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1.5 h-12">
                                                    {/* Dark Green Pass Block */}
                                                    <div className="flex-1 bg-[#2C9F3C] text-white rounded flex justify-between items-center px-3 px-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black opacity-80 uppercase leading-none">PASS RATE</span>
                                                            <span className="text-sm font-bold mt-1">{proc.passRate.toFixed(2).replace('.', ',')}%</span>
                                                        </div>
                                                    </div>
                                                    {/* Red Defect Block */}
                                                    <div className="flex-1 bg-[#EE3B3B] text-white rounded flex justify-between items-center px-3 px-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black opacity-80 uppercase leading-none">DEFECT RATE</span>
                                                            <span className="text-sm font-bold mt-1">{proc.defectRate.toFixed(2).replace('.', ',')}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {area.processes.length === 0 && (
                                            <div className="text-center text-xs text-gray-400 italic py-4">Tidak ada data proses</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Absolute Back Button floating bottom right */}
            <div className="absolute bottom-6 right-6 z-50">
                <button
                    onClick={() => router.back()}
                    className="bg-[#2482E4] hover:bg-blue-600 outline-none text-white font-semibold text-lg py-1 px-8 rounded-md shadow-lg transition-colors border-b-4 border-blue-700 active:border-b-0 active:mt-[4px]"
                >
                    Back
                </button>
            </div>

        </div>
    );
}
