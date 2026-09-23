// Определение корпуса по названию кабинета из расписания.
export function getCorpus(cabinet: string): string {
  if (!cabinet) return 'Не указан';
  const c = cabinet.toLowerCase();
  if (c.startsWith('жд')) return 'ЖД';
  if (c === 'с/з' || c.includes('спорт')) return 'Спортзал';
  if (c === 'а/з' || c.includes('актов')) return 'Актовый зал';
  return 'Корпус 1'; // по умолчанию для числовых кабинетов (5.1, 6.4 и т.д.)
}

/** День недели по-русски с заглавной («Понедельник») — для поиска в day_week. */
export function weekdayRu(iso: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
