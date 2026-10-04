export interface FileMetadata {
  date: string | null; // 'YYYY-MM-DD' или null
  dayOfWeek: string | null; // 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', ... или null
  weekType: 'числитель' | 'знаменатель' | null;
  loadType: 'replacements' | 'semester';
  publishMode: 'append' | 'replace'; // по умолчанию 'replace' для замен, 'replace' для семестра
  raw: string; // исходное имя файла
}

const DAY_KEYWORDS: Record<string, string> = {
  ПОНЕДЕЛЬНИК: 'ПОНЕДЕЛЬНИК',
  ВТОРНИК: 'ВТОРНИК',
  СРЕДА: 'СРЕДА',
  ЧЕТВЕРГ: 'ЧЕТВЕРГ',
  ПЯТНИЦА: 'ПЯТНИЦА',
  СУББОТА: 'СУББОТА',
  ПН: 'ПОНЕДЕЛЬНИК',
  ВТ: 'ВТОРНИК',
  СР: 'СРЕДА',
  ЧТ: 'ЧЕТВЕРГ',
  ПТ: 'ПЯТНИЦА',
  СБ: 'СУББОТА',
};

/**
 * Парсер метаданных из имени файла расписания или замен.
 * Поддерживает форматы:
 * - 24.09.2024_ВТ_ЗНАМЕНАТЕЛЬ.xlsx
 * - 25.09.2024_СРЕДА_ЗНАМ.xlsx
 * - 28.09.2024_СУББОТА_ЧИСЛИТЕЛЬ.xlsx
 * - расписание_1_семестр_2024-2025.xlsx
 * - замены_05.10.2026.xlsx
 */
export function parseReplacementFileName(fileName: string): FileMetadata {
  const upper = fileName.toUpperCase();
  const lower = fileName.toLowerCase();

  // 1. Поиск даты: DD.MM.YYYY, DD.MM.YY, DD_MM_YYYY или DD.MM
  let date: string | null = null;
  const fullDateMatch = fileName.match(/(\d{1,2})[._](\d{1,2})[._](\d{2,4})/);
  if (fullDateMatch) {
    const day = fullDateMatch[1].padStart(2, '0');
    const month = fullDateMatch[2].padStart(2, '0');
    let year = fullDateMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    date = `${year}-${month}-${day}`;
  } else {
    const shortDateMatch = fileName.match(/(\d{1,2})[._](\d{1,2})/);
    if (shortDateMatch) {
      const day = shortDateMatch[1].padStart(2, '0');
      const month = shortDateMatch[2].padStart(2, '0');
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const year = parseInt(month, 10) >= 8 && currentMonth < 8 ? currentYear - 1 : currentYear;
      date = `${year}-${month}-${day}`;
    }
  }

  // 2. День недели
  let dayOfWeek: string | null = null;
  // Сначала проверяем полные названия, затем сокращения с границами слов/знаков
  const fullDays = ['ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];
  for (const day of fullDays) {
    if (upper.includes(day)) {
      dayOfWeek = day;
      break;
    }
  }
  if (!dayOfWeek) {
    const shortDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    for (const short of shortDays) {
      // Ищем short окружённый не-буквами (например _ВТ_, .ВТ., пробелы, начало/конец)
      const re = new RegExp(`(?:[^А-ЯЁA-Z]|^)${short}(?:[^А-ЯЁA-Z]|$)`, 'i');
      if (re.test(upper)) {
        dayOfWeek = DAY_KEYWORDS[short] ?? null;
        break;
      }
    }
  }

  // 3. Тип недели
  let weekType: 'числитель' | 'знаменатель' | null = null;
  if (lower.includes('числитель') || lower.includes('числ')) {
    weekType = 'числитель';
  } else if (lower.includes('знаменатель') || lower.includes('знам')) {
    weekType = 'знаменатель';
  }

  // 4. Тип загрузки
  let loadType: 'replacements' | 'semester' = 'replacements';
  if (
    lower.includes('семестр') ||
    lower.includes('базовое') ||
    lower.includes('основное') ||
    lower.includes('semester')
  ) {
    loadType = 'semester';
  } else if (date || lower.includes('замен') || lower.includes('replacement')) {
    loadType = 'replacements';
  }

  // 5. Режим публикации: по умолчанию 'replace'
  const publishMode: 'append' | 'replace' = 'replace';

  return {
    date,
    dayOfWeek,
    weekType,
    loadType,
    publishMode,
    raw: fileName,
  };
}
