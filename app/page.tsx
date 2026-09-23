import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PostCard from '@/components/PostCard';
import SuggestionForm from '@/components/SuggestionForm';
import { cn, formatDate } from '@/lib/utils';
import type { Post, Replacement } from '@/lib/types';
import type { Comment } from '@/lib/types';

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

  // Комментарии ко всем постам ленты (одним запросом, группируем по post_id).
  const commentsByPost = new Map<number, Comment[]>();
  if (posts.length > 0) {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .in('post_id', posts.map((p) => p.id))
      .order('created_at', { ascending: true });
    for (const c of (commentsData as Comment[] | null) ?? []) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Замены сегодня — широкая карточка */}
        <section className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-transform duration-200 md:hover:-translate-y-1 lg:col-span-2">
          <div className="flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">🔄 Замены сегодня</h2>
            <Link
              href="/replacements"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Все замены →
            </Link>
          </div>
          <div className="space-y-2 p-6">
            <p className="text-xs text-[var(--text-muted)]">{formatDate(todayIso())}</p>
            {replacements.length > 0 ? (
              replacements.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">{r.subject}</span>
                    <span className="badge bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                      {r.lesson} пара
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {r.group_name} · {r.change_type}
                  </p>
                  {(r.teacher || r.cabinet) && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.teacher}
                      {r.cabinet ? ` · каб. ${r.cabinet}` : ''}
                    </p>
                  )}
                  {r.note && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{r.note}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
                На сегодня замен нет.
              </p>
            )}
          </div>
        </section>

        {/* Быстрые ссылки: Расписание / Карта / Преподаватели */}
        {[
          { href: '/schedule', emoji: '📅', title: 'Расписание', desc: 'Расписание по группам на сегодня и завтра' },
          { href: '/map', emoji: '🗺️', title: 'Карта', desc: 'Схемы корпусов и кабинеты из расписания' },
          { href: '/teachers', emoji: '👨‍🏫', title: 'Преподаватели', desc: 'Контакты и предметы преподавателей' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-all duration-200 hover:border-cyan-300 hover:shadow-xl dark:hover:border-cyan-700 md:hover:-translate-y-1 lg:col-span-1"
          >
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {item.emoji} {item.title}
              </h2>
            </div>
            <p className="p-6 text-sm text-[var(--text-muted)]">{item.desc}</p>
          </Link>
        ))}

        {/* Предложить мем / новость */}
        <section className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-transform duration-200 md:hover:-translate-y-1 lg:col-span-1">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">✍️ Предложить мем</h2>
          </div>
          <div className="p-6">
            <SuggestionForm />
          </div>
        </section>

        {/* Лента новостей — самая широкая карточка */}
        <section className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg lg:col-span-3">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">📰 Лента</h2>
          </div>
          <div className="p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <Link
                  key={t.label}
                  href={t.value ? `/?type=${t.value}` : '/'}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    t.value === activeType
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : 'border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-cyan-300 hover:text-cyan-600'
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {postsError && (
              <p className="text-sm text-rose-600">
                Не удалось загрузить ленту. Попробуйте обновить страницу.
              </p>
            )}

            {!postsError && posts.length === 0 && (
              <p className="text-center text-sm text-[var(--text-muted)]">
                {activeType ? 'В этой категории пока нет постов.' : 'Постов пока нет.'}
              </p>
            )}

            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  comments={commentsByPost.get(post.id) ?? []}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
