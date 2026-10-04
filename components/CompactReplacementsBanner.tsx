'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { getMyGroup, subscribeMyGroup } from '@/lib/my-group';
import type { Replacement } from '@/lib/types';

export default function CompactReplacementsBanner({
  replacements = [],
}: {
  replacements: Replacement[];
}) {
  const [myGroup, setMyGroupState] = useState<string | null>(null);

  useEffect(() => {
    setMyGroupState(getMyGroup());
    return subscribeMyGroup((group) => {
      setMyGroupState(group);
    });
  }, []);

  const count = replacements.length;

  const hasMyGroupReplacements = Boolean(
    myGroup &&
      replacements.some(
        (r) =>
          r.group_name &&
          r.group_name.trim().toLowerCase() === myGroup.trim().toLowerCase()
      )
  );

  return (
    <section className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent p-4 sm:p-5 shadow-lg transition-transform duration-200 md:hover:-translate-y-1 lg:col-span-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
            <RefreshCw className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-[var(--text)] truncate">
            Замены сегодня
          </h2>
        </div>

        {count > 0 ? (
          <Link
            href="/replacements"
            className="btn btn-primary !px-3 !py-1 text-xs whitespace-nowrap shadow-xs"
          >
            Смотреть →
          </Link>
        ) : (
          <Link
            href="/replacements"
            className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
          >
            Все замены →
          </Link>
        )}
      </div>

      <div className="mt-2.5">
        <p className="text-sm font-medium text-[var(--text)]">
          {count > 0 ? (
            <span>
              Сегодня замен:{' '}
              <strong className="text-cyan-600 dark:text-cyan-400 font-bold">
                {count}
              </strong>
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">Сегодня замен нет 🎉</span>
          )}
        </p>

        {hasMyGroupReplacements && (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-500 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>⚠️ Есть замены у твоей группы!</span>
          </p>
        )}
      </div>
    </section>
  );
}
