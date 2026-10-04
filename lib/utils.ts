// Утилиты общего назначения tavrichka-wiki.

/**
 * Форматирует дату в строку вида ДД.ММ.ГГГГ.
 * Принимает Date, строку "ГГГГ-ММ-ДД" или полный ISO-формат.
 * Даты без времени парсит вручную — без сдвига из-за часового пояса.
 * Возвращает пустую строку, если дату распознать не удалось.
 */
export function formatDate(input: Date | string | null | undefined): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (dateOnly) {
      return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
    }
  }

  const d = typeof input === 'string' ? new Date(input) : input;
  if (!d || Number.isNaN(d.getTime())) return '';

  // Фиксированный часовой пояс Europe/Moscow для полной идентичности SSR и браузера
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Первую букву строки делает заглавной */
export function capitalize(str?: string | null): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Простая склейка CSS-классов (замена clsx без зависимостей).
 * Ложные значения (false, null, undefined, '') пропускаются.
 */
export function cn(
  ...classes: Array<string | number | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ');
}

/** Дедуплицирует список предметов с сохранением регистра первого вхождения. */
export function deduplicateSubjects(subject: string | null | undefined): string {
  if (!subject) return '';
  const parts = subject.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(part);
    }
  }
  return unique.join(', ');
}

/** Проверяет, что строка содержит осмысленное значение (не пустая и не прочерк). */
export function isNonEmpty(val: string | null | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed !== 'null';
}
