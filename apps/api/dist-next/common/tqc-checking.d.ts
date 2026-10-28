export declare const TQC_CHECK_PER_HOUR = 120;
export declare const TQC_HOURS_PER_DAY = 8;
export declare const TQC_CHECK_PER_DAY: number;
export declare const isCtqTqcDefect: (row: {
    uspClassification?: string | null;
}) => boolean;
type TqcCheckRow = {
    qtyChecking?: number | null;
    time?: string | null;
};
export declare function tqcSlotChecking<T extends TqcCheckRow>(rows: T[], slotKey: (row: T) => string): Map<string, number>;
export declare function tqcDayCellChecking<T extends TqcCheckRow>(rows: T[], dayCellKey: (row: T) => string): Map<string, number>;
export {};
//# sourceMappingURL=tqc-checking.d.ts.map