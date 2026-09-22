// apps/web/src/features/rqc/components/ModelCard.tsx
// Displays a shoe model as a clickable card for selection

'use client';

import type { SetupModelDto } from '@ctqaudit/types';

interface ModelCardProps {
  model: SetupModelDto;
  isSelected: boolean;
  onClick: (model: SetupModelDto) => void;
}

export function ModelCard({ model, isSelected, onClick }: ModelCardProps) {
  return (
    <button
      id={`model-card-${model.setupModelId}`}
      onClick={() => onClick(model)}
      className={`model-card ${isSelected ? 'selected' : ''}`}
      aria-pressed={isSelected}
      aria-label={`Select model ${model.modelName}`}
    >
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

      {/* Active indicator */}
      {model.isActive && (
        <span className="mt-2 text-xs text-green-600 font-medium">Active</span>
      )}
    </button>
  );
}
