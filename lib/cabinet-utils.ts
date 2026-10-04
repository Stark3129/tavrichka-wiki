/**
 * Утилиты для работы с кабинетами и маппинга на корпус и этаж.
 */

/**
 * Определяет номер корпуса по названию кабинета:
 * - если cabinet начинается с "жд" → корпус 2 (ЖД-корпус)
 * - если cabinet начинается с цифры 1.x, 2.x, 3.x, 4.x, 5.x, 6.x → корпус 1
 * - если cabinet === "с/з" или "а/з" → null (нет схемы корпуса)
 * - иначе парсинг первой цифры (по умолчанию 1)
 */
export function getCorpusFromCabinet(cabinet: string | null | undefined): number | null {
  if (!cabinet) return null;
  const clean = cabinet.trim().toLowerCase();
  if (clean === 'с/з' || clean === 'а/з') return null;
  if (clean.startsWith('жд')) return 2;
  if (/^[1-6]\./.test(clean)) return 1;
  const firstDigit = clean.match(/\d/);
  if (firstDigit) {
    const d = parseInt(firstDigit[0], 10);
    return d === 2 ? 2 : 1;
  }
  return 1;
}

/**
 * Извлекает номер этажа из кабинета:
 * - для "с/з" → null, для "а/з" → null
 * - для жд15 → 1 этаж (первая цифра номера)
 * - для кабинетов вида X.Y (1.2 → 2 этаж, 6.4 → 4 этаж, 5.5 → 5 этаж)
 */
export function getFloorFromCabinet(cabinet: string | null | undefined): number | null {
  if (!cabinet) return null;
  const clean = cabinet.trim().toLowerCase();
  if (clean === 'с/з' || clean === 'а/з') return null;

  if (clean.startsWith('жд')) {
    const digits = clean.replace(/\D/g, '');
    if (!digits) return null;
    return parseInt(digits[0], 10);
  }

  if (clean.includes('.')) {
    const parts = clean.split('.');
    const after = parseInt(parts[1], 10);
    if (!isNaN(after)) return after;
    const before = parseInt(parts[0], 10);
    if (!isNaN(before)) return before;
  }

  const match = clean.match(/\d+/);
  if (match) return parseInt(match[0][0], 10);
  return null;
}
