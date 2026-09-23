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
  { href: '/admin/suggestions', label: 'Предложки' },
  { href: '/admin/replacements', label: 'Замены вручную' },
  { href: '/admin/users', label: 'Пользователи' },
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

  // Счётчик предложек на модерации для бейджа в навигации.
  const { count: pendingSuggestions } = await supabase
    .from('post_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return (
    <div className="space-y-4">
      <nav className="card flex flex-wrap gap-1 p-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[var(--text)]"
          >
            {item.label}
            {item.href === '/admin/suggestions' && (pendingSuggestions ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {pendingSuggestions}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
