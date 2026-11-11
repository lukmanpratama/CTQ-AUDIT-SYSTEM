'use client';

import { RotateCw } from 'lucide-react';
import { useShell } from '../../components/shell/InspectorShell';

export default function ProfilePage() {
    const { nik, namaUser, unsentCount, refresh, logout } = useShell();

    return (
        <main className="py-6 px-4 sm:px-6 max-w-md mx-auto w-full min-h-[calc(100vh-7.5rem)] bg-gray-50">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-[#0E2947] text-[#F5A623] font-black text-3xl flex items-center justify-center shadow-lg mb-3 ring-4 ring-[#0E2947]/10">
                        {namaUser ? namaUser.charAt(0).toUpperCase() : 'R'}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{namaUser || 'Inspector'}</h3>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">NIK: {nik}</p>
                    <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0E2947] border border-blue-100">
                        RQC Inspector
                    </span>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                        <span className="text-gray-500">Status Sinkronisasi</span>
                        <span className={`font-semibold text-xs ${unsentCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {unsentCount > 0 ? `${unsentCount} Pending Sync` : 'Sinkron (Online Ready)'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                        <span className="text-gray-500">Versi Aplikasi</span>
                        <span className="font-mono text-xs text-gray-600">1.0.0 (PWA)</span>
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <button onClick={refresh} className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors">
                        <RotateCw className="w-4 h-4 text-[#F5A623]" /> Sinkronkan & Refresh Data
                    </button>
                    <button onClick={logout} className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-2xl shadow-sm transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        </main>
    );
}
