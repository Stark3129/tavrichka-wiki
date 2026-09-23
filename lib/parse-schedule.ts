// Парсер матрицы расписания из Excel (SheetJS, sheet_to_json с header:1).
// Ожидается лист вида: служебные строки сверху, строка-заголовок
// «Дни недели | пара | <группа> | Ауд. | <группа> | Ауд. …», затем строки данных.

export interface ParsedLesson {
  day_week: string;
  lesson: number;
  group_name: string;
  subject: string;
  teacher: string;
  cabinet: string;
}

export interface ParseResult {
  items: ParsedLesson[];
  errors: string[];
  conflicts: string[];
}

interface Acc {
  subject: string;
  teachers: string;
  cabinets: string;
  conflict: boolean;
}

interface GroupCol {
  name: string;
  subjectCol: number;
  cabinetCol: number; // -1, если колонки «Ауд.» нет
}

const SERVICE_MARKERS = ['1 курс', 'расписание', 'утверждаю'];

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\u00A0/g, ' ').trim();
}

/** Непустые строки ячейки (предмет/преподаватели/кабинеты пишутся построчно). */
function cellLines(v: unknown): string[] {
  return cellText(v)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAudMarker(t: string): boolean {
  return /^ауд/i.test(t);
}

export function parseScheduleMatrix(rows: unknown[][]): ParseResult {
  const errors: string[] = [];
  const conflicts: string[] = [];
  const items: ParsedLesson[] = [];

  // 1. Ищем строку-заголовок по ячейкам «Дни недели» и «пара»,
  //    пропуская служебные строки сверху.
  let headerIdx = -1;
  let dayCol = -1;
  let lessonCol = -1;
  for (let i = 0; i < rows.length; i++) {
    const texts = (rows[i] ?? []).map(cellText);
    const joined = texts.join(' ').toLowerCase();
    if (SERVICE_MARKERS.some((m) => joined.includes(m))) continue;
    const d = texts.findIndex((t) => /дни\s*недели/i.test(t));
    const l = texts.findIndex((t) => /^пара/i.test(t));
    if (d !== -1 && l !== -1) {
      headerIdx = i;
      dayCol = d;
      lessonCol = l;
      break;
    }
  }

  if (headerIdx === -1 || dayCol === -1 || lessonCol === -1) {
    errors.push('Не найдена строка-заголовок («Дни недели» и «пара»).');
    return { items, errors, conflicts };
  }

  // 2. Колонки групп: пары <имя группы> | «Ауд.»
  const headerCells = (rows[headerIdx] ?? []).map(cellText);
  const groups: GroupCol[] = [];
  for (let c = lessonCol + 1; c < headerCells.length; c++) {
    const cur = headerCells[c];
    if (!cur) continue;
    if (isAudMarker(cur)) {
      const last = groups[groups.length - 1];
      if (last && last.cabinetCol === -1) {
        last.cabinetCol = c;
      } else {
        errors.push(`Пустое имя группы в заголовке (столбец ${c + 1}).`);
      }
      continue;
    }
    const next = headerCells[c + 1] ?? '';
    if (isAudMarker(next)) {
      groups.push({ name: cur, subjectCol: c, cabinetCol: c + 1 });
      c++; // колонку «Ауд.» уже учли
    } else {
      groups.push({ name: cur, subjectCol: c, cabinetCol: -1 });
      errors.push(`У группы «${cur}» нет колонки «Ауд.» в заголовке.`);
    }
  }

  const usable = groups.filter((g) => g.name && g.cabinetCol !== -1);

  // 3. Строки данных.
  const acc = new Map<string, Acc>();
  let lastDay = '';
  let lastLesson = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const dayRaw = cellText(row[dayCol]);
    const lessonRaw = cellText(row[lessonCol]);

    const hasContent = usable.some(
      (g) => cellText(row[g.subjectCol]) || cellText(row[g.cabinetCol])
    );
    if (!dayRaw && !lessonRaw && !hasContent) continue; // пустая или мусорная строка

    // Объединённые ячейки: пустые день/пара наследуем от предыдущей строки данных.
    const day = dayRaw || lastDay;
    let lesson = lastLesson;
    if (lessonRaw) {
      if (!/^\d+$/.test(lessonRaw)) {
        errors.push(`Нечисловой номер пары: «${lessonRaw}» (строка ${i + 1}).`);
        continue;
      }
      lesson = Number(lessonRaw);
    } else if (!hasContent) {
      continue;
    }
    if (!day) continue; // день так и не определился — строку не атрибуцируем
    if (!lesson) continue;

    lastDay = day;
    lastLesson = lesson;

    for (const g of usable) {
      const subjLines = cellLines(row[g.subjectCol]);
      const cabLines = cellLines(row[g.cabinetCol]);
      if (subjLines.length === 0 && cabLines.length === 0) continue;

      if (subjLines.length === 0) {
        errors.push(
          `Пустой предмет при непустой аудитории: группа «${g.name}» (строка ${i + 1}).`
        );
        continue;
      }

      const subject = subjLines[0];
      const teachers = subjLines.slice(1); // первая строка — предмет, остальные — преподаватели
      const teachersStr = teachers.join('\n');
      const cabinetsStr = cabLines.join('\n');

      const key = `${day}|${lesson}|${g.name}`;
      const prev = acc.get(key);
      if (!prev) {
        acc.set(key, {
          subject,
          teachers: teachersStr,
          cabinets: cabinetsStr,
          conflict: false,
        });
        continue;
      }

      // Дубли из объединённых ячеек: первое непустое значение; расхождение → conflict.
      if (subject && prev.subject && subject !== prev.subject) {
        conflicts.push(`${day}, пара ${lesson}, группа ${g.name}: ${prev.subject} | ${subject}`);
        prev.conflict = true;
      } else if (subject && !prev.subject) {
        prev.subject = subject;
      }

      if (teachersStr && prev.teachers && teachersStr !== prev.teachers) {
        conflicts.push(
          `${day}, пара ${lesson}, группа ${g.name}: ${prev.teachers.replace(/\n/g, ' / ')} | ${teachersStr.replace(/\n/g, ' / ')}`
        );
        prev.conflict = true;
      } else if (teachersStr && !prev.teachers) {
        prev.teachers = teachersStr;
      }

      if (cabinetsStr && prev.cabinets && cabinetsStr !== prev.cabinets) {
        conflicts.push(
          `${day}, пара ${lesson}, группа ${g.name}: ${prev.cabinets.replace(/\n/g, ' / ')} | ${cabinetsStr.replace(/\n/g, ' / ')}`
        );
        prev.conflict = true;
      } else if (cabinetsStr && !prev.cabinets) {
        prev.cabinets = cabinetsStr;
      }
    }
  }

  // 4. Разворачиваем накопленное в строки «одна строка на пару (преподаватель, кабинет)».
  for (const [key, a] of acc) {
    if (a.conflict) continue;
    const [day, lessonStr, groupName] = key.split('|');
    const lesson = Number(lessonStr);
    const teachers = a.teachers ? a.teachers.split('\n') : [];
    const cabinets = a.cabinets ? a.cabinets.split('\n') : [];

    // Равное количество — сопоставление по позиции; иначе сопоставляем что можно,
    // остальным достаётся пустая строка (null).
    const pairCount = Math.max(teachers.length, cabinets.length);
    if (pairCount === 0) {
      items.push({
        day_week: day,
        lesson,
        group_name: groupName,
        subject: a.subject,
        teacher: '',
        cabinet: '',
      });
      continue;
    }
    for (let i = 0; i < pairCount; i++) {
      items.push({
        day_week: day,
        lesson,
        group_name: groupName,
        subject: a.subject,
        teacher: teachers[i] ?? '',
        cabinet: cabinets[i] ?? '',
      });
    }
  }

  return { items, errors, conflicts };
}

export interface SemesterSheet {
  name: string;
  rows: unknown[][];
}

/**
 * Разбор книги семестрового расписания: каждый лист — недельный шаблон.
 * К каждому листу применяются те же правила матрицы (parseScheduleMatrix):
 * заголовок по «Дни недели»/«пара», пары колонок группа + «Ауд.»,
 * дубли из объединённых ячеек (первое непустое значение), расхождения → conflicts.
 * Служебные строки («Утверждаю», «Согласовано», пустой день недели) пропускаются
 * внутри parseScheduleMatrix. Ошибки и конфликты помечаются именем листа;
 * листы без распознанной матрицы пропускаются молча.
 */
export function parseSemesterWorkbook(sheets: SemesterSheet[]): ParseResult {
  const items: ParsedLesson[] = [];
  const errors: string[] = [];
  const conflicts: string[] = [];

  for (const sheet of sheets) {
    const res = parseScheduleMatrix(sheet.rows);

    // Лист вообще не является матрицей расписания — не шумим ошибкой.
    if (
      res.items.length === 0 &&
      res.errors.length === 1 &&
      res.errors[0].startsWith('Не найдена строка-заголовок')
    ) {
      continue;
    }

    for (const e of res.errors) errors.push(`Лист «${sheet.name}»: ${e}`);
    for (const c of res.conflicts) conflicts.push(`Лист «${sheet.name}»: ${c}`);
    items.push(...res.items);
  }

  return { items, errors, conflicts };
}
