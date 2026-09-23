'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Лента' },
  { href: '/replacements', label: 'Замены' },
  { href: '/schedule', label: 'Расписание' },
  { href: '/teachers', label: 'Преподаватели' },
  { href: '/map', label: 'Карта' },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);

      if (data.user) {
        // Роль берём из таблицы profiles; без записи профиля ссылка «Админ» скрыта.
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        setIsAdmin(profile?.role === 'admin');
      } else {
        setIsAdmin(false);
      }
    }

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setIsAdmin(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setBusy(false);
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-black text-white">
            ТВ
          </span>
          Тавричка&nbsp;Вики
        </Link>

        <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 transition-colors',
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 font-semibold text-amber-600 transition-colors hover:bg-amber-50"
            >
              Админ
            </Link>
          )}
        </nav>

        <div className="ml-auto">
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="btn btn-outline"
            >
              {busy ? 'Выходим…' : 'Выход'}
            </button>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Вход
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
