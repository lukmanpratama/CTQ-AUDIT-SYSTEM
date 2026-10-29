// apps/web/src/features/rqc/components/ModelCard.tsx
// Displays a shoe model as a clickable card for selection

'use client';

import type { SetupModelDto } from '@ctqaudit/types';

interface ModelCardProps {
  model: SetupModelDto;
  isSelected: boolean;
  onClick: (model: SetupModelDto) => void;
  /** Immediate Action + CAP Daily follow-ups of this model not complete yet (red badge; hidden at 0) */
  pendingCount?: number;
}

export function ModelCard({ model, isSelected, onClick, pendingCount = 0 }: ModelCardProps) {
  return (
    <button
      id={`model-card-${model.setupModelId}`}
      onClick={() => onClick(model)}
      className={`model-card relative ${isSelected ? 'selected' : ''}`}
      aria-pressed={isSelected}
      aria-label={`Select model ${model.modelName}${model.modelNo ? ` ${model.modelNo}` : ''}${pendingCount > 0 ? `, ${pendingCount} follow-up belum lengkap` : ''}`}
    >
      {/* Red badge on the top-right corner, overlapping it a little (the card doesn't clip it) */}
      {pendingCount > 0 && (
        <span
          className="absolute -top-2.5 -right-2.5 z-10 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white shadow-md ring-2 ring-white"
          title={`${pendingCount} Immediate Action / CAP belum lengkap`}
        >
          {pendingCount > 99 ? '99+' : pendingCount}
        </span>
      )}
      {/* Model Image */}
      <div className="w-24 h-24 mb-4 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
        {model.picture ? (
          <img
            src={model.picture}
            alt={model.modelName}
            className="w-full h-full object-contain"
          />
        ) : (
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
            />
          </svg>
        )}
      </div>

      {/* Model Name */}
      <span className="text-sm font-semibold text-center leading-tight">
        {model.modelName}
      </span>
      {model.modelNo && (
        <span className="mt-0.5 text-xs font-mono text-gray-500">{model.modelNo}</span>
      )}

      {/* Active indicator */}
      {model.isActive && (
        <span className="mt-2 text-xs text-green-600 font-medium">Active</span>
      )}
    </button>
  );
}
