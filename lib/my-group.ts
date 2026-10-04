// Клиентский хелпер для управления выбранной группой ("Моя группа")

const STORAGE_KEY = 'my-group';
export const MY_GROUP_EVENT = 'my-group-changed';

/** Возвращает сохранённую группу или null */
export function getMyGroup(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

/** Сохраняет или очищает выбранную группу */
export function setMyGroup(group: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = group.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Оповещаем другие компоненты без перезагрузки страницы
    window.dispatchEvent(
      new CustomEvent(MY_GROUP_EVENT, { detail: trimmed || null })
    );
  } catch {
    // игнорируем ошибки доступа к storage
  }
}

/** Подписка на изменение выбранной группы */
export function subscribeMyGroup(
  callback: (group: string | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<string | null>;
    callback(custom.detail ?? getMyGroup());
  };

  window.addEventListener(MY_GROUP_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(MY_GROUP_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
