import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EditSuggestionForm from '@/components/EditSuggestionForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import { formatDate } from '@/lib/utils';
import type { ScheduleRow, Teacher } from '@/lib/types';

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Инициалы для заглушки: первые буквы первых двух слов ФИО. */
function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** День недели по-русски с заглавной («Понедельник») для поиска в day_week. */
function weekdayRu(iso: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date = '' } = await searchParams;
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

  // Занятия по кабинетам на выбранную дату (по совпадению фамилии, ilike).
  const selectedDate = DATE_RE.test(date) ? date : todayIso();
  const isToday = selectedDate === todayIso();

  const surname = teacher.full_name.trim().split(/\s+/)[0] ?? '';
  let todayRows: ScheduleRow[] = [];
  if (surname) {
    // Фактическое расписание на дату (замены/импорт пишут датированные строки).
    // Лимит 20 — запас: пар в день максимум 6-7, но из-за дублей групп бывает больше.
    const { data } = await supabase
      .from('schedule_rows')
      .select('*')
      .eq('date', selectedDate)
      .ilike('teacher', `%${surname}%`)
      .order('lesson', { ascending: true })
      .limit(20);
    const datedRows = (data as ScheduleRow[] | null) ?? [];

    // Недельный шаблон (date is null) на день недели выбранной даты.
    const { data: tplData } = await supabase
      .from('schedule_rows')
      .select('*')
      .is('date', null)
      .ilike('teacher', `%${surname}%`)
      .ilike('day_week', weekdayRu(selectedDate))
      .order('lesson', { ascending: true })
      .limit(20);
    const tplRows = (tplData as ScheduleRow[] | null) ?? [];

    if (datedRows.length === 0) {
      // Датированных строк нет — показываем весь шаблон дня.
      todayRows = tplRows;
    } else {
      // Датированные строки есть, но они могут покрывать не все пары:
      // дополняем их шаблонными парами, которых среди них нет
      // (та же семантика, что в MapExplorer: датированная строка
      // перекрывает шаблонную пару той же группы+пары).
      const covered = new Set(
        datedRows.map((r) => `${r.lesson}|${r.group_name ?? ''}`)
      );
      todayRows = [...datedRows, ...tplRows.filter((r) => !covered.has(`${r.lesson}|${r.group_name ?? ''}`))]
        .sort((a, b) => Number(a.lesson) - Number(b.lesson));
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: 'Преподаватели', href: '/teachers' }, { label: teacher.full_name }]}
      />

      <Link
        href="/teachers"
        className="inline-block text-sm font-medium text-indigo-600 hover:underline"
      >
        ← Ко всем преподавателям
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Информация о преподавателе */}
        <section className="card p-5">
          <div className="flex items-center gap-4">
            {teacher.photo_url ? (
              <Image
                src={teacher.photo_url}
                alt={teacher.full_name}
                width={128}
                height={128}
                className="h-32 w-32 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-4xl font-bold text-indigo-700">
                {initials(teacher.full_name)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-[var(--text)]">{teacher.full_name}</h1>
              <span className="badge mt-2 bg-indigo-50 text-indigo-700">{teacher.subject}</span>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 font-medium text-[var(--text-muted)]">Кабинет</dt>
              <dd className="text-[var(--text)]">{teacher.cabinet || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 font-medium text-[var(--text-muted)]">Почта</dt>
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
              <dt className="w-32 shrink-0 font-medium text-[var(--text-muted)]">Консультации</dt>
              <dd className="text-[var(--text)]">{teacher.consultation || '—'}</dd>
            </div>
          </dl>

          {teacher.description && (
            <p className="mt-4 whitespace-pre-line border-t border-slate-100 dark:border-slate-800 pt-4 text-sm leading-relaxed text-[var(--text)]">
              {teacher.description}
            </p>
          )}
        </section>

        {/* Занятия по кабинетам на выбранную дату */}
        <aside className="card self-start p-4">
          <h2 className="text-base font-bold text-[var(--text)]">
            {isToday
              ? 'Сегодня по кабинетам'
              : `Занятия по кабинетам на ${formatDate(selectedDate)}`}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{formatDate(selectedDate)}</p>

          {/* GET-форма выбора даты — работает без клиентского JS */}
          <form action={`/teachers/${numericId}`} method="get" className="mt-2">
            <label htmlFor="teacher-date" className="label">
              Дата
            </label>
            <input
              id="teacher-date"
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="input"
            />
            <button type="submit" className="btn btn-outline mt-2 w-full text-sm">
              Показать
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {todayRows.length > 0 ? (
              todayRows.map((row) => (
                <div key={row.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-indigo-100 text-indigo-700">
                      {row.lesson} пара
                    </span>
                    <span className="font-medium text-[var(--text)]">{row.subject}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {row.group_name}
                    {row.cabinet ? ` · каб. ${row.cabinet}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                {surname
                  ? 'На эту дату занятий по расписанию нет.'
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
