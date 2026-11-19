import { redirect } from 'next/navigation';

// Users moved into Master Data as its fourth tab; old links and bookmarks land there.
export default function UsersRedirect() {
    redirect('/admin/master?tab=users');
}
