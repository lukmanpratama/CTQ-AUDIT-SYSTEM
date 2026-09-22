// apps/web/src/features/rqc/components/DefectInput.tsx
// Input row for a single defect quantity entry

'use client';

interface DefectInputProps {
  defectId: number;
  defectName: string;
  qtyDefect: number;
  onChange: (defectId: number, qty: number) => void;
  disabled?: boolean;
}

export function DefectInput({
  defectId,
  defectName,
  qtyDefect,
  onChange,
  disabled = false,
}: DefectInputProps) {
  return (
    <div
      className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 transition-colors"
      id={`defect-row-${defectId}`}
    >
      {/* Defect name */}
      <span className="text-sm font-medium text-gray-700 flex-1">
        {defectName}
      </span>

      {/* Qty input */}
      <div className="flex items-center gap-3">
        <label htmlFor={`defect-qty-${defectId}`} className="text-xs text-gray-500">
          Qty
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(defectId, Math.max(0, qtyDefect - 1))}
            disabled={disabled || qtyDefect === 0}
            className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 disabled:opacity-40 transition-colors"
            aria-label={`Decrease qty for ${defectName}`}
          >
            −
          </button>
          <input
            id={`defect-qty-${defectId}`}
            type="number"
            min={0}
            value={qtyDefect}
            onChange={(e) => onChange(defectId, Math.max(0, parseInt(e.target.value, 10) || 0))}
            disabled={disabled}
            className="w-16 text-center text-sm font-semibold border border-gray-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-50"
            aria-label={`Defect quantity for ${defectName}`}
          />
          <button
            type="button"
            onClick={() => onChange(defectId, qtyDefect + 1)}
            disabled={disabled}
            className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold hover:bg-primary-200 disabled:opacity-40 transition-colors"
            aria-label={`Increase qty for ${defectName}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
