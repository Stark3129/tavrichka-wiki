'use client';

import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';
import type { Replacement } from '@/lib/types';

export default function ReplacementTable({
  rows,
  updatedAt,
}: {
  rows: Replacement[];
  updatedAt: string;
}) {
  const [date, setDate] = useState('');
  const [group, setGroup] = useState('');
  const [teacher, setTeacher] = useState('');

  const groups = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.group_name))).sort((a, b) =>
        a.localeCompare(b, 'ru')
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    const t = teacher.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!date || r.r_date === date) &&
        (!group || r.group_name === group) &&
        (!t || r.teacher.toLowerCase().includes(t))
    );
  }, [rows, date, group, teacher]);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Замены</h1>
        {updatedAt && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            Обновлено: {formatDate(updatedAt)}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          <select
            id="rep-group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="input"
          >
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rep-teacher" className="label">
            Преподаватель
          </label>
          <input
            id="rep-teacher"
            type="search"
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="Фамилия…"
            className="input"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--text-muted)]">Найдено замен: {filtered.length}</p>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-900 p-6 text-center text-sm text-[var(--text-muted)]">
          {rows.length === 0
            ? 'Замены ещё не публиковались.'
            : 'По заданным фильтрам ничего не найдено.'}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-2 py-2">Дата</th>
                <th className="px-2 py-2">Группа</th>
                <th className="px-2 py-2">Пара</th>
                <th className="px-2 py-2">Предмет</th>
                <th className="px-2 py-2">Замена</th>
                <th className="px-2 py-2">Преподаватель</th>
                <th className="px-2 py-2">Кабинет</th>
                <th className="px-2 py-2">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                  <td className="whitespace-nowrap px-2 py-2">{formatDate(r.r_date)}</td>
                  <td className="px-2 py-2 font-medium text-[var(--text)]">{r.group_name}</td>
                  <td className="px-2 py-2">{r.lesson}</td>
                  <td className="px-2 py-2">{r.subject}</td>
                  <td className="px-2 py-2">
                    <span className="badge bg-indigo-50 text-indigo-700">{r.change_type}</span>
                  </td>
                  <td className="px-2 py-2">{r.teacher}</td>
                  <td className="px-2 py-2">{r.cabinet}</td>
                  <td className="px-2 py-2 text-[var(--text-muted)]">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
