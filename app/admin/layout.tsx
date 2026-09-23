import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Админ-зона' };

const NAV = [
  { href: '/admin', label: 'Дашборд' },
  { href: '/admin/import', label: 'Импорт' },
  { href: '/admin/posts', label: 'Посты' },
  { href: '/admin/teachers', label: 'Преподаватели' },
  { href: '/admin/map', label: 'Карта' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  return (
    <div className="space-y-4">
      <nav className="card flex flex-wrap gap-1 p-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
