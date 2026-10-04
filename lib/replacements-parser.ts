import ExcelJS from 'exceljs';

/**
 * Маппинг цветов ячеек Excel для классификации замен:
 * - YELLOW (FFFFFF00) — постоянное изменение расписания (действует до конца года или до следующего изменения)
 * - GREEN (FF92D050) — разовая замена на конкретный день
 */
export const COLOR_MAP = {
  // Стандартный чистый желтый цвет Excel / Microsoft Office (RGB 255, 255, 0)
  YELLOW: 'FFFFFF00',
  // Стандартный салатовый/зеленый цвет Excel / Microsoft Office (RGB 146, 208, 80)
  GREEN: 'FF92D050',
} as const;

export type ReplacementType = 'замена' | 'отмена' | 'permanent';

export interface ParsedReplacementRow {
  date: string;
  week_type: 'числитель' | 'знаменатель';
  day_week: string;
  lesson: number;
  group_name: string;
  subject: string;
  teacher: string;
  cabinet: string;
  note: string;
  type: ReplacementType;
  color?: string | null;
}

export interface ReplacementParseResult {
  rows: ParsedReplacementRow[];
  replacementsCount: number;
  permanentCount: number;
  cancellationsCount: number;
  skippedCount: number;
  errors: string[];
  colorsRead: boolean;
  date: string;
  weekType: 'числитель' | 'знаменатель';
}

function getCellText(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell) return '';
  try {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('richText' in val && Array.isArray(val.richText)) {
        return val.richText.map((t) => t.text).join('');
      }
      if ('text' in val && val.text !== undefined && val.text !== null) {
        return String(val.text);
      }
      if ('result' in val && val.result !== undefined && val.result !== null) {
        return String(val.result);
      }
      if (cell.master && cell.master !== cell) {
        return getCellText(cell.master);
      }
    }
    return String(val);
  } catch {
    return '';
  }
}

function getFillColor(cell: ExcelJS.Cell | null | undefined): string | null {
  if (!cell) return null;
  const fill = cell.fill || cell.master?.fill;
  if (!fill || fill.type !== 'pattern' || fill.pattern === 'none') return null;
  const fg = fill.fgColor;
  if (fg && typeof fg === 'object' && 'argb' in fg && fg.argb) {
    return String(fg.argb).toUpperCase();
  }
  const bg = fill.bgColor;
  if (bg && typeof bg === 'object' && 'argb' in bg && bg.argb) {
    return String(bg.argb).toUpperCase();
  }
  return null;
}

export function isYellow(argb: string | null | undefined): boolean {
  if (!argb) return false;
  const u = argb.toUpperCase();
  return u === 'FFFFFF00' || u.endsWith('FFFF00') || u === 'FFFFE599';
}

export function isGreen(argb: string | null | undefined): boolean {
  if (!argb) return false;
  const u = argb.toUpperCase();
  return u === 'FF92D050' || u === 'FF00FF00' || u === 'FFA9D08E';
}

export function parseCellContent(text: string): {
  subject: string;
  teacher: string;
  note: string;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { subject: '', teacher: '', note: '' };

  let note = '';
  const filteredLines: string[] = [];
  for (const l of lines) {
    if (/\(обе подгруппы\)/i.test(l)) {
      note = '(обе подгруппы)';
      const cleaned = l.replace(/\(обе подгруппы\)/gi, '').trim();
      if (cleaned) filteredLines.push(cleaned);
    } else {
      filteredLines.push(l);
    }
  }

  const subject = filteredLines[0] ?? '';
  const teacher = filteredLines.slice(1).join(', ');
  return { subject, teacher, note };
}

/**
 * Извлекает дату расписания и тип недели из имени файла:
 * "замены 25.09 (ЗНАМЕНАТЕЛЬ).xlsx" -> { date: "2026-09-25", weekType: "знаменатель" }
 * Учебный год: если месяц 8..12 — текущий календарный год, если 1..7 — прошлый календарный год.
 */
export function parseMetaFromFileName(fileName: string): {
  date: string | null;
  weekType: 'числитель' | 'знаменатель' | null;
} {
  let weekType: 'числитель' | 'знаменатель' | null = null;
  if (/знаменатель/i.test(fileName)) weekType = 'знаменатель';
  else if (/числитель/i.test(fileName)) weekType = 'числитель';

  const match = fileName.match(/(\d{1,2})[._](\d{1,2})/);
  if (!match) return { date: null, weekType };

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const monthNum = Number(month);

  const now = new Date();
  const curYear = now.getFullYear();
  const year = monthNum >= 8 ? curYear : curYear - 1;

  return {
    date: `${year}-${month}-${day}`,
    weekType,
  };
}

interface GroupCol {
  name: string;
  subjCol: number;
  audCol: number;
}

/**
 * Умный разбор книги замен ExcelJS с распознаванием заливок ячеек и трех типов изменений.
 */
export async function parseReplacementsWorkbook(
  buffer: ArrayBuffer | Buffer,
  options?: {
    fileName?: string;
    date?: string;
    weekType?: 'числитель' | 'знаменатель';
  }
): Promise<ReplacementParseResult> {
  const errors: string[] = [];

  const meta = options?.fileName ? parseMetaFromFileName(options.fileName) : { date: null, weekType: null };
  const targetDate = options?.date || meta.date || new Date().toISOString().slice(0, 10);
  const targetWeekType = options?.weekType || meta.weekType || 'знаменатель';

  const workbook = new ExcelJS.Workbook();
  const rawBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer) ? buffer : buffer;
  await workbook.xlsx.load(rawBuffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      rows: [],
      replacementsCount: 0,
      permanentCount: 0,
      cancellationsCount: 0,
      skippedCount: 0,
      errors: ['Файл не содержит листов.'],
      colorsRead: false,
      date: targetDate,
      weekType: targetWeekType,
    };
  }

  // 1. Поиск строки-заголовка («Дни недели» и «пара»)
  let headerRowIdx = -1;
  let dayColIdx = -1;
  let lessonColIdx = -1;
  const groups: GroupCol[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (headerRowIdx !== -1) return;
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber] = getCellText(cell).trim();
    });
    const joined = values.join(' ').toLowerCase();
    if (joined.includes('дни недели') && joined.includes('пара')) {
      headerRowIdx = rowNumber;
      dayColIdx = values.findIndex((v) => /дни\s*недели/i.test(v));
      lessonColIdx = values.findIndex((v) => /^пара/i.test(v));

      for (let c = lessonColIdx + 1; c < values.length; c++) {
        const val = values[c];
        if (val && !/^ауд/i.test(val)) {
          const next = values[c + 1] ?? '';
          const audCol = /^ауд/i.test(next) ? c + 1 : -1;
          groups.push({ name: val, subjCol: c, audCol });
          if (audCol !== -1) c++;
        }
      }
    }
  });

  if (headerRowIdx === -1 || dayColIdx === -1 || lessonColIdx === -1 || groups.length === 0) {
    return {
      rows: [],
      replacementsCount: 0,
      permanentCount: 0,
      cancellationsCount: 0,
      skippedCount: 0,
      errors: ['Не найдена строка-заголовок («Дни недели» и «пара») с группами.'],
      colorsRead: false,
      date: targetDate,
      weekType: targetWeekType,
    };
  }

  // 2. Сбор строк данных и наследование объединенных ячеек дня и пары
  interface RowData {
    rowNumber: number;
    day: string;
    lesson: string;
    row: ExcelJS.Row;
  }
  const rowsData: RowData[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return;
    const day = getCellText(row.getCell(dayColIdx)).trim();
    const lesson = getCellText(row.getCell(lessonColIdx)).trim();
    rowsData.push({ rowNumber, day, lesson, row });
  });

  let curDay = '';
  let curLesson = '';
  for (const r of rowsData) {
    if (r.day) curDay = r.day;
    else r.day = curDay;

    if (r.lesson) curLesson = r.lesson;
    else r.lesson = curLesson;
  }

  let totalColorsFound = 0;
  const parsedItems: ParsedReplacementRow[] = [];
  let skippedWhite = 0;

  // 3. Попарная обработка строк (base, actual)
  for (let i = 0; i < rowsData.length; i += 2) {
    const baseRow = rowsData[i];
    const actRow = rowsData[i + 1];
    if (!actRow) continue;

    const day = baseRow.day;
    const lessonNum = Number(baseRow.lesson);
    if (!lessonNum || isNaN(lessonNum)) continue;

    for (const g of groups) {
      const cBase = baseRow.row.getCell(g.subjCol);
      const cAct = actRow.row.getCell(g.subjCol);

      const audBase = g.audCol !== -1 ? getCellText(baseRow.row.getCell(g.audCol)).trim() : '';
      const audAct = g.audCol !== -1 ? getCellText(actRow.row.getCell(g.audCol)).trim() : '';

      const baseText = getCellText(cBase).trim();
      const actText = getCellText(cAct).trim();

      const baseFill = getFillColor(cBase);
      const actFill = getFillColor(cAct);

      if (baseFill || actFill) totalColorsFound++;

      // Проверка вертикального объединения ячеек base и actual
      const isMergedAcrossPair =
        Boolean(cBase.isMerged) &&
        Boolean(cAct.isMerged) &&
        (cBase.master?.address === cAct.master?.address || cBase.address === cAct.master?.address);

      // Обе ячейки пустые и без заливки
      if (!baseText && !actText && !baseFill && !actFill && !audBase && !audAct) {
        continue;
      }

      // Случай А: Ячейки объединены между base и actual
      if (isMergedAcrossPair) {
        const fill = actFill || baseFill;
        const text = actText || baseText;
        const aud = audAct || audBase;

        if (isYellow(fill)) {
          if (text) {
            const p = parseCellContent(text);
            parsedItems.push({
              date: targetDate,
              week_type: targetWeekType,
              day_week: day,
              lesson: lessonNum,
              group_name: g.name,
              subject: p.subject,
              teacher: p.teacher,
              cabinet: aud,
              note: p.note,
              type: 'permanent',
              color: fill,
            });
          } else {
            parsedItems.push({
              date: targetDate,
              week_type: targetWeekType,
              day_week: day,
              lesson: lessonNum,
              group_name: g.name,
              subject: '',
              teacher: '',
              cabinet: '',
              note: '',
              type: 'отмена',
              color: fill,
            });
          }
        } else if (isGreen(fill)) {
          if (text) {
            const p = parseCellContent(text);
            parsedItems.push({
              date: targetDate,
              week_type: targetWeekType,
              day_week: day,
              lesson: lessonNum,
              group_name: g.name,
              subject: p.subject,
              teacher: p.teacher,
              cabinet: aud,
              note: p.note,
              type: 'замена',
              color: fill,
            });
          } else {
            parsedItems.push({
              date: targetDate,
              week_type: targetWeekType,
              day_week: day,
              lesson: lessonNum,
              group_name: g.name,
              subject: '',
              teacher: '',
              cabinet: '',
              note: '',
              type: 'отмена',
              color: fill,
            });
          }
        } else {
          // Белая объединенная ячейка — пара из базового расписания без замен
          skippedWhite++;
        }
        continue;
      }

      // Случай Б: Ячейки НЕ объединены (base = строка 1, actual = строка 2)
      const isSameTextAndAud = baseText === actText && audBase === audAct;

      if (isSameTextAndAud && !actFill && !baseFill) {
        // Одинаковые белые ячейки — базовое расписание, пропускаем
        skippedWhite++;
        continue;
      }

      // 1. actual пустая (или без предмета) при непустой base -> отмена
      if (baseText && !actText) {
        const baseParsed = parseCellContent(baseText);
        parsedItems.push({
          date: targetDate,
          week_type: targetWeekType,
          day_week: day,
          lesson: lessonNum,
          group_name: g.name,
          subject: baseParsed.subject, // сохраняем предмет отменяемой базовой пары
          teacher: '',
          cabinet: '',
          note: '',
          type: 'отмена',
          color: actFill,
        });
        continue;
      }

      // 2. base пустая при непустой actual -> добавленная пара
      if (!baseText && actText) {
        const p = parseCellContent(actText);
        const itemType: ReplacementType = isYellow(actFill) ? 'permanent' : 'замена';
        parsedItems.push({
          date: targetDate,
          week_type: targetWeekType,
          day_week: day,
          lesson: lessonNum,
          group_name: g.name,
          subject: p.subject,
          teacher: p.teacher,
          cabinet: audAct,
          note: p.note,
          type: itemType,
          color: actFill,
        });
        continue;
      }

      // 3. Обе непустые и разные (или с заливкой)
      const p = parseCellContent(actText);
      const itemType: ReplacementType = isYellow(actFill) ? 'permanent' : 'замена';
      parsedItems.push({
        date: targetDate,
        week_type: targetWeekType,
        day_week: day,
        lesson: lessonNum,
        group_name: g.name,
        subject: p.subject,
        teacher: p.teacher,
        cabinet: audAct,
        note: p.note,
        type: itemType,
        color: actFill,
      });
    }
  }

  const replacementsCount = parsedItems.filter((i) => i.type === 'замена').length;
  const permanentCount = parsedItems.filter((i) => i.type === 'permanent').length;
  const cancellationsCount = parsedItems.filter((i) => i.type === 'отмена').length;

  return {
    rows: parsedItems,
    replacementsCount,
    permanentCount,
    cancellationsCount,
    skippedCount: skippedWhite,
    errors,
    colorsRead: totalColorsFound > 0,
    date: targetDate,
    weekType: targetWeekType,
  };
}
