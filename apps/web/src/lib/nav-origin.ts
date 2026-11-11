'use client';

// Where the inspector came from when opening an audit: the History menu (/history) or a model's
// Inspection Report (/audit/<model>/history). The audit pages' back button in the header and the
// highlighted bottom-nav tab follow it. Kept in sessionStorage so it survives the Header /
// Inspection / Summary steps; the model report and Home reset it.

import { useEffect, useState } from 'react';

const KEY = 'ctq-list-origin';

export function setListOrigin(origin: 'history' | null) {
    try {
        if (origin) sessionStorage.setItem(KEY, origin);
        else sessionStorage.removeItem(KEY);
    } catch { /* storage blocked: the model report is the default */ }
}

export function getListOrigin(): 'history' | null {
    try {
        return sessionStorage.getItem(KEY) === 'history' ? 'history' : null;
    } catch {
        return null;
    }
}

/** Where "back to the list" goes, and what it is called, for an audit of `modelId`. */
export function useListBack(modelId?: string | number | null) {
    const [origin, setOrigin] = useState<'history' | null>(null);
    useEffect(() => setOrigin(getListOrigin()), []);
    if (origin === 'history') return { href: '/history', label: 'Inspection History' };
    if (modelId) return { href: `/audit/${modelId}/history`, label: 'Inspection Report' };
    return { href: '/dashboard', label: 'Home' };
}
