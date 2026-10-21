// Login session kept in localStorage, so it survives closing the browser / app.
// It lasts until the user signs out (clearSession); there is no expiry on the device.

const KEYS = ['nik', 'namaUser', 'role', 'accessToken'] as const;

export type Session = { nik: string; namaUser: string; role: string };

export function saveSession(data: { user: { nik: string; namaUser?: string | null; role: string }; accessToken: string }) {
    localStorage.setItem('nik', data.user.nik);
    localStorage.setItem('namaUser', data.user.namaUser || '');
    localStorage.setItem('role', data.user.role);
    localStorage.setItem('accessToken', data.accessToken);
}

/** The signed-in user, or null. Safe to call only in the browser (e.g. inside useEffect). */
export function getSession(): Session | null {
    try {
        const nik = localStorage.getItem('nik');
        if (!nik) return null;
        return { nik, namaUser: localStorage.getItem('namaUser') || '', role: localStorage.getItem('role') || '' };
    } catch {
        return null; // storage blocked (e.g. private mode)
    }
}

/** Where a signed-in user starts. */
export const homePathFor = (session: Session) => (session.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');

/** Sign out: forget the whole session (older code removed only some keys). */
export function clearSession() {
    for (const key of KEYS) localStorage.removeItem(key);
}
