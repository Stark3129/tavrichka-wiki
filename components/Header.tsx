'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { Menu, Search, User as UserIcon, X } from 'lucide-react';
import { logout } from '@/lib/actions';
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

export default function Header({
  user,
  isAdmin,
  userRole,
}: {
  user: User | null;
  isAdmin: boolean;
  userRole?: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { setOpen: setSearchOpen } = useSearch();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-md md:from-cyan-500/80 md:via-blue-600/80 md:to-indigo-600/80 md:backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 min-w-0">
        {/* Левая часть: логотип и навигация десктопа */}
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-white min-w-0 shrink"
          >
            <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg border border-white/30 bg-white/20 font-mono text-sm font-black tracking-tight text-white">
              2.8
            </span>
            <span className="truncate">Тавричка&nbsp;Вики</span>
          </Link>

          {/* Полная навигация — только на lg+ (одна строка) */}
          <nav className="hidden items-center gap-1.5 text-sm font-medium lg:flex xl:gap-2">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors xl:px-3',
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
                className="rounded-lg px-2.5 py-1.5 font-semibold whitespace-nowrap text-amber-200 transition-colors hover:bg-white/10 hover:text-amber-100 xl:px-3"
              >
                Админ
              </Link>
            )}
          </nav>
        </div>

        {/* Правая часть */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Десктопная секция профиля / входа (только lg+) */}
          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              {/* На lg (1024-1280px) компактная кнопка профиля без текста email */}
              <Link
                href="/profile"
                title={user.email ?? 'Профиль'}
                aria-label="Профиль"
                className="btn !w-10 !h-10 !p-0 !rounded-lg !border-white/30 !bg-white/10 !text-white flex items-center justify-center shrink-0 xl:hidden"
              >
                <UserIcon className="h-4 w-4" />
              </Link>
              {/* На xl+ показываем усечённый email */}
              <Link
                href="/profile"
                title={user.email ?? 'Профиль'}
                className="hidden max-w-[120px] truncate text-sm text-white/90 hover:text-white transition xl:block"
              >
                {user.email}
              </Link>
              {userRole === 'admin' && (
                <span className="hidden rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-100 xl:inline-block">
                  Админ
                </span>
              )}
              {userRole === 'moderator' && (
                <span className="hidden rounded bg-blue-500/30 px-1.5 py-0.5 text-xs text-blue-100 xl:inline-block">
                  Модер
                </span>
              )}
              <form action={logout}>
                <button
                  type="submit"
                  className="btn !rounded-lg !px-3 !border-white/30 !bg-white/10 !text-white"
                >
                  Выход
                </button>
              </form>
            </div>
          ) : (
            <div className="hidden lg:block">
              <Link
                href="/auth"
                className="btn !rounded-lg !px-3 !bg-white !text-indigo-700 font-medium"
              >
                Вход
              </Link>
            </div>
          )}

          {/* Ровно 3 кнопки одинакового размера (w-10 h-10, shrink-0):
              1. Лупа
              2. Переключатель темы
              3. Бургер (скрыт на lg+) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Поиск"
            title="Поиск (Ctrl+K)"
            className="btn !w-10 !h-10 !p-0 !rounded-lg !border-white/30 !bg-white/10 !text-white shrink-0 flex items-center justify-center transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>

          <ThemeToggle className="!w-10 !h-10 !p-0 shrink-0" />

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            className="btn !w-10 !h-10 !p-0 !rounded-lg !border-white/30 !bg-white/10 !text-white shrink-0 flex items-center justify-center transition-colors lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
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
            className="overflow-hidden border-t border-white/20 lg:hidden w-full"
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
                        ? 'bg-white/20 text-white font-semibold'
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
                  🛡️ Админ-панель
                </Link>
              )}

              {/* Блок пользователя внутри меню (только на мобильных) */}
              <div className="mt-2 border-t border-white/20 pt-2">
                {user ? (
                  <div className="flex flex-col gap-1">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white transition"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <UserIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </span>
                      {userRole && (
                        <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 text-xs text-white">
                          {userRole === 'admin' ? 'Админ' : userRole === 'moderator' ? 'Модер' : userRole}
                        </span>
                      )}
                    </Link>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="w-full text-left rounded-lg px-3 py-2 text-rose-200 hover:bg-rose-500/20 hover:text-rose-100 transition"
                      >
                        🚪 Выйти из аккаунта
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center rounded-xl bg-white px-4 py-2 text-center font-semibold text-indigo-700 shadow-md transition hover:bg-white/90"
                  >
                    Войти в аккаунт
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
