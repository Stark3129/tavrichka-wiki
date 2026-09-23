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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-md md:from-cyan-500/80 md:via-blue-600/80 md:to-indigo-600/80 md:backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-x-4 px-4">
        {/* Левая часть: логотип и навигация */}
        <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-white"
        >
          <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg border border-white/30 bg-white/20 font-mono text-sm font-black tracking-tight text-white">
            2.8
          </span>
          Тавричка&nbsp;Вики
        </Link>

        {/* Полная навигация — только на lg+ (одна строка) */}
        <nav className="hidden items-center gap-2 text-sm font-medium lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors',
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
              className="rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap text-amber-200 transition-colors hover:bg-white/10 hover:text-amber-100"
            >
              Админ
            </Link>
          )}
        </nav>
        </div>

        {/* Правая часть: бургер (мобильные), Выход/Вход, поиск, тема */}
        <div className="flex items-center gap-2">
          {/* Кнопка-бургер — видна на md и мобильных (<lg) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            className="btn !px-2.5 !rounded-lg !border-white/30 !bg-white/10 !text-white lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

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
            className="overflow-hidden border-t border-white/20 lg:hidden"
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
