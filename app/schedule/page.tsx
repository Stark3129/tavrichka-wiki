import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import ShareSchedule from '@/components/ShareSchedule';
import type { ScheduleRow } from '@/lib/types';

export const metadata = { title: 'Расписание' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayRu(iso: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; date?: string }>;
}) {
  const { group = '', date = '' } = await searchParams;
  const supabase = await createClient();

  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const selectedDate = DATE_RE.test(date) ? date : today;

  // Список групп для селекта (уникальные значения из schedule_rows — и шаблона,
  // и датированных строк с заменами). Supabase отдаёт максимум 1000 строк за
  // запрос, поэтому читаем постранично, чтобы ни одна группа не потерялась.
  const groupSet = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data } = await supabase
      .from('schedule_rows')
      .select('group_name')
      .order('group_name', { ascending: true })
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as { group_name: string | null }[];
    for (const g of chunk) {
      if (g.group_name) groupSet.add(g.group_name.trim());
    }
    if (chunk.length < PAGE) break;
  }
  const groups = Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'ru'));

  let rows: ScheduleRow[] = [];
  let source: 'replacements' | 'template' = 'replacements';
  if (group) {
    // Сначала — фактическое расписание (замены) на выбранную дату.
    const { data } = await supabase
      .from('schedule_rows')
      .select('*')
      .eq('group_name', group)
      .eq('date', selectedDate)
      .order('lesson', { ascending: true });
    rows = (data as ScheduleRow[] | null) ?? [];

    // Замен на эту дату нет — показываем недельный шаблон (date is null).
    if (rows.length === 0) {
      const weekday = weekdayRu(selectedDate);
      const { data: tpl } = await supabase
        .from('schedule_rows')
        .select('*')
        .is('date', null)
        .eq('group_name', group)
        .ilike('day_week', weekday)
        .order('lesson', { ascending: true });
      if (tpl && tpl.length > 0) {
        rows = tpl as ScheduleRow[];
        source = 'template';
      }
    }
  }

  const dayLabel = rows[0]?.day_week || weekdayRu(selectedDate);

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900">Расписание</h1>
          {group && (
            <span className="ml-auto text-xs text-[var(--text-muted)]">
              {formatDate(selectedDate)} · {dayLabel}
            </span>
          )}
          {group && rows.length > 0 && (
            <ShareSchedule
              group={group}
              date={selectedDate}
              dayLabel={dayLabel}
              rows={rows}
            />
          )}
        </div>

        {/* Обычная GET-форма — работает без клиентского JS */}
        <form
          action="/schedule"
          method="get"
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <label htmlFor="sch-group" className="label">
              Группа
            </label>
            <select id="sch-group" name="group" defaultValue={group} className="input">
              <option value="">— выберите группу —</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sch-date" className="label">
              Дата
            </label>
            <input
              id="sch-date"
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              Показать
            </button>
          </div>
        </form>

        {group && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/schedule?group=${encodeURIComponent(group)}&date=${today}`}
              className={selectedDate === today ? 'btn btn-primary' : 'btn btn-outline'}
            >
              Сегодня
            </Link>
            <Link
              href={`/schedule?group=${encodeURIComponent(group)}&date=${tomorrow}`}
              className={selectedDate === tomorrow ? 'btn btn-primary' : 'btn btn-outline'}
            >
              Завтра
            </Link>
          </div>
        )}
      </div>

      {!group ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          Выберите группу, чтобы посмотреть расписание.
        </p>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          На выбранную дату занятий нет.
        </p>
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            {source === 'replacements'
              ? 'Фактическое расписание (замены)'
              : 'Базовое расписание недели'}
          </p>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-gradient-to-r from-cyan-50 to-blue-50 text-left text-xs uppercase tracking-wide text-[var(--text-muted)] dark:from-cyan-950/50 dark:to-blue-950/50">
                  <th className="px-3 py-2.5">День</th>
                  <th className="px-3 py-2.5">Пара</th>
                  <th className="px-3 py-2.5">Предмет</th>
                  <th className="px-3 py-2.5">Преподаватель</th>
                  <th className="px-3 py-2.5">Аудитория</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {r.day_week || dayLabel}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                        {r.lesson}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text)]">{r.subject}</td>
                    <td className="px-3 py-2.5">{r.teacher}</td>
                    <td className="px-3 py-2.5">{r.cabinet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
