'use client';

import Link from 'next/link';

export default function TqcReportIndexPage() {
    const modules = [
        {
            id: 'ASSEMBLY',
            name: 'ASSEMBLY',
            description: 'TQC reports imported for Assembly processes.',
            icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            id: 'SEWING',
            name: 'SEWING',
            description: 'TQC reports imported for Sewing processes.',
            icon: 'M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5',
            color: 'text-purple-600',
            bg: 'bg-purple-50'
        },
        {
            id: 'TREATMENT',
            name: 'TREATMENT',
            description: 'TQC reports imported for Treatment processes.',
            icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
            color: 'text-teal-600',
            bg: 'bg-teal-50'
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-gray-900">TQC Report</h1>
                <p className="text-sm text-gray-500 mt-1">Select a module category to view, import, and manage TQC defect records.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {modules.map(mod => (
                    <Link key={mod.id} href={`/admin/tqc/${mod.id}`} className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col items-center p-8 text-center">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${mod.bg}`}>
                            <svg className={`w-8 h-8 ${mod.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={mod.icon} />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 tracking-wide">{mod.name}</h2>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{mod.description}</p>
                        <div className="mt-6 flex items-center text-sm font-medium text-gray-400 group-hover:text-gray-900 transition-colors">
                            Manage Data
                            <svg className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
