'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession, homePathFor, saveSession } from '../../lib/session';

export default function LoginPage() {
    const [nik, setNik] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const [error, setError] = useState('');
    // Stays true while checking for a saved session, so the form doesn't flash before redirecting
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        // Opening the app again (it starts at / → /login) skips the form until the user signs out
        const session = getSession();
        if (session) {
            router.replace(homePathFor(session));
        } else {
            setCheckingSession(false);
        }
    }, [router]);

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

            saveSession(data);
            // replace: the Back button shouldn't return to the login form
            router.replace(data.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    };

    if (checkingSession) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
            </main>
        );
    }

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
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full pl-4 pr-11 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                            >
                                {showPassword ? (
                                    // eye-slash
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                ) : (
                                    // eye
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                )}
                            </button>
                        </div>
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
