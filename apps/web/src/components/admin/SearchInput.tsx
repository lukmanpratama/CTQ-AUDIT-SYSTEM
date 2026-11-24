'use client';

import { Search, X } from 'lucide-react';

/** The search box of every admin toolbar: same height and look as the other controls (.admin-input) */
export default function SearchInput({ value, onChange, placeholder, className = '' }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="admin-input pl-9 pr-8"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 rounded"
                    title="Hapus pencarian"
                    aria-label="Hapus pencarian"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
