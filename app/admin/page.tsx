import { createClient } from '@/lib/supabase/server';

type CountSpec = {
  label: string;
  table: string;
  href: string;
  filter?: { col: string; val: string };
  accent?: boolean;
};

const SPECS: CountSpec[] = [
  { label: 'Замены', table: 'replacements', href: '/replacements' },
  { label: 'Строки расписания', table: 'schedule_rows', href: '/schedule' },
  { label: 'Преподаватели', table: 'teachers', href: '/teachers' },
  { label: 'Посты', table: 'posts', href: '/admin/posts' },
  { label: 'Объекты карты', table: 'map_objects', href: '/admin/map' },
  {
    label: 'Правки на проверке',
    table: 'teacher_edits',
    href: '/admin/teachers',
    filter: { col: 'status', val: 'pending' },
    accent: true,
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const counts = await Promise.all(
    SPECS.map(async (spec) => {
      let q = supabase.from(spec.table).select('*', { count: 'exact', head: true });
      if (spec.filter) q = q.eq(spec.filter.col, spec.filter.val);
      const { count, error } = await q;
      return { spec, count: error ? null : (count ?? 0) };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">Дашборд</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map(({ spec, count }) => (
          <a
            key={spec.table + (spec.filter?.val ?? '')}
            href={spec.href}
            className="card p-4 transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-slate-500">{spec.label}</p>
            <p
              className={`mt-1 text-3xl font-extrabold ${
                spec.accent ? 'text-amber-600' : 'text-indigo-600'
              }`}
            >
              {count === null ? '—' : count}
            </p>
            {count === null && (
              <p className="mt-1 text-xs text-rose-500">Ошибка запроса</p>
            )}
          </a>
        ))}
      </div>

      <div className="card p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Что дальше</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Загрузите актуальную матрицу расписания на странице{' '}
            <a href="/admin/import" className="text-indigo-600 hover:underline">
              Импорт
            </a>
            .
          </li>
          <li>
            Проверьте правки от пользователей в разделе{' '}
            <a href="/admin/teachers" className="text-indigo-600 hover:underline">
              Преподаватели
            </a>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
