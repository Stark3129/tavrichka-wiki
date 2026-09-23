'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import { useSearch } from '@/lib/search-context';

const NAV = [
  { href: '/', label: '📰 Лента' },
  { href: '/replacements', label: '🔄 Замены' },
  { href: '/schedule', label: '📅 Расписание' },
  { href: '/teachers', label: '👨‍🏫 Преподаватели' },
  { href: '/map', label: '🗺️ Карта' },
  { href: '/about', label: 'ℹ️ О проекте' },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { setOpen: setSearchOpen } = useSearch();

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
    <header className="sticky top-0 z-30 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-md md:backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-white"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20 text-sm font-black text-white">
            ТВ
          </span>
          Тавричка&nbsp;Вики
        </Link>

        {/* Десктопное меню */}
        <nav className="hidden flex-wrap items-center gap-1 text-sm font-medium sm:flex">
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
                    ? 'bg-white/20 text-white'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 font-semibold text-amber-200 transition-colors hover:bg-white/10 hover:text-amber-100"
            >
              Админ
            </Link>
          )}
        </nav>

        {/* Кнопка-бургер для мобильных (<640px) */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          className="btn ml-auto !px-2.5 !rounded-lg !border-white/30 !bg-white/10 !text-white sm:hidden"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="btn !rounded-lg !px-3 !border-white/30 !bg-white/10 !text-white"
            >
              {busy ? 'Выходим…' : 'Выход'}
            </button>
          ) : (
            <Link
              href="/login"
              className="btn !rounded-lg !px-3 !bg-white !text-indigo-700"
            >
              Вход
            </Link>
          )}
          {/* Кнопка поиска — открывает глобальную модалку (Ctrl/Cmd+K) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Поиск"
            title="Поиск (Ctrl+K)"
            className="btn !px-2.5 !rounded-lg !border-white/30 !bg-white/10 !text-white"
          >
            <Search className="h-4 w-4" />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Выпадающее мобильное меню */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-white/20 sm:hidden"
          >
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm font-medium">
              {NAV.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'rounded-lg px-3 py-2 transition-colors',
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 font-semibold text-amber-200 hover:bg-white/10"
                >
                  Админ
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
