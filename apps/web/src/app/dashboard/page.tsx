'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModelCard } from '../../features/rqc/components/ModelCard';

export default function DashboardPage() {
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [nik, setNik] = useState<string>('');

    useEffect(() => {
        // Check simulated auth
        const storedNik = localStorage.getItem('nik');
        if (!storedNik) {
            router.push('/login');
            return;
        }
        setNik(storedNik);

        // Fetch setup models via API
        fetch('/api/ctq-setup/models')
            .then(res => res.text().then(t => t ? JSON.parse(t) : []))
            .then(data => {
                setModels(data);
                setLoading(false);
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
            {/* Navbar mock */}
            <nav className="bg-white shadow border-b border-gray-100 flex items-center px-6 py-4 justify-between">
                <h1 className="text-xl font-bold tracking-tight text-gray-900">RQC DATA AUDIT</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600">
                        Inspector: {nik}
                    </span>
                    <button
                        onClick={() => { localStorage.removeItem('nik'); router.push('/login'); }}
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
