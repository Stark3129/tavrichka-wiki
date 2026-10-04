import type { ScheduleRow } from './types';

/**
 * Слияние недельного шаблона (date is null) и замен на дату.
 *
 * Ключ записи — номер пары + нормализованное имя группы (trim, нижний регистр,
 * сжатые пробелы): в шаблоне и в файлах замен имя группы может отличаться
 * регистром или лишними пробелами.
 *
 * Правила:
 *  - 'замена' — перекрывает шаблон в свою дату;
 *  - 'отмена' — удаляет шаблонную пару в дату (в результат не добавляется);
 *  - 'permanent' — перекрывает шаблон для любой целевой даты D, если row.date <= D
 *    и (valid_until is null или valid_until >= D); если permanent-записей по ключу
 *    несколько — берётся последняя по дате;
 *  - Приоритет при конфликте на одну дату+ключ: отмена > замена > permanent > шаблон;
 *  - Добавленные пары (не было в шаблоне) попадают в список;
 *  - Результат отсортирован по номеру пары, затем по имени группы.
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
  targetDate?: string,
): ScheduleRow[] {
  // Если целевая дата не передана явно, пытаемся взять первую дату из датированных строк
  const effectiveDate =
    targetDate ||
    replacementRows.find((r) => r.date && r.type !== 'permanent')?.date ||
    undefined;

  // Группируем строки замен по ключу: пара + группа
  const cancellationsByKey = new Map<string, ScheduleRow[]>();
  const exactReplacementsByKey = new Map<string, ScheduleRow[]>();
  const permanentByKey = new Map<string, ScheduleRow[]>();

  for (const r of replacementRows) {
    const k = rowKey(r.lesson, r.group_name);
    const rowDate = r.date ? r.date.slice(0, 10) : '';

    if (r.type === 'отмена') {
      // Отмена действует на свою дату (или всегда, если дата не указана)
      if (!effectiveDate || !rowDate || rowDate === effectiveDate) {
        if (!cancellationsByKey.has(k)) cancellationsByKey.set(k, []);
        cancellationsByKey.get(k)!.push(r);
      }
    } else if (r.type === 'permanent') {
      // Постоянное изменение действует для любой даты D, если row.date <= D и (valid_until is null или >= D)
      const isAfterStart = !effectiveDate || !rowDate || rowDate <= effectiveDate;
      const validUntilDate = r.valid_until ? r.valid_until.slice(0, 10) : null;
      const isBeforeEnd = !effectiveDate || !validUntilDate || validUntilDate >= effectiveDate;

      if (isAfterStart && isBeforeEnd) {
        if (!permanentByKey.has(k)) permanentByKey.set(k, []);
        permanentByKey.get(k)!.push(r);
      }
    } else {
      // Обычная разовая замена ('замена', 'добавление' или default)
      if (!effectiveDate || !rowDate || rowDate === effectiveDate) {
        if (!exactReplacementsByKey.has(k)) exactReplacementsByKey.set(k, []);
        exactReplacementsByKey.get(k)!.push(r);
      }
    }
  }

  // Ключи, которые должны быть вытеснены из шаблона
  const replacedKeys = new Set<string>(removeKeys);
  const activeReplacements: ScheduleRow[] = [];

  // Собираем все ключи, затронутые заменами
  const allAffectedKeys = new Set<string>([
    ...cancellationsByKey.keys(),
    ...exactReplacementsByKey.keys(),
    ...permanentByKey.keys(),
  ]);

  for (const k of allAffectedKeys) {
    // Приоритет: отмена > замена > permanent > шаблон
    if (cancellationsByKey.has(k)) {
      // 1. Отмена: удаляет пару из шаблона, сама в результат не попадает
      replacedKeys.add(k);
      continue;
    }

    if (exactReplacementsByKey.has(k)) {
      // 2. Разовая замена
      replacedKeys.add(k);
      const rows = exactReplacementsByKey.get(k)!;
      // Дедупликация идентичных строк при повторном импорте
      const seen = new Set<string>();
      for (const r of rows) {
        const sig = `${normGroup(r.subject)}|${normGroup(r.teacher)}|${normGroup(r.cabinet)}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        activeReplacements.push(r);
      }
      continue;
    }

    if (permanentByKey.has(k)) {
      // 3. Постоянное изменение: берём последнюю по дате (date)
      replacedKeys.add(k);
      const rows = permanentByKey.get(k)!;
      rows.sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return da.localeCompare(db);
        return Number(a.id || 0) - Number(b.id || 0);
      });
      const latest = rows[rows.length - 1];
      if (latest) {
        activeReplacements.push(latest);
      }
      continue;
    }
  }

  const merged = [
    ...activeReplacements,
    ...templateRows.filter((r) => !replacedKeys.has(rowKey(r.lesson, r.group_name))),
  ];

  return merged.sort((a, b) => {
    const la = Number(a.lesson);
    const lb = Number(b.lesson);
    if (la !== lb) return la - lb;
    return normGroup(a.group_name).localeCompare(normGroup(b.group_name), 'ru');
  });
}