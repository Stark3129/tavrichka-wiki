'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import {
  parseScheduleMatrix,
  parseSemesterWorkbook,
  type ParsedLesson,
  type ParseResult,
} from '@/lib/parse-schedule';
import Breadcrumbs from '@/components/Breadcrumbs';

type Mode = 'append' | 'replace';
type ImportKind = 'date' | 'semester';

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [weekType, setWeekType] = useState<'числитель' | 'знаменатель'>('числитель');
  const [mode, setMode] = useState<Mode>('append');
  const [importKind, setImportKind] = useState<ImportKind>('date');

  const [items, setItems] = useState<ParsedLesson[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleParse() {
    setParseMsg('');
    setOkMsg('');
    setErrorMsg('');
    setItems([]);
    setErrors([]);
    setConflicts([]);

    if (!file) {
      setParseMsg('Выберите файл .xlsx.');
      return;
    }

    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      let result: ParseResult;
      if (importKind === 'semester') {
        // Семестр: читаем ВСЕ листы книги — каждый лист это день/шаблон.
        const sheets = wb.SheetNames.map((name) => ({
          name,
          rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
            header: 1,
            defval: '',
            blankrows: true,
          }),
        }));
        result = parseSemesterWorkbook(sheets);
      } else {
        // Замены на дату: только первый лист.
        const ws = wb.Sheets[wb.SheetNames[0]];
        result = parseScheduleMatrix(
          XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: '',
            blankrows: true,
          })
        );
      }
      setItems(result.items);
      setErrors(result.errors);
      setConflicts(result.conflicts);
      setFileName(file.name);
      if (result.items.length === 0) {
        setParseMsg('Не удалось распознать ни одной строки. Проверьте формат файла.');
      }
    } catch {
      setParseMsg('Не удалось прочитать файл. Убедитесь, что это корректный .xlsx.');
    } finally {
      setParsing(false);
    }
  }

  async function handlePublish() {
    setErrorMsg('');
    setOkMsg('');

    if (importKind === 'date' && !date) {
      setErrorMsg('Укажите дату расписания.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Сначала разберите файл — нечего публиковать.');
      return;
    }

    setPublishing(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? '';

    try {
      if (importKind === 'semester') {
        // Семестр: недельный шаблон (date = null) — заменяем целиком.
        const { error: delErr } = await supabase
          .from('schedule_rows')
          .delete()
          .is('date', null);
        if (delErr) throw new Error('Не удалось удалить старый недельный шаблон.');

        const payload = items.map((it) => ({
          date: null,
          week_type: weekType,
          day_week: it.day_week,
          lesson: it.lesson,
          group_name: it.group_name,
          subject: it.subject,
          teacher: it.teacher || null,
          cabinet: it.cabinet || null,
        }));

        const { error: insErr } = await supabase
          .from('schedule_rows')
          .insert(payload);
        if (insErr) throw new Error('Не удалось записать недельный шаблон.');

        const { error: logErr } = await supabase.from('replacement_files').insert({
          file_name: fileName,
          rows_ok: items.length,
          rows_err: errors.length,
          uploaded_by: userId,
        });
        if (logErr) throw new Error('Шаблон записан, но журнал импорта не сохранился.');

        setOkMsg(
          `Опубликовано строк шаблона: ${items.length} (${weekType}). Ошибок разбора: ${errors.length}.`
        );
      } else {
        // Режим «заменить»: сначала удаляем существующие строки за дату + тип недели.
        if (mode === 'replace') {
          const { error: delErr } = await supabase
            .from('schedule_rows')
            .delete()
            .eq('date', date)
            .eq('week_type', weekType);
          if (delErr) throw new Error('Не удалось удалить старые строки расписания.');
        }

        const payload = items.map((it) => ({
          date,
          week_type: weekType,
          day_week: it.day_week,
          lesson: it.lesson,
          group_name: it.group_name,
          subject: it.subject,
          teacher: it.teacher || null,
          cabinet: it.cabinet || null,
        }));

        const { error: insErr } = await supabase
          .from('schedule_rows')
          .insert(payload);
        if (insErr) throw new Error('Не удалось записать строки расписания.');

        // Живые замены: пересобираем replacements за выбранную дату.
        const { error: repDelErr } = await supabase
          .from('replacements')
          .delete()
          .eq('r_date', date);
        if (repDelErr) throw new Error('Не удалось обновить замены за дату.');

        const repPayload = items.map((it) => ({
          r_date: date,
          group_name: it.group_name,
          lesson: it.lesson,
          subject: it.subject,
          teacher: it.teacher || null,
          cabinet: it.cabinet || null,
          change_type: 'замена',
          note: '',
        }));
        const { error: repInsErr } = await supabase
          .from('replacements')
          .insert(repPayload);
        if (repInsErr) throw new Error('Не удалось записать замены.');

        const { error: logErr } = await supabase.from('replacement_files').insert({
          file_name: fileName,
          rows_ok: items.length,
          rows_err: errors.length,
          uploaded_by: userId,
        });
        if (logErr) throw new Error('Расписание записано, но журнал импорта не сохранился.');

        setOkMsg(
          `Опубликовано строк: ${items.length} (${weekType}, ${date}). Ошибок разбора: ${errors.length}.`
        );
      }
      setItems([]);
      setErrors([]);
      setConflicts([]);
      setFile(null);
      setFileName('');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Неизвестная ошибка публикации.');
    } finally {
      setPublishing(false);
    }
  }

  const groups = Array.from(new Set(items.map((i) => i.group_name))).sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
  const teachers = Array.from(new Set(items.map((i) => i.teacher).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, 'ru')
  );

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Админ', href: '/admin' }, { label: 'Импорт расписания' }]} />

      <div className="card p-4 sm:p-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Импорт расписания</h1>
        <p className="mt-1 text-sm text-slate-500">
          Загрузите матрицу расписания в .xlsx. Сначала разберите файл и проверьте
          предпросмотр, затем публикуйте.
        </p>

        <fieldset className="mt-4">
          <legend className="label">Тип загрузки</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="imp-kind"
                checked={importKind === 'date'}
                onChange={() => {
                  setImportKind('date');
                  setItems([]);
                  setErrors([]);
                  setConflicts([]);
                }}
              />
              Замены на дату
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="imp-kind"
                checked={importKind === 'semester'}
                onChange={() => {
                  setImportKind('semester');
                  setItems([]);
                  setErrors([]);
                  setConflicts([]);
                }}
              />
              Семестр (недельный шаблон)
            </label>
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="imp-file" className="label">
              Файл .xlsx
            </label>
            <input
              id="imp-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700"
            />
          </div>
          {importKind === 'date' && (
            <div>
              <label htmlFor="imp-date" className="label">
                Дата расписания
              </label>
              <input
                id="imp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </div>
          )}
          <div>
            <label htmlFor="imp-week" className="label">
              Тип недели
            </label>
            <select
              id="imp-week"
              value={weekType}
              onChange={(e) => setWeekType(e.target.value as 'числитель' | 'знаменатель')}
              className="input"
            >
              <option value="числитель">Числитель</option>
              <option value="знаменатель">Знаменатель</option>
            </select>
          </div>
          <fieldset>
            <legend className="label">Режим публикации</legend>
            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imp-mode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                />
                Добавить к существующим строкам
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imp-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                Заменить все строки за эту дату и тип недели
              </label>
            </div>
          </fieldset>
        </div>

        {parseMsg && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {parseMsg}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !file}
            className="btn btn-primary"
          >
            {parsing ? 'Разбираем…' : 'Разобрать файл'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || items.length === 0 || (importKind === 'date' && !date)}
            className="btn btn-primary"
          >
            {publishing ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>

        {okMsg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {okMsg}
          </p>
        )}
        {errorMsg && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMsg}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="card p-4 sm:p-5">
          <h2 className="text-lg font-bold text-slate-900">Предпросмотр</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">{items.length}</p>
              <p className="text-xs text-slate-500">распознанных строк</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-amber-600">{errors.length}</p>
              <p className="text-xs text-slate-500">ошибок разбора</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-extrabold text-rose-600">{conflicts.length}</p>
              <p className="text-xs text-slate-500">конфликтов значений</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Группы ({groups.length})
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {groups.length ? groups.join(', ') : '—'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Преподаватели ({teachers.length})
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {teachers.length ? teachers.join(', ') : '—'}
              </p>
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-rose-700">Конфликты</h3>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-700">
                {conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-500">
                Строки с конфликтами не публикуются — разрешите их в исходном файле.
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-amber-700">Ошибки разбора</h3>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-700">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-500">
                Ошибочные строки пропущены и не будут опубликованы.
              </p>
            </div>
          )}

          <h3 className="mt-4 text-sm font-bold text-slate-900">
            Примеры распознанных строк
          </h3>
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5">День</th>
                  <th className="px-2 py-1.5">Пара</th>
                  <th className="px-2 py-1.5">Группа</th>
                  <th className="px-2 py-1.5">Предмет</th>
                  <th className="px-2 py-1.5">Преподаватель</th>
                  <th className="px-2 py-1.5">Кабинет</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 15).map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-2 py-1.5">{it.day_week}</td>
                    <td className="px-2 py-1.5">{it.lesson}</td>
                    <td className="px-2 py-1.5">{it.group_name}</td>
                    <td className="px-2 py-1.5">{it.subject}</td>
                    <td className="px-2 py-1.5">{it.teacher || '—'}</td>
                    <td className="px-2 py-1.5">{it.cabinet || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 15 && (
            <p className="mt-1 text-xs text-slate-500">
              Показаны первые 15 из {items.length} строк — публикуются все.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
