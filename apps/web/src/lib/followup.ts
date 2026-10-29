// Follow-up of a finding (an inspection row with a defect): what is still missing before it counts
// as "Sudah diisi lengkap". Same rule in the API: apps/api/src/common/followup.ts.
//   Immediate Action: defect photo, action plan, photo after the action (improvement)
//   CAP (defect rate above 20%): defect photo, root cause, corrective action, photo after the action

export interface FollowUpFields {
    status?: string | null;
    photoDefect?: string | null;
    actionPlan?: string | null;
    rootCause?: string | null;
    corrective?: string | null;
    photoAfterActionPlan?: string | null;
}

const filled = (value?: string | null) => !!value && String(value).trim() !== '';

/** Labels of the parts still missing (empty when complete), in the order they are filled in. */
export function missingFollowUp(i: FollowUpFields): string[] {
    const missing: string[] = [];
    if (!filled(i.photoDefect)) missing.push('Foto defect');
    if (i.status === 'CAP') {
        if (!filled(i.rootCause)) missing.push('Root cause');
        if (!filled(i.corrective)) missing.push('Corrective action');
    } else if (!filled(i.actionPlan)) {
        missing.push('Action plan');
    }
    if (!filled(i.photoAfterActionPlan)) missing.push('Foto setelah action (improvement)');
    return missing;
}
