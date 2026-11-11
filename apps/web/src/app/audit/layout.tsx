import { InspectorShell } from '../../components/shell/InspectorShell';

// Header + bottom navigation around the whole inspector audit wizard
export default function AuditLayout({ children }: { children: React.ReactNode }) {
    return <InspectorShell>{children}</InspectorShell>;
}
