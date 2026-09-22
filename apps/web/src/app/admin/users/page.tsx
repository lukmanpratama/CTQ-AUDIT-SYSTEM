'use client';

import { useEffect, useState } from 'react';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [nik, setNik] = useState('');
    const [namaUser, setNamaUser] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('RQC');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [editingNik, setEditingNik] = useState<string | null>(null);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/master/users');
            setUsers(await res.json());
        } catch (e) { console.error('Failed to fetch users', e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const url = editingNik ? `/api/master/users/${encodeURIComponent(editingNik)}` : '/api/master/users';
            const method = editingNik ? 'PUT' : 'POST';
            const payload: any = { namaUser, role };
            if (editingNik) {
                payload.isActive = isActive;
            } else {
                payload.nik = nik;
                if (!password) throw new Error('Password is required for new users.');
            }
            if (password) payload.password = password;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed to save user.'); }
            cancelEdit();
            fetchUsers();
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    const startEdit = (u: any) => {
        setEditingNik(u.nik);
        setNik(u.nik);
        setNamaUser(u.namaUser);
        setRole(u.role);
        setIsActive(u.isActive);
        setPassword('');
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingNik(null); setNik(''); setNamaUser(''); setPassword(''); setRole('RQC'); setIsActive(true); setError('');
    };

    const handleDelete = async (userNik: string) => {
        if (!window.confirm(`Delete user ${userNik}? This cannot be undone.`)) return;
        setError('');
        const res = await fetch(`/api/master/users/${encodeURIComponent(userNik)}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json();
            setError(d.message || 'Cannot delete — user has existing records.');
        } else { fetchUsers(); }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-semibold text-gray-900">Users</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage inspector and administrator accounts.</p>
            </div>

            {/* Form */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-800">
                        {editingNik ? `Editing: ${editingNik}` : 'Add new user'}
                    </h2>
                    {editingNik && (
                        <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel</button>
                    )}
                </div>
                <div className="p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
                    )}
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">NIK</label>
                            <input value={nik} onChange={e => setNik(e.target.value)} disabled={!!editingNik} required type="text" placeholder="Employee ID" className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                            <input value={namaUser} onChange={e => setNamaUser(e.target.value)} required type="text" className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 bg-white transition-colors">
                                <option value="RQC">RQC (Inspector)</option>
                                <option value="ADMIN">Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">{editingNik ? 'New Password' : 'Password'}</label>
                            <input value={password} onChange={e => setPassword(e.target.value)} required={!editingNik} type="password" placeholder={editingNik ? 'Leave blank to keep' : 'Required'} className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
                        </div>
                        <div className="flex items-end">
                            <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                                {loading ? 'Saving...' : (editingNik ? 'Update' : 'Add User')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* User table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-28">NIK</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Name</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-24">Role</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 w-20">Status</th>
                            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 w-28"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.nik} className={`border-b border-gray-50 transition-colors ${editingNik === u.nik ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{u.nik}</td>
                                <td className="px-4 py-2.5 text-gray-800">{u.namaUser}</td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-violet-50 text-violet-600 border border-violet-200' : 'bg-gray-100 text-gray-600'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center gap-1 text-xs ${u.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                    <div className="inline-flex gap-1">
                                        <button onClick={() => startEdit(u)} className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">Edit</button>
                                        <button onClick={() => handleDelete(u.nik)} className="px-2 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No users found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
