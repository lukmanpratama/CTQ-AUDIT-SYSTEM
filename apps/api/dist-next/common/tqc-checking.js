"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCtqTqcDefect = exports.TQC_CHECK_PER_DAY = exports.TQC_HOURS_PER_DAY = exports.TQC_CHECK_PER_HOUR = void 0;
exports.tqcSlotChecking = tqcSlotChecking;
exports.tqcDayCellChecking = tqcDayCellChecking;
exports.TQC_CHECK_PER_HOUR = 120;
exports.TQC_HOURS_PER_DAY = 8;
exports.TQC_CHECK_PER_DAY = exports.TQC_CHECK_PER_HOUR * exports.TQC_HOURS_PER_DAY;
const isCtqTqcDefect = (row) => !!row.uspClassification?.trim();
exports.isCtqTqcDefect = isCtqTqcDefect;
const editedValue = (row) => row.qtyChecking != null && Number.isFinite(Number(row.qtyChecking)) ? Number(row.qtyChecking) : null;
function tqcSlotChecking(rows, slotKey) {
    const slots = new Map();
    const edited = new Set();
    for (const row of rows) {
        const key = slotKey(row);
        const value = editedValue(row);
        if (value != null && !edited.has(key)) {
            slots.set(key, value);
            edited.add(key);
        }
        else if (!slots.has(key)) {
            slots.set(key, exports.TQC_CHECK_PER_HOUR);
        }
    }
    return slots;
}
function tqcDayCellChecking(rows, dayCellKey) {
    const slots = tqcSlotChecking(rows, row => `${dayCellKey(row)}|${row.time || 'no-time'}`);
    const days = new Map();
    for (const row of rows) {
        const key = dayCellKey(row);
        if (!days.has(key))
            days.set(key, exports.TQC_CHECK_PER_DAY);
    }
    for (const [slot, value] of slots) {
        const day = slot.slice(0, slot.lastIndexOf('|'));
        days.set(day, (days.get(day) ?? exports.TQC_CHECK_PER_DAY) + (value - exports.TQC_CHECK_PER_HOUR));
    }
    return days;
}
//# sourceMappingURL=tqc-checking.js.map