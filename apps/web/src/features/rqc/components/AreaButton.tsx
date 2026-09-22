// apps/web/src/features/rqc/components/AreaButton.tsx
// Navigation button for Area selection

'use client';

import type { SetupAreaDto } from '@ctqaudit/types';

interface AreaButtonProps {
  area: SetupAreaDto;
  isActive: boolean;
  onClick: (area: SetupAreaDto) => void;
}

export function AreaButton({ area, isActive, onClick }: AreaButtonProps) {
  return (
    <button
      id={`area-btn-${area.setupAreaId}`}
      onClick={() => onClick(area)}
      className={`nav-button ${isActive ? 'active' : ''}`}
      aria-pressed={isActive}
      aria-label={`Select area ${area.area.area}`}
    >
      <span className="font-semibold tracking-wide">{area.area.area}</span>
    </button>
  );
}
