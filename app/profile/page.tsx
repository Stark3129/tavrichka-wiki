import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import EditUsernameForm from '@/components/EditUsernameForm';
import { cn, formatDate } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export const metadata = {
  title: 'Профиль',
};

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: {
    label: 'Админ',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  },
  moderator: {
    label: 'Модератор',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  },
  student: {
    label: 'Студент',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  user: {
    label: 'Пользователь',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  banned: {
    label: 'Заблокирован',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: {
    label: 'Опубликован',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  pending: {
    label: 'На модерации',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  rejected: {
    label: 'Отклонён',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  },
  hidden: {
    label: 'Скрыт',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatJoinDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date);
  const year = date.getFullYear();
  return `${monthName} ${year}`;
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('username, role, created_at')
    .eq('id', user.id)
    .single();

  const profile = profileData as Partial<Profile> | null;
  const username = profile?.username ?? null;
  const role = profile?.role ?? 'student';
  const roleBadge = ROLE_BADGE[role] ?? {
    label: role,
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  const initials = getInitials(username, user.email);
  const joinDateText = formatJoinDate(profile?.created_at ?? user.created_at);

  const [postsRes, commentsRes, likesRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, type, status, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, text, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id),
  ]);

  const posts = (postsRes.data as Array<{
    id: number;
    title: string;
    type: string;
    status: string;
    created_at: string;
  }> | null) ?? [];

  const comments = (commentsRes.data as Array<{
    id: string;
    text: string;
    created_at: string;
  }> | null) ?? [];

  const likes = (likesRes.data as Array<{ post_id: number }> | null) ?? [];

  let likedPosts: Array<{ id: number; title: string }> = [];
  if (likes.length > 0) {
    const postIds = likes.map((l) => l.post_id);
    const { data: lpData } = await supabase
      .from('posts')
      .select('id, title')
      .in('id', postIds);
    likedPosts = (lpData as Array<{ id: number; title: string }> | null) ?? [];
  }

  return (
    <div className="space-y-6">
      {/* а) Карточка профиля */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-2xl font-bold text-white shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--text)]">
                  {username || 'Пользователь'}
                </h1>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    roleBadge.className
                  )}
                >
                  {roleBadge.label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                {user.email}
              </p>
              {joinDateText && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  На сайте с {joinDateText}
                </p>
              )}
            </div>
          </div>

          <div className="sm:max-w-xs">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Изменить никнейм
            </p>
            <EditUsernameForm initialUsername={username} />
          </div>
        </div>
      </div>

      {/* б) Ряд из 3 карточек статистики */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-2xl" aria-hidden>
              📰
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Постов</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--accent)]">
            {posts.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-2xl" aria-hidden>
              💬
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Комментариев</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--accent)]">
            {comments.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-2xl" aria-hidden>
              ❤️
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Лайков</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--accent)]">
            {likes.length}
          </p>
        </div>
      </div>

      {/* в) Секция "Мои посты" */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Мои посты</h2>
        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => {
              const statusInfo = STATUS_BADGE[post.status] ?? {
                label: post.status,
                className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
              };
              return (
                <div
                  key={post.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">{post.title}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatDate(post.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:self-auto',
                      statusInfo.className
                    )}
                  >
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            У тебя пока нет постов —{' '}
            <Link href="/" className="font-medium text-[var(--accent)] hover:underline">
              предложи первый в ленте!
            </Link>
          </p>
        )}
      </section>

      {/* г) Секция "Мои комментарии" */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">
          Мои комментарии
        </h2>
        {comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((c) => {
              const textSnippet =
                c.text.length > 100 ? `${c.text.slice(0, 100)}…` : c.text;
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-4"
                >
                  <p className="text-sm leading-relaxed text-[var(--text)]">
                    {textSnippet}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    {formatDate(c.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Комментариев пока нет</p>
        )}
      </section>

      {/* д) Секция "Понравилось" */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">
          Понравилось
        </h2>
        {likedPosts.length > 0 ? (
          <div className="space-y-3">
            {likedPosts.map((lp) => (
              <div
                key={lp.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-4"
              >
                <Heart className="h-4 w-4 shrink-0 fill-red-500 text-red-500" />
                <span className="text-sm font-medium text-[var(--text)]">
                  {lp.title}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Пока ничего не лайкнул</p>
        )}
      </section>
    </div>
  );
}
