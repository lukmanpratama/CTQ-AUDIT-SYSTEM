import { InspectorShell } from '../../components/shell/InspectorShell';

// Header + bottom navigation
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <InspectorShell>{children}</InspectorShell>;
}
