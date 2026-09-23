/** День недели по-русски с заглавной («Понедельник») — для поиска в day_week. */
export function weekdayRu(iso: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
