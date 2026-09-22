'use client';

import React from 'react';

interface DefectItem {
    defectName: string;
    qtyDefect: number;
}

interface ProcessData {
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
}

interface ProcessDefectModalProps {
    process: ProcessData;
    onClose: () => void;
}

export function ProcessDefectModal({ process, onClose }: ProcessDefectModalProps) {
    const maxDefect = Math.max(...process.defects.map(d => d.qtyDefect), 1);

    const allDefects = [...process.defects];

    const maxXAxis = Math.ceil(maxDefect * 1.3) || 8;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-[90%] max-w-[500px] max-h-[85vh] overflow-auto z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-xl">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 uppercase">{process.processName}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Defect Rate: <span className="font-semibold text-red-600">{process.defectRate.toFixed(2)}%</span>
                            <span className="mx-2">|</span>
                            Total Checking: <span className="font-semibold">{process.totalChecking}</span>
                            <span className="mx-2">|</span>
                            Total Defect: <span className="font-semibold text-red-600">{process.totalDefect}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content — Detail Defect Panel Only */}
                <div className="p-6">
                    {/* Panel 1: Detail Defect */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-800 mb-4 text-center">DETAIL DEFECT</h3>
                        <div className="space-y-2">
                            {allDefects.map((d, idx) => (
                                <div key={idx} className="flex items-center gap-4 max-w-sm mx-auto">
                                    <div className="w-[40%] text-[10px] font-medium text-right text-gray-700 uppercase truncate leading-tight" title={d.defectName}>
                                        {d.defectName}
                                    </div>
                                    <div className="flex-1 flex items-center gap-1">
                                        {d.qtyDefect > 0 ? (
                                            <>
                                                <div
                                                    className="h-5 rounded-sm"
                                                    style={{
                                                        width: `${(d.qtyDefect / maxXAxis) * 100}%`,
                                                        backgroundColor: '#DC2626',
                                                        minWidth: '4px'
                                                    }}
                                                />
                                                <span className="text-[11px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded text-center min-w-[20px]">
                                                    {d.qtyDefect}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-5 w-1 bg-gray-300 rounded-sm" />
                                                <span className="text-[11px] text-gray-400 ml-1">0</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* X Axis */}
                        <div className="flex justify-between text-[9px] text-gray-400 mt-3 max-w-sm mx-auto pl-[40%]">
                            <span>0</span>
                            <span>{Math.round(maxXAxis / 2)}</span>
                            <span>{maxXAxis}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
