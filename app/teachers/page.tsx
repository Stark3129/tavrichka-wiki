import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TeacherCard from '@/components/TeacherCard';
import type { Teacher } from '@/lib/types';

export const metadata = { title: 'Преподаватели' };

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('status', 'published')
    .order('full_name', { ascending: true });

  const all = (data as Teacher[] | null) ?? [];
  const teachers = query
    ? all.filter(
        (t) =>
          t.full_name.toLowerCase().includes(query) ||
          t.subject.toLowerCase().includes(query)
      )
    : all;

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Преподаватели</h1>
        <form action="/teachers" method="get" className="mt-4 flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ФИО или предмет…"
            aria-label="Поиск по ФИО и предмету"
            className="input max-w-sm flex-1"
          />
          <button type="submit" className="btn btn-primary">
            Найти
          </button>
          {query && (
            <Link href="/teachers" className="btn btn-outline">
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {error && (
        <p className="card p-4 text-sm text-rose-600">
          Не удалось загрузить список преподавателей. Попробуйте обновить страницу.
        </p>
      )}

      {!error && teachers.length === 0 && (
        <p className="card p-6 text-center text-sm text-slate-500">
          {query
            ? 'Ничего не найдено. Попробуйте изменить запрос.'
            : 'Список пока пуст.'}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((t) => (
          <TeacherCard key={t.id} teacher={t} />
        ))}
      </div>
    </div>
  );
}
