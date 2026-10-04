'use client';

import { useCallback, useEffect, useState } from 'react';
import RequireRole from '@/components/RequireRole';
import Breadcrumbs from '@/components/Breadcrumbs';
import { createClient } from '@/lib/supabase/client';
import type { ScheduleRow } from '@/lib/types';

function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // iso может быть формата 'YYYY-MM-DD' или ISO timestamptz 'YYYY-MM-DDTHH:mm:ssZ'
  const datePart = iso.slice(0, 10);
  const parts = datePart.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

export default function AdminPermanentPage() {
  return (
    <RequireRole allowed={['admin']}>
      <AdminPermanentPageInner />
    </RequireRole>
  );
}

function AdminPermanentPageInner() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Фильтры
  const [search, setSearch] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Режим редактирования срока действия
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cancelDate, setCancelDate] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('schedule_rows')
      .select('*')
      .eq('type', 'permanent')
      .order('date', { ascending: false })
      .order('lesson', { ascending: true });

    if (err) {
      setError('Не удалось загрузить постоянные изменения расписания.');
    } else {
      setRows((data as ScheduleRow[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayIso();

  async function handleSetValidUntil(row: ScheduleRow) {
    if (!cancelDate) return;
    setBusyId(row.id);
    setError(null);
    setOkMsg(null);

    const supabase = createClient();
    try {
      const { error: updErr } = await supabase
        .from('schedule_rows')
        .update({ valid_until: cancelDate })
        .eq('id', row.id);
      if (updErr) throw updErr;

      // Также обновляем в таблице replacements если существует
      await supabase
        .from('replacements')
        .update({ valid_until: cancelDate })
        .eq('r_date', row.date)
        .eq('group_name', row.group_name)
        .eq('lesson', row.lesson)
        .eq('change_type', 'permanent');

      setOkMsg(`Срок действия изменения для группы ${row.group_name} ограничен датой ${formatDate(cancelDate)}.`);
      setEditingId(null);
      setCancelDate('');
      await load();
    } catch {
      setError('Ошибка при сохранении срока действия.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClearValidUntil(row: ScheduleRow) {
    setBusyId(row.id);
    setError(null);
    setOkMsg(null);

    const supabase = createClient();
    try {
      const { error: updErr } = await supabase
        .from('schedule_rows')
        .update({ valid_until: null })
        .eq('id', row.id);
      if (updErr) throw updErr;

      await supabase
        .from('replacements')
        .update({ valid_until: null })
        .eq('r_date', row.date)
        .eq('group_name', row.group_name)
        .eq('lesson', row.lesson)
        .eq('change_type', 'permanent');

      setOkMsg(`Изменение для группы ${row.group_name} снова бессрочно.`);
      await load();
    } catch {
      setError('Ошибка при снятии срока действия.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: ScheduleRow) {
    if (!confirm(`Удалить постоянное изменение для группы ${row.group_name} (${row.lesson} пара: ${row.subject || '—'})?`)) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    setOkMsg(null);

    const supabase = createClient();
    try {
      const { error: delErr } = await supabase
        .from('schedule_rows')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;

      await supabase
        .from('replacements')
        .delete()
        .eq('r_date', row.date)
        .eq('group_name', row.group_name)
        .eq('lesson', row.lesson)
        .eq('change_type', 'permanent');

      setOkMsg(`Изменение для ${row.group_name} (${row.lesson} пара) успешно удалено.`);
      await load();
    } catch {
      setError('Ошибка при удалении записи.');
    } finally {
      setBusyId(null);
    }
  }

  const filteredRows = rows.filter((r) => {
    if (filterActiveOnly) {
      if (r.valid_until && r.valid_until.slice(0, 10) < today) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.group_name.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        (r.teacher && r.teacher.toLowerCase().includes(q)) ||
        (r.cabinet && r.cabinet.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: 'Админ', href: '/admin' }, { label: 'Постоянные изменения' }]}
      />

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text)]">
              Постоянные изменения расписания
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Жёлтые клетки из файлов замен. Действуют с даты введения на все последующие дни
              выбранного типа недели (или бессрочно), пока не будут отменены.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="self-start rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {loading ? 'Обновляем…' : '🔄 Обновить'}
          </button>
        </div>

        {okMsg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {okMsg}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Поиск по группе, предмету, преподавателю…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700"
            />
            Показывать только действующие
          </label>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Найдено записей: {filteredRows.length} (всего: {rows.length})
          </h2>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка данных…</p>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="font-medium text-[var(--text)]">Постоянных изменений не найдено</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Они автоматически появляются при импорте файлов замен с ячейками, залитыми жёлтым цветом.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-3 py-2">С даты</th>
                  <th className="px-3 py-2">Группа</th>
                  <th className="px-3 py-2">Пара</th>
                  <th className="px-3 py-2">День / Неделя</th>
                  <th className="px-3 py-2">Предмет</th>
                  <th className="px-3 py-2">Преподаватель / Каб.</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((r) => {
                  const isExpired = Boolean(r.valid_until && r.valid_until.slice(0, 10) < today);
                  const isBusy = busyId === r.id;
                  const isEditing = editingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                        isExpired ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-[var(--text)]">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-[var(--text)]">
                        {r.group_name}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text)]">{r.lesson}</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
                        {r.day_week} {r.week_type ? `(${r.week_type})` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text)] font-medium">
                        {r.subject || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
                        {r.teacher || '—'} {r.cabinet ? `· ${r.cabinet}` : ''}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            Истекло ({formatDate(r.valid_until)})
                          </span>
                        ) : r.valid_until ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            До {formatDate(r.valid_until)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Бессрочно
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="date"
                              value={cancelDate}
                              onChange={(e) => setCancelDate(e.target.value)}
                              className="input py-1 px-2 text-xs w-36"
                            />
                            <button
                              type="button"
                              onClick={() => handleSetValidUntil(r)}
                              disabled={!cancelDate || isBusy}
                              className="rounded-md bg-amber-500 text-white px-2 py-1 text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                            >
                              Ок
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setCancelDate('');
                              }}
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(r.id);
                                setCancelDate(r.valid_until ? r.valid_until.slice(0, 10) : today);
                              }}
                              disabled={isBusy}
                              className="text-xs font-medium text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
                              title="Установить дату, до которой действует изменение"
                            >
                              {r.valid_until ? 'Изменить дату' : 'Отменить с даты'}
                            </button>
                            {r.valid_until && (
                              <button
                                type="button"
                                onClick={() => handleClearValidUntil(r)}
                                disabled={isBusy}
                                className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                                title="Сделать изменение бессрочным"
                              >
                                Бессрочно
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              disabled={isBusy}
                              className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                              title="Удалить запись"
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
