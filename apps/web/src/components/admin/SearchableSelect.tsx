'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export type SelectOption = { value: string; label: string };

const MIN_PANEL_WIDTH = 260;
const SEARCH_BOX_HEIGHT = 52; // the search box and its padding, above the list
const MAX_LIST_HEIGHT = 240;
const MIN_LIST_HEIGHT = 96;

type PanelPos = { left: number; width: number; top?: number; bottom?: number; listMax: number };

/**
 * A pick-one dropdown with a search box, for lists too long to scan (master processes, defects).
 * It is an "add" picker: the button always shows `placeholder`, and picking an option calls
 * `onSelect(value)` and closes. The panel is portalled to <body> (position: fixed) so no scroll
 * box or overflow clips it, and it opens upward when there is more room above the button.
 * Type to filter (every word must match, case-insensitive), ↑ ↓ to move, Enter to pick, Esc to close.
 */
export default function SearchableSelect({ options, placeholder, onSelect, className = '', searchPlaceholder = 'Search...', emptyText = 'No results found', disabled = false }: {
    options: SelectOption[];
    /** What the closed button says, e.g. "+ Add Process Defect" */
    placeholder: string;
    onSelect: (value: string) => void;
    /** Styles of the closed button (border, padding, font); the layout and chevron are built in */
    className?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<PanelPos>({ left: 0, width: MIN_PANEL_WIDTH, top: 0, listMax: MAX_LIST_HEIGHT });
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const keyNav = useRef(false); // scroll the highlighted row into view only for keyboard moves
    const listId = useId();

    const visible = useMemo(() => {
        const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return options;
        const found = options.filter(o => {
            const label = o.label.toLowerCase();
            return words.every(w => label.includes(w));
        });
        // Labels that start with what was typed come first; the rest keep their order
        const first = words[0];
        return [...found.filter(o => o.label.toLowerCase().startsWith(first)), ...found.filter(o => !o.label.toLowerCase().startsWith(first))];
    }, [options, query]);

    // Close on a click outside, a scroll elsewhere (the panel is fixed) or a resize
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
        };
        const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !keyNav.current) return;
        keyNav.current = false;
        listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const openPanel = () => {
        const rect = buttonRef.current!.getBoundingClientRect();
        const width = Math.max(rect.width, MIN_PANEL_WIDTH);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        // Below unless there is clearly less room there than above
        const below = spaceBelow >= SEARCH_BOX_HEIGHT + 160 || spaceBelow >= spaceAbove;
        const space = below ? spaceBelow : spaceAbove;
        const listMax = Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, space - SEARCH_BOX_HEIGHT));
        setPos(below
            ? { left, width, top: rect.bottom + 4, listMax }
            : { left, width, bottom: window.innerHeight - rect.top + 4, listMax });
        setQuery('');
        setHighlight(0);
        setOpen(true);
    };

    const closePanel = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    const pick = (opt: SelectOption) => {
        closePanel();
        onSelect(opt.value);
    };

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            keyNav.current = true;
            setHighlight(h => Math.min(h + 1, visible.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            keyNav.current = true;
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (visible[highlight]) pick(visible[highlight]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            closePanel();
        }
    };

    const panel = (
        <div
            ref={panelRef}
            style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
            className="z-[60] bg-white border border-gray-200 rounded-lg shadow-xl text-sm text-gray-700 font-normal normal-case tracking-normal text-left overflow-hidden"
        >
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        autoFocus
                        type="text"
                        role="combobox"
                        aria-expanded
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={visible[highlight] ? `${listId}-${highlight}` : undefined}
                        autoComplete="off"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                        onKeyDown={onSearchKeyDown}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="w-full border border-gray-300 rounded-md pl-8 pr-2 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>
            {visible.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400">{emptyText}</p>
            ) : (
                <ul id={listId} ref={listRef} role="listbox" style={{ maxHeight: pos.listMax }} className="overflow-y-auto py-1">
                    {visible.map((o, idx) => (
                        <li
                            key={o.value}
                            id={`${listId}-${idx}`}
                            data-idx={idx}
                            role="option"
                            aria-selected={idx === highlight}
                            onMouseDown={e => e.preventDefault()} // keep the focus in the search box
                            onClick={() => pick(o)}
                            onMouseEnter={() => setHighlight(idx)}
                            title={o.label}
                            className={`px-3 py-1.5 text-xs font-semibold cursor-pointer truncate ${idx === highlight ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                        >
                            {o.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => (open ? setOpen(false) : openPanel())}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`inline-flex items-center justify-between gap-2 text-left cursor-pointer outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            >
                <span className="truncate">{placeholder}</span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" aria-hidden />
            </button>
            {open && createPortal(panel, document.body)}
        </>
    );
}
