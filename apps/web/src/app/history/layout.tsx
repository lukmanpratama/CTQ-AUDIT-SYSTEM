import { InspectorShell } from '../../components/shell/InspectorShell';

// Header + bottom navigation
export default function HistoryLayout({ children }: { children: React.ReactNode }) {
    return <InspectorShell>{children}</InspectorShell>;
}
