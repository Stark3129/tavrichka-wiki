// Утилиты общего назначения tavrichka-wiki.

/**
 * Форматирует дату в строку вида ДД.ММ.ГГГГ.
 * Принимает Date, строку "ГГГГ-ММ-ДД" или полный ISO-формат.
 * Даты без времени парсит вручную — без сдвига из-за часового пояса.
 * Возвращает пустую строку, если дату распознать не удалось.
 */
export function formatDate(input: Date | string): string {
  if (typeof input === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (dateOnly) {
      return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatDate(parsed);
  }

  if (Number.isNaN(input.getTime())) return '';

  const dd = String(input.getDate()).padStart(2, '0');
  const mm = String(input.getMonth() + 1).padStart(2, '0');
  const yyyy = String(input.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
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
