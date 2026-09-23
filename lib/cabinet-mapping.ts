/** Нормализация названия кабинета к виду, в котором он записан в schedule_rows.
 * Корпус 2: чисто цифровые кабинеты со схемы («14», «5») получают префикс «жд»
 * («жд14», «жд5»), т.к. в расписании они записаны именно так.
 * Корпус 1: кабинеты вида «5.1», «6.4» остаются как есть.
 * «с/з» и «а/з» остаются без изменений. */
export function normalizeCabinet(cabinet: string, corpus: number): string {
  const c = (cabinet ?? '').trim();
  if (!c) return c;
  if (/^(с\/з|а\/з)$/i.test(c)) return c.toLowerCase();
  if (corpus === 2 && /^\d+$/.test(c)) return `жд${c}`;
  return c;
}