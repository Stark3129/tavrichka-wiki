import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PostCard from '@/components/PostCard';
import SuggestionForm from '@/components/SuggestionForm';
import BellWidget from '@/components/BellWidget';
import CompactReplacementsBanner from '@/components/CompactReplacementsBanner';
import { cn } from '@/lib/utils';
import type { Comment, LessonTime, Post, Replacement } from '@/lib/types';

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

  const [replacementsRes, timesRes] = await Promise.all([
    supabase
      .from('replacements')
      .select('*')
      .eq('r_date', todayIso())
      .order('lesson', { ascending: true }),
    supabase
      .from('lesson_times')
      .select('*')
      .order('lesson', { ascending: true }),
  ]);
  const replacements = (replacementsRes.data as Replacement[] | null) ?? [];
  const lessonTimes = (timesRes.data as LessonTime[] | null) ?? [];

  // Текущий пользователь для определения лайкнутых постов.
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Комментарии и лайки ко всем постам ленты (одним запросом на таблицу).
  const commentsByPost = new Map<number, Comment[]>();
  const likesCountByPost = new Map<number, number>();
  const userLikedPostIds = new Set<number>();

  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id);

    const [commentsRes, likesRes, userLikesRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*, profiles(username)')
        .in('post_id', postIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds),
      currentUser
        ? supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', currentUser.id)
            .in('post_id', postIds)
        : Promise.resolve({ data: null }),
    ]);

    for (const c of (commentsRes.data as Comment[] | null) ?? []) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }

    for (const l of (likesRes.data as { post_id: number }[] | null) ?? []) {
      likesCountByPost.set(l.post_id, (likesCountByPost.get(l.post_id) ?? 0) + 1);
    }

    for (const ul of (userLikesRes.data as { post_id: number }[] | null) ?? []) {
      userLikedPostIds.add(ul.post_id);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Виджет звонков и обратного отсчёта — ВВЕРХУ bento-сетки (первой карточкой) */}
        <BellWidget initialTimes={lessonTimes} />

        {/* Компактный блок замен на сегодня */}
        <CompactReplacementsBanner replacements={replacements} />

        {/* Быстрые ссылки: Расписание / Карта */}
        <Link
          href="/schedule"
          className="block overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-all duration-200 hover:border-cyan-300 hover:shadow-xl dark:hover:border-cyan-700 md:hover:-translate-y-1 lg:col-span-1"
        >
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">📅 Расписание</h2>
          </div>
          <p className="p-6 text-sm text-[var(--text-muted)]">
            Расписание по группам на сегодня и завтра
          </p>
        </Link>

        <Link
          href="/map"
          className="block overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-all duration-200 hover:border-cyan-300 hover:shadow-xl dark:hover:border-cyan-700 md:hover:-translate-y-1 lg:col-span-1"
        >
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">🗺️ Карта</h2>
          </div>
          <p className="p-6 text-sm text-[var(--text-muted)]">
            Схемы корпусов и кабинеты из расписания
          </p>
        </Link>

        <Link
          href="/teachers"
          className="block overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-all duration-200 hover:border-cyan-300 hover:shadow-xl dark:hover:border-cyan-700 md:hover:-translate-y-1 lg:col-span-1"
        >
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">👨‍🏫 Преподаватели</h2>
          </div>
          <p className="p-6 text-sm text-[var(--text-muted)]">
            Контакты и предметы преподавателей
          </p>
        </Link>

        {/* Предложить мем / новость */}
        <section className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent shadow-lg transition-transform duration-200 md:hover:-translate-y-1 lg:col-span-2">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:from-cyan-950/30 dark:to-blue-950/30">
            <h2 className="text-lg font-bold text-[var(--text)]">✍️ Предложить мем или новость</h2>
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
                  initialCount={likesCountByPost.get(post.id) ?? 0}
                  initialLiked={userLikedPostIds.has(post.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
