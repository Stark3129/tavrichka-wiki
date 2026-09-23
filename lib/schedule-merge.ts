import type { ScheduleRow } from './types';

/**
 * Слияние недельного шаблона (date is null) и замен на дату.
 *
 * Ключ записи — номер пары + нормализованное имя группы (trim, нижний регистр,
 * сжатые пробелы): в шаблоне и в файлах замен имя группы может отличаться
 * регистром или лишними пробелами.
 *
 * Правила:
 *  - замена полностью перекрывает шаблонную пару с тем же ключом;
 *  - дополнительно убираются шаблонные пары из removeKeys (например, пара
 *    группы «увезена» заменой в другой кабинет);
 *  - если замены на пару нет — остаётся шаблонная пара (обе недели: числитель
 *    и знаменатель сохраняются);
 *  - добавленные пары (не было в шаблоне) просто попадают в список;
 *  - дубликатные заменые строки (повторный импорт «добавить») схлопываются;
 *  - результат отсортирован по номеру пары, затем по группе.
 */
export function normGroup(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function rowKey(lesson: number, group: string | null | undefined): string {
  return `${Number(lesson)}|${normGroup(group)}`;
}

export function mergeScheduleRows(
  templateRows: ScheduleRow[],
  replacementRows: ScheduleRow[],
  removeKeys: ReadonlySet<string> = new Set<string>(),
): ScheduleRow[] {
  const replacedKeys = new Set<string>(removeKeys);
  for (const r of replacementRows) {
    replacedKeys.add(rowKey(r.lesson, r.group_name));
  }

  // Схлопываем дубликатные замены от повторного импорта.
  const seen = new Set<string>();
  const uniqueReplacements: ScheduleRow[] = [];
  for (const r of replacementRows) {
    const k = `${rowKey(r.lesson, r.group_name)}|${normGroup(r.subject)}|${normGroup(r.teacher)}|${normGroup(r.cabinet)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueReplacements.push(r);
  }

  const merged = [
    ...uniqueReplacements,
    ...templateRows.filter((r) => !replacedKeys.has(rowKey(r.lesson, r.group_name))),
  ];

  return merged.sort((a, b) => {
    const la = Number(a.lesson);
    const lb = Number(b.lesson);
    if (la !== lb) return la - lb;
    return normGroup(a.group_name).localeCompare(normGroup(b.group_name), 'ru');
  });
}