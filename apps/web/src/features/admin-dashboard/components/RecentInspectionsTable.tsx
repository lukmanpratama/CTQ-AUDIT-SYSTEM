import React, { useState } from 'react';

export function RecentInspectionsTable({ data }: { data?: any[] }) {
    const displayData = data || [];
    const [selectedRow, setSelectedRow] = useState<any>(null);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex-1">
            <div className="p-5 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase">Recent Inspection / Findings</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                            <th className="p-4 font-semibold tracking-wider">Nama RQC</th>
                            <th className="p-4 font-semibold tracking-wider">Factory / Cell</th>
                            <th className="p-4 font-semibold tracking-wider">Model</th>
                            <th className="p-4 font-semibold tracking-wider">Area</th>
                            <th className="p-4 font-semibold tracking-wider">Process Name</th>
                            <th className="p-4 font-semibold tracking-wider">Defect Name</th>
                            <th className="p-4 font-semibold tracking-wider text-center">Qty Checking</th>
                            <th className="p-4 font-semibold tracking-wider text-center">Qty Defect</th>
                            <th className="p-4 font-semibold tracking-wider">Status</th>
                            <th className="p-4 font-semibold tracking-wider">Submitted</th>
                            <th className="p-4 font-semibold tracking-wider text-center">Defect Rate</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-gray-700 font-medium">
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-gray-400">No inspection findings found</td>
                            </tr>
                        ) : (
                            displayData.map((row: any) => (
                                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">{row.namaRqc}</td>
                                    <td className="p-4">{row.factoryCell}</td>
                                    <td className="p-4">{row.model}</td>
                                    <td className="p-4 font-semibold text-gray-800">{row.area}</td>
                                    <td className="p-4">{row.process}</td>
                                    <td className="p-4 text-red-500 font-semibold">{row.defectName}</td>
                                    <td className="p-4 text-center">{row.qtyChecking}</td>
                                    <td className="p-4 text-center">{row.qtyDefect}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => setSelectedRow(row)}
                                            className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold hover:opacity-80 transition-opacity cursor-pointer ${row.statusColor || 'bg-gray-200 text-gray-700'}`}
                                        >
                                            {row.status}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-bold ${row.submitted === 'COMPLETED'
                                            ? 'text-emerald-600'
                                            : 'text-red-500'
                                            }`}>
                                            {row.submitted}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center font-semibold">{row.defectRate}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {selectedRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setSelectedRow(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    {selectedRow.status === 'CAP' ? 'Corrective Action Plan (CAP)' : 'Immediate Action Detail'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {selectedRow.process} — {selectedRow.defectName}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-5">
                            {/* Info Row */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty Check</div>
                                    <div className="text-lg font-extrabold text-gray-900 mt-1">{selectedRow.qtyChecking}</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-3 text-center">
                                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Qty Defect</div>
                                    <div className="text-lg font-extrabold text-red-600 mt-1">{selectedRow.qtyDefect}</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Defect Rate</div>
                                    <div className="text-lg font-extrabold text-gray-900 mt-1">{selectedRow.defectRate}%</div>
                                </div>
                            </div>

                            {/* Photo Defect */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span>📷</span> Foto Defect
                                </h4>
                                {selectedRow.photoDefect ? (
                                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={selectedRow.photoDefect} alt="Foto Defect" className="w-full h-48 object-cover" />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium">
                                        Tidak ada foto defect
                                    </div>
                                )}
                            </div>

                            {/* Action Details - depends on status */}
                            {selectedRow.status === 'CAP' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-red-600 font-bold text-sm border-l-4 border-red-500 pl-3">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        CAP Required (Defect Rate &gt; 20%)
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Root Cause</span>
                                            <p className="text-sm text-gray-800 font-medium">{selectedRow.rootCause || <span className="text-gray-400 italic">Belum diisi</span>}</p>
                                        </div>
                                        <div className="border-t border-gray-100 pt-3">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Corrective Action</span>
                                            <p className="text-sm text-gray-800 font-medium">{selectedRow.corrective || <span className="text-gray-400 italic">Belum diisi</span>}</p>
                                        </div>
                                        {selectedRow.durasiStopline && (
                                            <div className="border-t border-gray-100 pt-3">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Durasi Stopline</span>
                                                <p className="text-sm text-gray-800 font-medium">{selectedRow.durasiStopline} Menit</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-orange-600 font-bold text-sm border-l-4 border-orange-500 pl-3">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                        Immediate Action
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Action Plan</span>
                                            <p className="text-sm text-gray-800 font-medium">{selectedRow.actionPlan || <span className="text-gray-400 italic">Belum diisi</span>}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Photo After Action Plan */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <span>📷</span> Foto Setelah Action
                                </h4>
                                {selectedRow.photoAfterActionPlan ? (
                                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={selectedRow.photoAfterActionPlan} alt="Foto After Action" className="w-full h-48 object-cover" />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium">
                                        Tidak ada foto improvement
                                    </div>
                                )}
                            </div>

                            {/* Completion Status */}
                            <div className={`p-3 rounded-xl text-center text-xs font-bold uppercase tracking-wider border ${selectedRow.submitted === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                {selectedRow.submitted === 'COMPLETED' ? '✔️ Sudah Diisi Lengkap' : '❌ Belum Diisi Lengkap'}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-sm"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
