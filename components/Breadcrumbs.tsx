import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Хлебные крошки: Главная / ... / текущая.
 * Последний элемент рендерится без ссылки (текущая страница).
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const crumbs: Crumb[] = [{ label: 'Главная', href: '/' }, ...items];

  return (
    <nav aria-label="Хлебные крошки" className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-slate-400 dark:text-slate-600 select-none">/</span>}
            {c.href && !isLast ? (
              <Link href={c.href} className="hover:text-[var(--accent)] hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className="font-medium text-[var(--text)]">
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}