'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { mergeUspNames, splitUspNames } from '../../lib/usp-names';

// A model's USPs as chips plus a text box. Enter adds the typed name, a pasted column (one name
// per line, e.g. from Excel) adds one chip per name, and x or Backspace in the empty box removes
// one. The parent keeps the draft text too, so a name typed without Enter can still be saved.
export default function UspTagsInput({ names, onNamesChange, draft, onDraftChange, placeholder = 'Ketik nama USP, Enter', className = '' }: {
    names: string[];
    onNamesChange: (names: string[]) => void;
    draft: string;
    onDraftChange: (draft: string) => void;
    placeholder?: string;
    className?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            onClick={() => inputRef.current?.focus()}
            className={`flex flex-wrap items-center gap-1 border border-gray-200 rounded px-1.5 py-1 bg-white cursor-text focus-within:border-blue-500 transition-colors ${className}`}
        >
            {names.map(name => (
                <span key={name.toUpperCase()} className="inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-0.5 rounded border border-blue-100 bg-blue-50 text-blue-800 text-[11px] font-medium">
                    {name}
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onNamesChange(names.filter(n => n !== name)); }}
                        className="p-0.5 rounded text-blue-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={`Hapus USP ${name}`}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            ))}
            <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => onDraftChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        // Inside a form Enter would submit it; here it only adds the name
                        e.preventDefault();
                        onNamesChange(mergeUspNames(names, splitUspNames(draft)));
                        onDraftChange('');
                    } else if (e.key === 'Backspace' && !draft && names.length > 0) {
                        onNamesChange(names.slice(0, -1));
                    }
                }}
                onPaste={e => {
                    const pasted = splitUspNames(e.clipboardData.getData('text'));
                    if (pasted.length < 2) return;
                    e.preventDefault();
                    onNamesChange(mergeUspNames(names, pasted));
                }}
                placeholder={names.length > 0 ? 'Tambah USP...' : placeholder}
                aria-label="USP"
                className="flex-1 min-w-[120px] px-0.5 text-sm leading-5 bg-transparent focus:outline-none"
            />
        </div>
    );
}
