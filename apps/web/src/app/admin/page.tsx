import { redirect } from 'next/navigation';

export default function AdminRootPage() {
    // Automatically redirect to the dashboard
    redirect('/admin/dashboard');
}
