'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';

interface DashboardKpiSidebarProps {
    modelId?: string;
    ctqData?: any[];
    passRate?: number;
    passRateRqc?: number;
    passRateTqc?: number;
    defectRateRqc?: number;
    defectRateTqc?: number;
}

function MiniDonutRow({ label, value, color, maxVal = 100 }: { label: string; value: number; color: string; maxVal?: number }) {
    const pct = Math.min((value / maxVal) * 100, 100);
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
        <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                <circle cx="22" cy="22" r={radius} fill="none" stroke="#EEEEEE" strokeWidth="5" />
                <circle
                    cx="22" cy="22" r={radius} fill="none"
                    stroke={color} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    transform="rotate(-90 22 22)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <span className="flex-1 font-semibold text-gray-600 text-sm">{label}</span>
            <span className="text-base font-bold" style={{ color }}>{value.toFixed(2)}%</span>
        </div>
    );
}

export function DashboardKpiSidebar({
    ctqData = [],
    passRate = 100,
    passRateRqc = 0,
    passRateTqc = 0,
    defectRateRqc = 0,
    defectRateTqc = 0,
    modelId
}: DashboardKpiSidebarProps) {
    const router = useRouter();
    const displayedPassRate = passRate;
    const avgDefectRate = Math.round((((defectRateRqc + defectRateTqc) / 2) + Number.EPSILON) * 100) / 100;

    const data = [
        { name: 'Pass', value: displayedPassRate },
        { name: 'Defect', value: 100 - displayedPassRate },
    ];
    const COLORS = ['#02C054', '#EEEEEE'];

    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Top Score Boxes */}
            <div className="flex flex-col gap-2 shrink-0">
                {ctqData.map((ctq: any, index: number) => (
                    <button
                        key={index}
                        onClick={() => {
                            if (modelId) {
                                router.push(`/model-dashboard/ctq-detail?modelId=${modelId}&ctqType=${encodeURIComponent(ctq.label)}`);
                            }
                        }}
                        className="flex items-stretch border border-[#FFB00F] rounded overflow-hidden shadow-sm h-11 shrink-0 w-full hover:brightness-110 active:brightness-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB00F]/50"
                        title="View CTQ Details"
                    >
                        <div className="bg-[#FFB00F] w-full text-white font-black flex items-center justify-center uppercase tracking-wider text-sm shadow-inner text-center px-1">
                            {ctq.label}
                        </div>
                    </button>
                ))}

                {ctqData.length === 0 && (
                    <div className="text-gray-500 text-sm italic text-center py-4">
                        Tidak ada data tipe CTQ.
                    </div>
                )}
            </div>

            {/* Total Pass Rate Donut */}
            <div className="bg-white border flex-1 border-gray-200 shadow-sm rounded-sm p-2 flex flex-col items-center justify-center min-h-0">
                <h3 className="text-gray-900 font-bold uppercase tracking-wide text-sm mb-1 text-center shrink-0">
                    TOTAL PASS RATE
                </h3>
                {/* Use aspect-ratio to keep the donut square and responsive */}
                <div
                    className="w-full flex-1 min-h-0 flex items-center justify-center cursor-pointer hover:opacity-90"
                    onClick={() => setIsModalOpen(true)}
                >
                    <div className="relative" style={{ width: '100%', maxWidth: '200px', aspectRatio: '1/1' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="70%"
                                    outerRadius="90%"
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[#02C054] text-4xl font-extrabold pb-4">
                                {displayedPassRate.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Donut Chart Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cursor-pointer"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-[#2482E4] px-4 py-3">
                            <h3 className="text-white font-bold text-sm tracking-wide text-center">TOTAL PASS RATE BREAKDOWN</h3>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* PASS RATE Group */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-px flex-1 bg-green-200"></div>
                                    <span className="text-xs font-bold text-[#02C054] uppercase tracking-widest">Pass Rate</span>
                                    <div className="h-px flex-1 bg-green-200"></div>
                                </div>
                                <div className="space-y-3">
                                    <MiniDonutRow label="OVERALL PASS RATE" value={displayedPassRate} color="#02C054" />
                                    <MiniDonutRow label="PASS RATE RQC" value={passRateRqc} color="#2482E4" />
                                    <MiniDonutRow label="PASS RATE TQC" value={passRateTqc} color="#0EA5E9" />
                                </div>
                            </div>

                            {/* DEFECT RATE Group */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-px flex-1 bg-red-200"></div>
                                    <span className="text-xs font-bold text-[#D9262C] uppercase tracking-widest">Defect Rate</span>
                                    <div className="h-px flex-1 bg-red-200"></div>
                                </div>
                                <div className="space-y-3">
                                    <MiniDonutRow label="AVG DEFECT RATE" value={avgDefectRate} color="#D9262C" maxVal={30} />
                                    <MiniDonutRow label="DEFECT RATE RQC" value={defectRateRqc} color="#FFB00F" maxVal={30} />
                                    <MiniDonutRow label="DEFECT RATE TQC" value={defectRateTqc} color="#D9262C" maxVal={30} />
                                </div>
                            </div>

                            <p className="text-[10px] text-gray-400 italic text-center pt-1">Klik di luar modal untuk menutup</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

