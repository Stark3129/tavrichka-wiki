import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EditSuggestionForm from '@/components/EditSuggestionForm';
import { formatDate } from '@/lib/utils';
import type { ScheduleRow, Teacher } from '@/lib/types';

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('teachers')
    .select('full_name')
    .eq('id', Number(id))
    .single();
  return { title: (data?.full_name as string) ?? 'Преподаватель' };
}

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const supabase = await createClient();
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', numericId)
    .single();

  const teacher = teacherData as Teacher | null;
  if (!teacher || teacher.status !== 'published') notFound();

  // «Сегодня по кабинетам»: занятия за сегодня по совпадению фамилии (ilike).
  const surname = teacher.full_name.trim().split(/\s+/)[0] ?? '';
  let todayRows: ScheduleRow[] = [];
  if (surname) {
    const { data } = await supabase
      .from('schedule_rows')
      .select('*')
      .eq('date', todayIso())
      .ilike('teacher', `%${surname}%`)
      .order('lesson', { ascending: true })
      .limit(100);
    todayRows = (data as ScheduleRow[] | null) ?? [];
  }

  return (
    <div className="space-y-4">
      <Link
        href="/teachers"
        className="inline-block text-sm font-medium text-indigo-600 hover:underline"
      >
        ← Ко всем преподавателям
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Информация о преподавателе */}
        <section className="card p-5">
          <h1 className="text-2xl font-extrabold text-slate-900">{teacher.full_name}</h1>
          <span className="badge mt-2 bg-indigo-50 text-indigo-700">{teacher.subject}</span>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 font-medium text-slate-500">Кабинет</dt>
              <dd className="text-slate-900">{teacher.cabinet || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 font-medium text-slate-500">Почта</dt>
              <dd>
                {teacher.email ? (
                  <a
                    href={`mailto:${teacher.email}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {teacher.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 font-medium text-slate-500">Консультации</dt>
              <dd className="text-slate-900">{teacher.consultation || '—'}</dd>
            </div>
          </dl>

          {teacher.description && (
            <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
              {teacher.description}
            </p>
          )}
        </section>

        {/* Сегодня по кабинетам */}
        <aside className="card self-start p-4">
          <h2 className="text-base font-bold text-slate-900">Сегодня по кабинетам</h2>
          <p className="mt-0.5 text-xs text-slate-500">{formatDate(todayIso())}</p>

          <div className="mt-3 space-y-2">
            {todayRows.length > 0 ? (
              todayRows.map((row) => (
                <div key={row.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-indigo-100 text-indigo-700">
                      {row.lesson} пара
                    </span>
                    <span className="font-medium text-slate-900">{row.subject}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {row.group_name}
                    {row.cabinet ? ` · каб. ${row.cabinet}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {surname
                  ? 'Сегодня занятий по расписанию нет.'
                  : 'Не удалось определить фамилию для поиска.'}
              </p>
            )}
          </div>
        </aside>
      </div>

      <EditSuggestionForm teacher={teacher} />
    </div>
  );
}
