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
    const [uspGroups, setUspGroups] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDetails = async () => {
        if (!modelId || !ctqType) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let url = `/rqc/ctq-details?modelId=${modelId}&ctqType=${encodeURIComponent(ctqType)}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const res = await apiClient.get(url) as any;
            if (res) {
                setUspGroups(res.uspGroups || []);
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
        <div className="w-full h-screen bg-white flex flex-col font-sans overflow-hidden">
            {/* Main CTQ Header - Matching the Wireframe's dark cyan header */}
            <div className="bg-[#19A7BA] w-full text-white text-center py-2 shrink-0">
                <h1 className="text-2xl font-extrabold uppercase tracking-widest">{ctqType}</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">

                {/* Date Filter & CLEAR */}
                <div className="mb-6 flex justify-start pl-2">
                    <div className="bg-[#2482E4] p-1.5 flex gap-2 rounded items-center shadow shadow-blue-200">
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
                    <div className="flex flex-col gap-6 items-center px-2 pb-20">

                        {/* Container that handles the USP columns side-by-side if multiple */}
                        <div className={`grid grid-cols-1 items-start gap-4 w-full px-2 ${uspGroups.filter(u => u.name !== '-').length > 1 ? 'xl:grid-cols-2' : ''}`}>
                            {uspGroups.filter(u => u.name !== '-').map((usp: any, idx: number) => {
                                // Filter Areas to only include processes belonging to THIS USP
                                const filteredAreas = areas.map(area => {
                                    return {
                                        ...area,
                                        processes: area.processes.filter((p: any) => p.uspName === usp.name)
                                    };
                                }).filter(area => area.processes.length > 0);

                                // Calculate Mathematical Average
                                let totalProcs = 0;
                                let totalPassRate = 0;
                                let totalDefectRate = 0;
                                filteredAreas.forEach(area => {
                                    area.processes.forEach((p: any) => {
                                        totalProcs++;
                                        totalPassRate += p.passRate;
                                        totalDefectRate += p.defectRate;
                                    });
                                });

                                const avgPassRate = totalProcs > 0 ? totalPassRate / totalProcs : usp.passRate;
                                const avgDefectRate = totalProcs > 0 ? totalDefectRate / totalProcs : usp.defectRate;

                                return (
                                    <div key={idx} className="flex flex-col gap-4 w-full">

                                        {/* USP Top Card (Orange/Gold Header) */}
                                        <div className="w-full bg-white flex flex-col pt-1 shadow-[0_2px_4px_rgba(0,0,0,0.06)] rounded-sm">
                                            <div className="bg-[#FBAD15] text-center py-2 rounded-t-sm">
                                                <span className="text-white font-extrabold text-[13px] tracking-wide uppercase">{usp.name}</span>
                                            </div>
                                            <div className="flex p-3 gap-3 border-x border-b border-gray-300 rounded-b-sm">
                                                <div className="flex-1 flex flex-col justify-start items-start bg-white rounded border border-gray-200 p-2 shadow-sm">
                                                    <span className="text-[10px] text-[#2482E4] font-semibold uppercase mb-1">PASS RATE {usp.name}</span>
                                                    <span className="text-2xl font-light text-[#30AA46]">{avgPassRate.toFixed(2).replace('.', ',')}%</span>
                                                </div>
                                                <div className="flex-1 flex flex-col justify-start items-start bg-white rounded border border-gray-200 p-2 shadow-sm">
                                                    <span className="text-[10px] text-[#2482E4] font-semibold uppercase mb-1">DEFECT RATE {usp.name}</span>
                                                    <span className="text-2xl font-light text-[#D23B33]">{avgDefectRate.toFixed(2).replace('.', ',')}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Area Blocks for this specific USP */}
                                        <div className="flex flex-col gap-4 w-full">
                                            {filteredAreas.map((area: any, aidx: number) => (
                                                <div key={aidx} className="flex flex-col w-full bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                                                    {/* Area Header */}
                                                    <div className="bg-[#48C9DD] text-white text-center py-1.5">
                                                        <h2 className="font-extrabold text-sm uppercase tracking-widest">{area.areaName}</h2>
                                                    </div>

                                                    <div className="p-3 flex flex-col gap-3 bg-[#FDFDFD]">
                                                        {area.processes.map((proc: any, pidx: number) => (
                                                            <div key={pidx} className="bg-white border border-gray-300 rounded-md p-2 flex flex-col w-full shadow-sm">
                                                                <div className="text-center mb-1.5 px-1">
                                                                    <span className="text-[10px] font-extrabold text-black uppercase tracking-wide">
                                                                        {proc.processName}
                                                                    </span>
                                                                    {proc.isSellingPoint && (
                                                                        <span className="text-[10px] font-extrabold text-[#FBAD15] ml-1"> - USP</span>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2 h-11">
                                                                    {/* Pass Rate block */}
                                                                    <div className="flex-1 bg-[#379E45] rounded flex flex-col items-start justify-center px-2 relative shadow-inner overflow-hidden">
                                                                        <span className="text-[8px] font-extrabold text-white absolute top-1 left-1.5 tracking-wider">PASS RATE</span>
                                                                        <span className="text-white text-xl font-medium mx-auto mt-2 tracking-tight">{proc.passRate.toFixed(2).replace('.', ',')}%</span>
                                                                    </div>

                                                                    {/* Defect Rate block */}
                                                                    <div className="flex-1 bg-[#F14336] rounded flex flex-col items-start justify-center px-2 relative shadow-inner overflow-hidden">
                                                                        <span className="text-[8px] font-extrabold text-white absolute top-1 left-1.5 tracking-wider">DEFECT RATE</span>
                                                                        <span className="text-white text-xl font-medium mx-auto mt-2 tracking-tight">{proc.defectRate.toFixed(2).replace('.', ',')}%</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                );
                            })}

                            {/* Render General / Non-USP Processes if any exist */}
                            {(() => {
                                const unassignedAreas = areas.map(area => ({
                                    ...area,
                                    processes: area.processes.filter((p: any) => !p.uspName || p.uspName === '-')
                                })).filter(area => area.processes.length > 0);

                                if (unassignedAreas.length === 0) return null;

                                return (
                                    <div className="flex flex-col gap-4 w-full col-span-full mt-4">
                                        <div className="flex flex-col w-full bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="bg-[#9CA3AF] text-white text-center py-1.5">
                                                <h2 className="font-extrabold text-sm uppercase tracking-widest">PROSES UMUM (TANPA USP)</h2>
                                            </div>
                                            <div className="p-3 flex flex-wrap justify-center gap-3 bg-[#FDFDFD]">
                                                {unassignedAreas.map((area: any, aidx: number) => (
                                                    <div key={aidx} className="w-full">
                                                        <div className="text-gray-500 font-bold text-xs uppercase mb-2 border-b pb-1">{area.areaName}</div>
                                                        <div className="flex flex-col gap-3">
                                                            {area.processes.map((proc: any, pidx: number) => (
                                                                <div key={pidx} className="bg-white border border-gray-300 rounded-md p-2 flex flex-col w-full shadow-sm">
                                                                    <div className="text-center mb-1.5 px-1">
                                                                        <span className="text-[10px] font-extrabold text-black uppercase tracking-wide">
                                                                            {proc.processName}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex gap-2 h-11">
                                                                        <div className="flex-1 bg-[#379E45] rounded flex flex-col items-start justify-center px-2 relative shadow-inner overflow-hidden">
                                                                            <span className="text-[8px] font-extrabold text-white absolute top-1 left-1.5 tracking-wider">PASS RATE</span>
                                                                            <span className="text-white text-xl font-medium mx-auto mt-2 tracking-tight">{proc.passRate.toFixed(2).replace('.', ',')}%</span>
                                                                        </div>
                                                                        <div className="flex-1 bg-[#F14336] rounded flex flex-col items-start justify-center px-2 relative shadow-inner overflow-hidden">
                                                                            <span className="text-[8px] font-extrabold text-white absolute top-1 left-1.5 tracking-wider">DEFECT RATE</span>
                                                                            <span className="text-white text-xl font-medium mx-auto mt-2 tracking-tight">{proc.defectRate.toFixed(2).replace('.', ',')}%</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Float Back Button */}
            <div className="absolute bottom-6 right-6 z-50">
                <button
                    onClick={() => router.back()}
                    className="bg-[#4682F4] hover:bg-blue-600 outline-none text-white font-semibold flex items-center justify-center text-lg py-1.5 px-8 shadow-[0_4px_10px_rgba(36,130,228,0.4)] transition-all active:scale-95 rounded-sm"
                >
                    Back
                </button>
            </div>

        </div>
    );
}
