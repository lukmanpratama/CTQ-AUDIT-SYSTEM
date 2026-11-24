'use client';

import { useEffect } from 'react';

// A date / time input opens its picker only from the small icon at its right edge; a click on
// the dd/mm/yyyy text just puts the caret in one segment. This opens the picker on a click
// anywhere in the field, for every such input in the app. Typing in the segments still works.
const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'week', 'time']);

export function DatePickerOnClick() {
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const el = e.target;
            if (!(el instanceof HTMLInputElement) || !PICKER_TYPES.has(el.type) || el.readOnly || el.disabled) return;
            try {
                el.showPicker();
            } catch {
                // No picker to open (old browser, or the picker is already open): the input works as before
            }
        };
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
    }, []);
    return null;
}
