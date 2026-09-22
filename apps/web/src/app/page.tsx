// apps/web/src/app/page.tsx
// Redirect root to /dashboard or /login

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}
