/**
 * TQC Qty Checking rules.
 *
 * TQC samples 120 pairs per hour, 8 hours a day (960 per cell per day). An admin can override the
 * checking qty of an hour slot by editing a TQC row (tqc_report.qty_checking); rows that were never
 * edited keep the standard 120. All rows of one hour slot share the slot's checking qty, so the first
 * edited value found in a slot wins.
 */

export const TQC_CHECK_PER_HOUR = 120;
export const TQC_HOURS_PER_DAY = 8;
export const TQC_CHECK_PER_DAY = TQC_CHECK_PER_HOUR * TQC_HOURS_PER_DAY;

type TqcCheckRow = { qtyChecking?: number | null; time?: string | null };

const editedValue = (row: TqcCheckRow) =>
    row.qtyChecking != null && Number.isFinite(Number(row.qtyChecking)) ? Number(row.qtyChecking) : null;

/** Checking qty per hour slot: the edited value, else 120. */
export function tqcSlotChecking<T extends TqcCheckRow>(rows: T[], slotKey: (row: T) => string) {
    const slots = new Map<string, number>();
    const edited = new Set<string>();
    for (const row of rows) {
        const key = slotKey(row);
        const value = editedValue(row);
        if (value != null && !edited.has(key)) {
            slots.set(key, value);
            edited.add(key);
        } else if (!slots.has(key)) {
            slots.set(key, TQC_CHECK_PER_HOUR);
        }
    }
    return slots;
}

/**
 * Checking qty per day and cell: the standard 960, adjusted by every edited hour slot of that
 * day/cell (an hour edited to 100 lowers the day to 940). Without edits this is exactly 960.
 */
export function tqcDayCellChecking<T extends TqcCheckRow>(rows: T[], dayCellKey: (row: T) => string) {
    const slots = tqcSlotChecking(rows, row => `${dayCellKey(row)}|${row.time || 'no-time'}`);
    const days = new Map<string, number>();
    for (const row of rows) {
        const key = dayCellKey(row);
        if (!days.has(key)) days.set(key, TQC_CHECK_PER_DAY);
    }
    for (const [slot, value] of slots) {
        const day = slot.slice(0, slot.lastIndexOf('|'));
        days.set(day, (days.get(day) ?? TQC_CHECK_PER_DAY) + (value - TQC_CHECK_PER_HOUR));
    }
    return days;
}
