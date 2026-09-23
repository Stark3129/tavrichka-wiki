'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Replacement } from '@/lib/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TYPES = ['замена', 'отмена', 'добавление'] as const;

const TYPE_BADGE: Record<string, string> = {
  замена: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  отмена: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  добавление: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

const EMPTY_FORM = {
  group_name: '',
  lesson: '',
  subject: '',
  teacher: '',
  cabinet: '',
  change_type: 'замена' as (typeof TYPES)[number],
  note: '',
};

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export default function AdminReplacementsPage() {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    if (!DATE_RE.test(d)) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('replacements')
      .select('*')
      .eq('r_date', d)
      .order('lesson', { ascending: true });
    if (err) setError('Не удалось загрузить замены.');
    setRows((data as Replacement[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!DATE_RE.test(date)) {
      setError('Некорректная дата.');
      return;
    }
    if (!form.group_name.trim() || !form.subject.trim() || !form.lesson) {
      setError('Заполните группу, пару и предмет.');
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const supabase = createClient();
    const payload = {
      r_date: date,
      group_name: form.group_name.trim(),
      lesson: Number(form.lesson),
      subject: form.subject.trim(),
      teacher: form.teacher.trim() || null,
      cabinet: form.cabinet.trim() || null,
      change_type: form.change_type,
      note: form.note.trim(),
    };
    const { error: err } =
      editingId !== null
        ? await supabase.from('replacements').update(payload).eq('id', editingId)
        : await supabase.from('replacements').insert(payload);
    setBusy(false);
    if (err) {
      setError(
        editingId !== null
          ? 'Не удалось сохранить изменения.'
          : 'Не удалось добавить замену.'
      );
      return;
    }
    setOkMsg(editingId !== null ? 'Замена обновлена.' : 'Замена добавлена.');
    resetForm();
    load(date);
  }

  function startEdit(r: Replacement) {
    setEditingId(r.id);
    setForm({
      group_name: r.group_name,
      lesson: String(r.lesson),
      subject: r.subject,
      teacher: r.teacher ?? '',
      cabinet: r.cabinet ?? '',
      change_type: (TYPES as readonly string[]).includes(r.change_type)
        ? (r.change_type as (typeof TYPES)[number])
        : 'замена',
      note: r.note ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(r: Replacement) {
    if (
      !window.confirm(
        `Удалить замену: ${r.group_name}, ${r.lesson} пара, ${r.subject}?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('replacements').delete().eq('id', r.id);
    setBusy(false);
    if (err) {
      setError('Не удалось удалить замену.');
      return;
    }
    setOkMsg('Замена удалена.');
    if (editingId === r.id) resetForm();
    load(date);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-[var(--text)]">Замены вручную</h1>

      {/* Форма добавления / редактирования */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-lg sm:p-5"
      >
        <h2 className="mb-4 text-lg font-bold text-[var(--text)]">
          {editingId !== null ? `Редактирование замены №${editingId}` : 'Новая замена'}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="rep-date" className="label">
              Дата
            </label>
            <input
              id="rep-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="rep-group" className="label">
              Группа
            </label>
            <input
              id="rep-group"
              type="text"
              value={form.group_name}
              onChange={(e) => setForm({ ...form, group_name: e.target.value })}
              placeholder="4КСК30"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="rep-lesson" className="label">
              Пара
            </label>
            <input
              id="rep-lesson"
              type="number"
              min={1}
              max={6}
              value={form.lesson}
              onChange={(e) => setForm({ ...form, lesson: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Тип</label>
            <div className="flex flex-wrap gap-3 pt-1.5 text-sm text-[var(--text)]">
              {TYPES.map((t) => (
                <label key={t} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="change_type"
                    value={t}
                    checked={form.change_type === t}
                    onChange={() => setForm({ ...form, change_type: t })}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rep-subject" className="label">
              Предмет
            </label>
            <input
              id="rep-subject"
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="rep-teacher" className="label">
              Преподаватель
            </label>
            <input
              id="rep-teacher"
              type="text"
              value={form.teacher}
              onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="rep-cabinet" className="label">
              Кабинет
            </label>
            <input
              id="rep-cabinet"
              type="text"
              value={form.cabinet}
              onChange={(e) => setForm({ ...form, cabinet: e.target.value })}
              placeholder="жд14"
              className="input"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="rep-note" className="label">
              Заметка (необязательно)
            </label>
            <input
              id="rep-note"
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary">
            {editingId !== null ? 'Сохранить' : 'Добавить'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="btn btn-outline"
            >
              Отмена
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {okMsg && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</p>
        )}
      </form>


      {/* Таблица замен на выбранную дату */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-cyan-50 to-blue-50 px-4 py-3 dark:from-cyan-950/50 dark:to-blue-950/50">
          <h2 className="text-lg font-bold text-[var(--text)]">
            Замены на {formatDate(date)}
          </h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Выбрать дату"
            className="input ml-auto !w-auto"
          />
        </div>

        {loading ? (
          <p className="p-6 text-center text-sm text-[var(--text-muted)]">Загружаем…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--text-muted)]">
            На эту дату замен нет
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-3 py-2.5">Пара</th>
                  <th className="px-3 py-2.5">Группа</th>
                  <th className="px-3 py-2.5">Предмет</th>
                  <th className="px-3 py-2.5">Преподаватель</th>
                  <th className="px-3 py-2.5">Кабинет</th>
                  <th className="px-3 py-2.5">Тип</th>
                  <th className="px-3 py-2.5">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                        {r.lesson}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text)]">
                      {r.group_name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text)]">{r.subject}</td>
                    <td className="px-3 py-2.5">{r.teacher || '—'}</td>
                    <td className="px-3 py-2.5">{r.cabinet || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          TYPE_BADGE[r.change_type] ??
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {r.change_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="mr-3 text-cyan-600 hover:underline dark:text-cyan-400"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

