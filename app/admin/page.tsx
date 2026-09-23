import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow',
  }).format(new Date());
}

const ACTIONS = [
  { href: '/admin/posts', label: 'Добавить пост', emoji: '📰' },
  { href: '/admin/import', label: 'Импорт замен', emoji: '📥' },
  { href: '/admin/teachers', label: 'Добавить преподавателя', emoji: '👨‍🏫' },
];

const SECTIONS = [
  { href: '/admin/import', label: 'Импорт расписания', emoji: '📥', desc: 'Загрузка матрицы расписания и замен' },
  { href: '/admin/posts', label: 'Посты', emoji: '📰', desc: 'Новости, мемы, анонсы и события' },
  { href: '/admin/teachers', label: 'Преподаватели', emoji: '👨‍🏫', desc: 'Справочник и правки от пользователей' },
  { href: '/admin/suggestions', label: 'Предложения', emoji: '💡', desc: 'Предложки на модерации' },
  { href: '/admin/map', label: 'Карта', emoji: '🗺️', desc: 'Корпуса, этажи и кабинеты' },
  { href: '/admin/replacements', label: 'Замены вручную', emoji: '🔄', desc: 'Добавление и правка замен по датам' },
];

const USERS_SECTION = { href: '/admin/users', label: 'Пользователи', emoji: '👥', desc: 'Управление ролями и доступом' };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const today = todayIso();

  // Роль текущего пользователя: карточку «Пользователи» видим только админу.
  const { data: userData } = await supabase.auth.getUser();
  let role = '';
  if (userData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    role = profile?.role ?? '';
  }
  const isAdminUser = role === 'admin';

  const [postsRes, replacementsRes, teachersRes, editsRes, profilesRes] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase
      .from('replacements')
      .select('*', { count: 'exact', head: true })
      .eq('r_date', today),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase
      .from('teacher_edits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ]);

  const stats = [
    {
      label: 'Посты',
      emoji: '📰',
      href: '/admin/posts',
      count: postsRes.count,
    },
    {
      label: 'Замены сегодня',
      emoji: '🔄',
      href: '/admin/import',
      count: replacementsRes.count,
    },
    {
      label: 'Преподаватели',
      emoji: '👨‍🏫',
      href: '/admin/teachers',
      count: teachersRes.count,
    },
    {
      label: 'Предложения',
      emoji: '💡',
      href: '/admin/suggestions',
      count: editsRes.count,
      accent: true,
    },
    ...(isAdminUser
      ? [
          {
            label: 'Пользователи',
            emoji: '👥',
            href: '/admin/users',
            count: profilesRes.count,
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-[var(--text)]">Панель управления</h1>

      {/* Статистика */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl" aria-hidden>
                {s.emoji}
              </span>
              {s.accent && (s.count ?? 0) > 0 && (
                <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {s.count}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-[var(--accent)]">
              {s.count === null ? '—' : s.count}
            </p>
          </Link>
        ))}
      </div>

      {/* Быстрые действия */}
      <h2 className="mb-3 text-lg font-bold text-[var(--text)]">Быстрые действия</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="btn btn-primary !w-full"
          >
            {a.emoji} {a.label}
          </Link>
        ))}
      </div>

      {/* Разделы админки */}
      <h2 className="mb-3 text-lg font-bold text-[var(--text)]">Разделы админки</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(isAdminUser ? [...SECTIONS, USERS_SECTION] : SECTIONS).map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-4 transition-all hover:border-cyan-300 hover:bg-cyan-50/50 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/30"
          >
            <span className="text-xl" aria-hidden>
              {s.emoji}
            </span>
            <span>
              <span className="block font-semibold text-[var(--text)]">{s.label}</span>
              <span className="block text-xs text-[var(--text-muted)]">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
