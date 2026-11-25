'use client';

import { useMemo, useRef, useState } from 'react';
import { X, Edit2, Trash2, RotateCcw } from 'lucide-react';
import ColumnFilter from './ColumnFilter';
import SearchInput from './SearchInput';
import TablePager, { usePagination } from './TablePager';
import { useColumnFilters } from '../../lib/column-filters';

// User management, shown as the "Users" tab of Master Data (it used to be its own /admin/users page).
// The parent owns the list so the tab badge shows the user count.
export default function UsersPanel({ users, onChanged }: { users: any[]; onChanged: () => void }) {
    const [nik, setNik] = useState('');
    const [namaUser, setNamaUser] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('RQC');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [editingNik, setEditingNik] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const formRef = useRef<HTMLDivElement>(null);

    // Header filters (the role filter used to be a separate dropdown)
    const cf = useColumnFilters(users, {
        nik: { get: u => u.nik },
        namaUser: { get: u => u.namaUser },
        role: { get: u => u.role },
        status: { get: u => (u.isActive ? 'Active' : 'Inactive') },
    });

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
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Failed to save user.'); }
            cancelEdit();
            onChanged();
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
        // The admin shell scrolls inside <main>, not the window
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const cancelEdit = () => {
        setEditingNik(null); setNik(''); setNamaUser(''); setPassword(''); setRole('RQC'); setIsActive(true); setError('');
    };

    const handleDelete = async (userNik: string) => {
        if (!window.confirm(`Delete user ${userNik}? This cannot be undone.`)) return;
        setError('');
        const res = await fetch(`/api/master/users/${encodeURIComponent(userNik)}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d.message || 'Cannot delete — user has existing records.');
        } else { onChanged(); }
    };

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return cf.filtered.filter(u => {
            if (!q) return true;
            return String(u.nik || '').toLowerCase().includes(q) || String(u.namaUser || '').toLowerCase().includes(q);
        });
    }, [cf.filtered, searchQuery]);

    const isFiltered = searchQuery.trim() !== '' || cf.activeCount > 0;
    const pager = usePagination(filtered, { initialSize: 10, resetKey: [searchQuery, cf.filters, cf.sort] });
    const inputCls = 'admin-input';

    return (
        <div className="admin-fill">
            {/* Add / edit form and search in one toolbar: same controls and height as the Areas /
                Processes / Defects toolbar, and the form and the search box span the same width */}
            <div ref={formRef} className="admin-toolbar">
                {editingNik && (
                    <div className="basis-full flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800">Edit user: {editingNik}</span>
                        <button type="button" onClick={cancelEdit} className="text-gray-500 hover:text-gray-800 transition-colors">Batal</button>
                    </div>
                )}
                {error && (
                    <div className="basis-full px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-700 p-0.5"><X className="w-3.5 h-3.5" /></button>
                    </div>
                )}
                <form
                    onSubmit={handleSubmit}
                    className={`basis-full grid grid-cols-1 sm:grid-cols-2 gap-2 items-center ${editingNik
                        ? 'lg:grid-cols-[1fr_1.6fr_1fr_1fr_1fr_auto]'
                        : 'lg:grid-cols-[1fr_1.6fr_1fr_1fr_auto]'}`}
                >
                    <input value={nik} onChange={e => setNik(e.target.value)} disabled={!!editingNik} required type="text" placeholder="NIK (Employee ID)" aria-label="NIK" className={inputCls} />
                    <input value={namaUser} onChange={e => setNamaUser(e.target.value)} required type="text" placeholder="Nama lengkap" aria-label="Nama Lengkap" className={inputCls} />
                    <select value={role} onChange={e => setRole(e.target.value)} aria-label="Role" className={inputCls}>
                        <option value="RQC">RQC (Inspector)</option>
                        <option value="ADMIN">Administrator</option>
                    </select>
                    <input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required={!editingNik}
                        type="password"
                        autoComplete="new-password"
                        placeholder={editingNik ? 'Password baru (kosongkan jika tetap)' : 'Password (wajib)'}
                        aria-label={editingNik ? 'Password Baru' : 'Password'}
                        className={inputCls}
                    />
                    {editingNik && (
                        <select value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')} aria-label="Status" className={inputCls}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    )}
                    <button type="submit" disabled={loading} className="admin-btn admin-btn-primary">
                        {loading ? 'Menyimpan...' : (editingNik ? 'Update' : 'Tambah User')}
                    </button>
                </form>

                <div className="basis-full flex items-center gap-3">
                    <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Cari user (NIK / nama)..." className="flex-1 min-w-0" />
                    {isFiltered && (
                        <button onClick={() => { setSearchQuery(''); cf.clearAll(); }} className="inline-flex items-center gap-1 h-9 flex-shrink-0 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium">
                            <RotateCcw className="w-3 h-3" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* User table: the rows scroll, the column headers stay */}
            <div className="admin-table-card">
                <div className="admin-table-scroll">
                    <table className="w-full text-sm min-w-[560px]">
                        <thead className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="text-left py-3 px-4 w-32"><ColumnFilter {...cf.bind('nik', 'NIK')} /></th>
                                <th className="text-left py-3 px-4"><ColumnFilter {...cf.bind('namaUser', 'Nama')} /></th>
                                <th className="text-left py-3 px-4 w-24"><ColumnFilter {...cf.bind('role', 'Role')} /></th>
                                <th className="text-left py-3 px-4 w-24"><ColumnFilter {...cf.bind('status', 'Status')} /></th>
                                <th className="text-right py-3 px-4 w-36">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pager.pageRows.map(u => (
                                <tr key={u.nik} className={`transition-colors group ${editingNik === u.nik ? 'bg-blue-50/40' : 'hover:bg-gray-50/80'}`}>
                                    <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{u.nik}</td>
                                    <td className="py-2.5 px-4 font-medium text-gray-900">{u.namaUser}</td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-violet-50 text-violet-600 border border-violet-200' : 'bg-gray-100 text-gray-600'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center gap-1 text-xs ${u.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="inline-flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(u)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-colors">
                                                <Edit2 className="w-3 h-3" />
                                                Edit
                                            </button>
                                            <button onClick={() => handleDelete(u.nik)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors">
                                                <Trash2 className="w-3 h-3" />
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                                        {users.length === 0 ? 'Belum ada user.' : 'Tidak ada user yang sesuai dengan pencarian/filter.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePager
                    page={pager.page}
                    pageSize={pager.pageSize}
                    total={pager.total}
                    onPage={pager.setPage}
                    onPageSize={pager.setPageSize}
                    noun="user"
                    extra={users.length !== pager.total ? <span className="text-gray-400">(difilter dari {users.length})</span> : undefined}
                />
            </div>
        </div>
    );
}
