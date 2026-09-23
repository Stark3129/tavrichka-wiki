import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PostCard from '@/components/PostCard';
import { cn, formatDate } from '@/lib/utils';
import type { Post, Replacement } from '@/lib/types';

const TYPES = [
  { value: '', label: 'Все' },
  { value: 'news', label: 'Новости' },
  { value: 'meme', label: 'Мемы' },
  { value: 'announce', label: 'Анонсы' },
  { value: 'useful', label: 'Полезное' },
  { value: 'event', label: 'События' },
];

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow',
  }).format(new Date());
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = TYPES.some((t) => t.value && t.value === type) ? type! : '';

  const supabase = await createClient();

  let postsQuery = supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (activeType) postsQuery = postsQuery.eq('type', activeType);

  const { data: postsData, error: postsError } = await postsQuery;
  const posts = (postsData as Post[] | null) ?? [];

  const { data: replacementsData } = await supabase
    .from('replacements')
    .select('*')
    .eq('r_date', todayIso())
    .order('lesson', { ascending: true });
  const replacements = (replacementsData as Replacement[] | null) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      {/* Лента постов */}
      <section>
        <h1 className="mb-4 text-2xl font-extrabold text-slate-900">Лента</h1>

        <div className="mb-4 flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Link
              key={t.label}
              href={t.value ? `/?type=${t.value}` : '/'}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                t.value === activeType
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {postsError && (
          <p className="card p-4 text-sm text-rose-600">
            Не удалось загрузить ленту. Попробуйте обновить страницу.
          </p>
        )}

        {!postsError && posts.length === 0 && (
          <p className="card p-6 text-center text-sm text-slate-500">
            {activeType ? 'В этой категории пока нет постов.' : 'Постов пока нет.'}
          </p>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* Сайдбар «Замены сегодня» */}
      <aside>
        <h2 className="text-lg font-bold text-slate-900">Замены сегодня</h2>
        <p className="mt-0.5 text-xs text-slate-500">{formatDate(todayIso())}</p>

        <div className="mt-3 space-y-2">
          {replacements.length > 0 ? (
            replacements.map((r) => (
              <div key={r.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{r.subject}</span>
                  <span className="badge bg-indigo-50 text-indigo-700">
                    {r.lesson} пара
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {r.group_name} · {r.change_type}
                </p>
                {(r.teacher || r.cabinet) && (
                  <p className="text-xs text-slate-500">
                    {r.teacher}
                    {r.cabinet ? ` · каб. ${r.cabinet}` : ''}
                  </p>
                )}
                {r.note && <p className="mt-1 text-xs text-slate-500">{r.note}</p>}
              </div>
            ))
          ) : (
            <p className="card p-4 text-sm text-slate-500">На сегодня замен нет.</p>
          )}
        </div>

        <Link
          href="/replacements"
          className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          Все замены →
        </Link>
      </aside>
    </div>
  );
}
