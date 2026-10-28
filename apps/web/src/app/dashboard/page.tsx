'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModelCard } from '../../features/rqc/components/ModelCard';
import { clearSession } from '../../lib/session';
import { getJson, pendingCount, prefetchMasterData } from '../../lib/offline/inspection-repository';

export default function DashboardPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [nik, setNik] = useState<string>('');
    const [namaUser, setNamaUser] = useState<string>('');

    useEffect(() => {
        // Check simulated auth
        const storedNik = localStorage.getItem('nik');
        if (!storedNik) {
            router.push('/login');
            return;
        }
        setNik(storedNik);

        const storedName = localStorage.getItem('namaUser');
        if (storedName) {
            setNamaUser(storedName);
        } else {
            // Sessions from before the name was stored at login: look it up once
            const token = localStorage.getItem('accessToken');
            if (token) {
                fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
                    .then(res => (res.ok ? res.json() : null))
                    .then(profile => {
                        if (profile?.namaUser) {
                            localStorage.setItem('namaUser', profile.namaUser);
                            setNamaUser(profile.namaUser);
                        }
                    })
                    .catch(() => { /* keep showing the NIK only */ });
            }
        }

        // Setup models (offline: the list kept on this device)
        getJson<any[]>('/api/ctq-setup/models')
            .then(data => {
                setModels(data || []);
                setLoading(false);
                // While online, keep what starting an audit needs for every model, for use without a connection
                prefetchMasterData(data || []);
            })
            .catch(err => {
                console.error('Error fetching models', err);
                setLoading(false);
            });
    }, [router]);

    const handleModelSelect = (model: any) => {
        // Navigate to History screen for this model
        router.push(`/audit/${model.setupModelId}/history`);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navbar stays at the top while the model list scrolls */}
            <nav className="sticky top-0 z-30 bg-white shadow border-b border-gray-100 flex items-center px-6 py-4 justify-between">
                <h1 className="text-xl font-bold tracking-tight text-gray-900">RQC DATA AUDIT</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600">
                        Inspector: {namaUser ? <><span className="font-semibold text-gray-900">{namaUser}</span> ({nik})</> : nik}
                    </span>
                    <button
                        onClick={async () => {
                            // Unsent offline data stays on this device after logout (and is still sent later); say so
                            const pending = await pendingCount();
                            if (pending > 0 && !confirm(`${pending} perubahan belum terkirim ke server. Data tetap tersimpan di perangkat ini dan dikirim otomatis saat online. Tetap logout?`)) return;
                            clearSession();
                            router.replace('/login');
                        }}
                        className="text-sm text-red-600 font-semibold hover:underline"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 mb-2">
                    Select Model
                </h2>
                <p className="text-gray-500 mb-8">Choose an active model to start auditing.</p>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <span className="text-gray-500 font-medium animate-pulse">Loading active models...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {models.map(model => (
                            <ModelCard
                                key={model.setupModelId}
                                model={model}
                                isSelected={false}
                                onClick={handleModelSelect}
                            />
                        ))}
                        {models.length === 0 && (
                            <div className="col-span-full py-10 text-center text-gray-500">
                                No active models found in database.
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
