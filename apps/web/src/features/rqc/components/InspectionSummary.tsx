// apps/web/src/features/rqc/components/InspectionSummary.tsx
// Displays inspection result: defect rate, pass rate, status badge

'use client';

import type { RqcInspectionDto } from '@ctqaudit/types';

interface InspectionSummaryProps {
  inspection: RqcInspectionDto;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CAP') {
    return <span className="badge-cap">🔴 CAP Required</span>;
  }
  if (status === 'IMMEDIATE_ACTION') {
    return <span className="badge-immediate">⚠️ Immediate Action</span>;
  }
  if (status === 'CLOSED') {
    return <span className="badge-closed">✅ Closed</span>;
  }
  return <span className="badge-immediate">{status}</span>;
}

export function InspectionSummary({ inspection }: InspectionSummaryProps) {
  const defectRatePct = (inspection.defectRate * 100).toFixed(2);
  const passRatePct = (inspection.passRate * 100).toFixed(2);

  return (
    <div
      id={`inspection-summary-${inspection.rqcInspectionId}`}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{inspection.defect}</h3>
        <StatusBadge status={inspection.status} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Qty Checking</p>
          <p className="text-2xl font-bold text-gray-900">{inspection.qtyChecking}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Qty Defect</p>
          <p className="text-2xl font-bold text-red-600">{inspection.qtyDefect}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Defect Rate</p>
          <p
            className={`text-2xl font-bold ${inspection.defectRate > 0.2 ? 'text-red-600' : 'text-amber-600'
              }`}
          >
            {defectRatePct}%
          </p>
        </div>
      </div>

      {/* Pass rate bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pass Rate</span>
          <span className="font-semibold text-green-700">{passRatePct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-2 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${passRatePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
