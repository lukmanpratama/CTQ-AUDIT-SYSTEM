// CAP (Corrective Action Plan) triggers.
// Daily: one inspection row (a defect in a process) above this rate gets status CAP and an alert.
// Weekly: a model whose average defect rate last week (Mon–Sun, total defects / total checked) is above this rate gets an alert on Monday.
export const CAP_DAILY_THRESHOLD = 0.20;
export const CAP_WEEKLY_THRESHOLD = 0.05;
