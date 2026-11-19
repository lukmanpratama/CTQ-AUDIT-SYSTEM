import { redirect } from 'next/navigation';

// Master USP moved into Setup CTQ as its "USP" tab; old links and bookmarks land there.
export default function MasterUspRedirect() {
    redirect('/admin/setup-ctq?tab=usp');
}
