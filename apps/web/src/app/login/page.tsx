'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [nik, setNik] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nik, password }),
            });

            if (!res.ok) {
                throw new Error('Invalid Username or Password');
            }

            const data = await res.json();

            localStorage.setItem('nik', data.user.nik);
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('accessToken', data.accessToken);

            if (data.user.role === 'ADMIN') {
                router.push('/admin/dashboard');
            } else {
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">CTQ Audit System</h1>
                <p className="text-sm text-center text-gray-500 mb-8">Sign in to start</p>
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            NIK (User ID)
                        </label>
                        <input
                            type="text"
                            value={nik}
                            onChange={(e) => setNik(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="e.g. RQC001"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg shadow-sm transition-colors"
                    >
                        Sign In
                    </button>

                    <div className="text-center mt-4">
                        <Link href="/dashboard-view" className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors cursor-pointer">
                            Go to Dashboard View &rarr;
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
