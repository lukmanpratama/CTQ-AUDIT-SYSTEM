// Rates (defect rate, pass rate) are shown with 2 decimals. Rounding rule:
// above half rounds up, an exact half or below rounds down:
//   2,058 -> 2,06   2,0551 -> 2,06   2,055 -> 2,05   97,941 -> 97,94   97,95 -> 97,95
// The 1e-9 tolerances absorb float noise (2,055 * 100 = 205,4999…, 97,95 * 100 = 9795,000…02).

export function roundRate(value: number): number {
    const scaled = Number(value || 0) * 100;
    const whole = Math.floor(scaled + 1e-9);
    const rest = scaled - whole;
    return (rest > 0.5 + 1e-9 ? whole + 1 : whole) / 100;
}

/** "2,05%": the rounded rate in Indonesian notation. */
export function formatRate(value: number): string {
    return `${roundRate(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
