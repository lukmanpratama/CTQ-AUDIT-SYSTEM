import { InspectorShell } from '../../components/shell/InspectorShell';

// Header + bottom navigation
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return <InspectorShell>{children}</InspectorShell>;
}
