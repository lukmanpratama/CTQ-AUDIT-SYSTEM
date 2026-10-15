/**
 * Centralized mapping from Factory Line to Inspection Areas.
 *
 * Rules:
 * - Factory 1, 2, 3, 4: Cutting, Sewing, Assembly
 * - INHOUSE: Treatment
 * - BOTTOM 1, BOTTOM 2: Stockfit, Hotpress, Incoming Bottom (process: Incoming Midsole)
 */

// Master area for incoming midsole is named "INCOMING BOTTOM"; "INCOMING MIDSOLE" kept as an alias
const BOTTOM_AREAS = ['STOCKFIT', 'HOTPRESS', 'INCOMING BOTTOM', 'INCOMING MIDSOLE'];

export const FACTORY_AREA_MAPPING: Record<string, string[]> = {
    'FACTORY 1': ['CUTTING', 'SEWING', 'ASSEMBLY'],
    'FACTORY 2': ['CUTTING', 'SEWING', 'ASSEMBLY'],
    'FACTORY 3': ['CUTTING', 'SEWING', 'ASSEMBLY'],
    'FACTORY 4': ['CUTTING', 'SEWING', 'ASSEMBLY'],
    'INHOUSE': ['TREATMENT'],
    'BOTTOM 1': BOTTOM_AREAS,
    'BOTTOM 2': BOTTOM_AREAS,
    // Legacy alias kept for backward compatibility
    'BOTTOM': BOTTOM_AREAS,
};

/**
 * Returns allowed uppercase area names for a given factory line identifier/name.
 */
export function getAllowedAreasForFactory(factoryLineOrId: string | null | undefined): string[] {
    if (!factoryLineOrId) return [];
    const normalized = factoryLineOrId.trim().toUpperCase();

    // Direct key match
    if (FACTORY_AREA_MAPPING[normalized]) {
        return FACTORY_AREA_MAPPING[normalized];
    }

    // Number or code aliases (e.g. "1" -> Factory 1)
    if (normalized === '1' || normalized === 'F1') return FACTORY_AREA_MAPPING['FACTORY 1'];
    if (normalized === '2' || normalized === 'F2') return FACTORY_AREA_MAPPING['FACTORY 2'];
    if (normalized === '3' || normalized === 'F3') return FACTORY_AREA_MAPPING['FACTORY 3'];
    if (normalized === '4' || normalized === 'F4') return FACTORY_AREA_MAPPING['FACTORY 4'];
    if (normalized === '5') return FACTORY_AREA_MAPPING['INHOUSE'];
    if (normalized === '6') return FACTORY_AREA_MAPPING['BOTTOM 1'];

    // BOTTOM 1 / BOTTOM 2 prefix match
    if (normalized.startsWith('BOTTOM')) {
        return BOTTOM_AREAS;
    }

    // Generic Factory match
    if (normalized.startsWith('FACTORY')) {
        return ['CUTTING', 'SEWING', 'ASSEMBLY'];
    }

    return [];
}

/**
 * Checks whether an area should be displayed for the given factory line.
 */
export function isAreaAllowedForFactory(
    areaName: string | null | undefined,
    factoryLineOrId: string | null | undefined
): boolean {
    if (!areaName) return false;
    const allowed = getAllowedAreasForFactory(factoryLineOrId);
    if (allowed.length === 0) return true; // fallback if factory line is unspecified

    const normalizedArea = areaName.trim().toUpperCase();
    return allowed.includes(normalizedArea);
}
