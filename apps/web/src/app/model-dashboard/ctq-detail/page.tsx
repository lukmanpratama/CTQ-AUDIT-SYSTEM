import { CtqDetailClient } from '../../../features/admin-dashboard/components/CtqDetailClient';

export default async function CtqDetail({ searchParams }: { searchParams: Promise<any> | any }) {
    // Next.js 15 requires searchParams to be awaited
    const params = await searchParams;
    return <CtqDetailClient searchParams={params} />;
}
