'use client';

// Shown by the service worker (src/app/sw.ts) when a page that was never opened on this
// device is requested without a connection. Precached at install, so it always loads.

import { useEffect, useState } from 'react';

export default function OfflinePage() {
    const [online, setOnline] = useState(false);

    useEffect(() => {
        setOnline(navigator.onLine);
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
            <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015.5-2.9M12 18.5h.01M16.7 10.6A10 10 0 0119 13M1.5 9.5a15 15 0 014.4-2.8M12 4.5c3.9 0 7.5 1.5 10.5 4" />
                    </svg>
                </div>
                <h1 className="text-lg font-bold text-gray-900">Anda sedang offline</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Halaman ini belum pernah dibuka di perangkat ini, jadi belum tersimpan untuk dipakai tanpa koneksi.
                    Halaman yang sudah pernah dibuka tetap bisa digunakan.
                </p>
                {/* navigator.onLine only says the network is up, not that the server can be reached */}
                <p className="mt-4 text-xs font-semibold text-gray-400">
                    {online ? 'Jaringan tersambung. Ketuk "Coba lagi" untuk memuat halaman.' : 'Menunggu koneksi...'}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-gray-800"
                    >
                        Coba lagi
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        </div>
    );
}
