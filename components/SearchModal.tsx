'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useSearch } from '@/lib/search-context';
import { searchSite, type SearchResults } from '@/lib/search-actions';

const EMPTY: SearchResults = { posts: [], teachers: [], cabinets: [] };

/**
 * Глобальная модалка поиска. Монтируется в layout.
 * Открытие: иконка в шапке или Ctrl/Cmd+K (обработчик здесь,
 * т.к. корневой layout — серверный компонент).
 */
export default function SearchModal() {
  const { open, setOpen } = useSearch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K — открыть.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Сброс при открытии + автофокус.
  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Escape — закрыть.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Поиск с дебаунсом; минимум 2 символа.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setState('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setState('loading');
      try {
        setResults(await searchSite(q));
        setState('done');
      } catch {
        setState('error');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function close() {
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Поиск по сайту"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по постам, преподавателям, кабинетам…"
                className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
                autoFocus
              />
              <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] sm:block">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {state === 'loading' && (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Ищем…
                </p>
              )}

              {state === 'error' && (
                <p className="py-8 text-center text-sm text-rose-600">
                  Ошибка поиска. Попробуйте ещё раз.
                </p>
              )}

              {state === 'idle' && (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Введите минимум 2 символа для поиска.
                </p>
              )}

              {state === 'done' && results.posts.length + results.teachers.length + results.cabinets.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Ничего не найдено.
                </p>
              )}

              {state === 'done' && results.posts.length > 0 && (
                <Group title="Посты">
                  {results.posts.map((p) => (
                    <ResultLink key={`p${p.id}`} href="/" onClick={close}>
                      <span className="font-medium">{p.title}</span>
                      <span className="text-xs text-[var(--text-muted)]">{p.type}</span>
                    </ResultLink>
                  ))}
                </Group>
              )}

              {state === 'done' && results.teachers.length > 0 && (
                <Group title="Преподаватели">
                  {results.teachers.map((t) => (
                    <ResultLink key={`t${t.id}`} href={`/teachers/${t.id}`} onClick={close}>
                      <span className="font-medium">{t.full_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{t.subject}</span>
                    </ResultLink>
                  ))}
                </Group>
              )}

              {state === 'done' && results.cabinets.length > 0 && (
                <Group title="Кабинеты">
                  {results.cabinets.map((c) => (
                    <ResultLink key={`c${c.id}`} href="/map" onClick={close}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        каб. {c.room || '—'} · этаж {c.floor}
                      </span>
                    </ResultLink>
                  ))}
                </Group>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--border)]"
    >
      {children}
    </Link>
  );
}