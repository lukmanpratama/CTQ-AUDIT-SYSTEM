import { redirect } from 'next/navigation';

// Master USP moved into Setup CTQ, where each model's USPs are a column of the models table
// (edited with the row); old links and bookmarks land there.
export default function MasterUspRedirect() {
    redirect('/admin/setup-ctq');
}
