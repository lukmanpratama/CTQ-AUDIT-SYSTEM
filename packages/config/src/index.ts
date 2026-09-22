// packages/config/src/index.ts
// Shared application configuration constants

export const APP_CONFIG = {
  // Quality calculation defaults (can be overridden via DB config)
  DEFAULT_DEFECT_RATE_THRESHOLD: 0.20,  // 20% → CAP

  // Inspection statuses
  INSPECTION_STATUS: {
    IMMEDIATE_ACTION: 'IMMEDIATE_ACTION',
    CAP: 'CAP',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
  } as const,

  // User roles
  ROLES: {
    ADMIN: 'ADMIN',
    RQC: 'RQC',
  } as const,

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

export type InspectionStatus = typeof APP_CONFIG.INSPECTION_STATUS[keyof typeof APP_CONFIG.INSPECTION_STATUS];
export type UserRole = typeof APP_CONFIG.ROLES[keyof typeof APP_CONFIG.ROLES];
