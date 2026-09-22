// apps/web/src/features/rqc/components/ProcessButton.tsx
// Navigation button for Process selection

'use client';

import type { SetupProcessDto } from '@ctqaudit/types';

interface ProcessButtonProps {
  process: SetupProcessDto;
  isActive: boolean;
  onClick: (process: SetupProcessDto) => void;
}

export function ProcessButton({ process, isActive, onClick }: ProcessButtonProps) {
  return (
    <button
      id={`process-btn-${process.setupProcessId}`}
      onClick={() => onClick(process)}
      className={`nav-button ${isActive ? 'active' : ''}`}
      aria-pressed={isActive}
      aria-label={`Select process ${process.process.process}`}
    >
      <div className="flex flex-col items-start gap-1 w-full">
        <span className="font-semibold tracking-wide">
          {process.process.process}
        </span>
        {process.process.riskLevel && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              process.process.riskLevel === 'HIGH'
                ? 'bg-red-100 text-red-700'
                : process.process.riskLevel === 'MEDIUM'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {process.process.riskLevel}
          </span>
        )}
      </div>
    </button>
  );
}
