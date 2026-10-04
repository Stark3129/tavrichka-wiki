import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { parseReplacementsWorkbook } from '../lib/replacements-parser.ts';

function getCellText(cell) {
  if (!cell) return '';
  try {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('richText' in val && Array.isArray(val.richText)) return val.richText.map((t) => t.text).join('');
      if ('text' in val && val.text !== undefined && val.text !== null) return String(val.text);
      if ('result' in val && val.result !== undefined && val.result !== null) return String(val.result);
      if (cell.master && cell.master !== cell) return getCellText(cell.master);
    }
    return String(val);
  } catch {
    return '';
  }
}

/**
 * Разбор содержимого ячейки расписания (предмет + преподаватель)
 */
function parseCellContent(text) {
  if (!text || !text.trim()) {
    return { subject: '', teacher: '', note: '' };
  }
  const clean = text.trim();
  const teacherPattern = /([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.|\s+[А-ЯЁ]\.))(?:\s*,\s*([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.|\s+[А-ЯЁ]\.)))*/g;
  const match = teacherPattern.exec(clean);
  if (match) {
    const teacher = match[0].trim();
    const subject = clean.slice(0, match.index).trim();
    return { subject, teacher, note: '' };
  }

  // Если преподаватель на отдельной строке
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      subject: lines[0],
      teacher: lines.slice(1).join(' '),
      note: '',
    };
  }

  return { subject: clean, teacher: '', note: '' };
}

export async function parseBaseSchedule(filePath) {
  const wb = new ExcelJS.Workbook();
  const buf = fs.readFileSync(filePath);
  await wb.xlsx.load(buf);

  const baseLessons = [];
  const groupsSet = new Set();
  const teachersSet = new Set();
  const cabinetsSet = new Set();

  for (const sheet of wb.worksheets) {
    // 1. Поиск строки заголовка групп
    let headerRowIdx = -1;
    let dayCol = -1;
    let lessonCol = -1;
    const groupCols = [];

    sheet.eachRow((row, rowNumber) => {
      if (headerRowIdx !== -1) return;
      const values = [];
      row.eachCell({ includeEmpty: true }, (c, colNumber) => {
        values[colNumber] = getCellText(c).trim();
      });
      const joined = values.join(' ').toLowerCase();
      if (joined.includes('дни недели') && joined.includes('пара')) {
        headerRowIdx = rowNumber;
        dayCol = values.findIndex((v) => /дни\s*недели/i.test(v));
        lessonCol = values.findIndex((v) => /^пара/i.test(v));

        for (let c = lessonCol + 1; c < values.length; c++) {
          const val = values[c];
          if (val && !/^ауд/i.test(val)) {
            const next = values[c + 1] ?? '';
            const audCol = /^ауд/i.test(next) ? c + 1 : -1;
            groupCols.push({ group: val, subjCol: c, audCol });
            groupsSet.add(val);
            if (audCol !== -1) c++;
          }
        }
      }
    });

    if (headerRowIdx === -1 || groupCols.length === 0) continue;

    // 2. Чтение пар. Строки сгруппированы по 2: нечётная = числитель, чётная = знаменатель
    let currentDay = '';
    let currentLesson = 0;

    for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const validDays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
      const rawDay = getCellText(row.getCell(dayCol)).trim().toLowerCase();
      if (rawDay && validDays.includes(rawDay) && rawDay !== currentDay) {
        currentDay = rawDay;
      } else if (rawDay && !validDays.includes(rawDay)) {
        // Если день не из списка (например, блок "согласовано"), прекращаем парсинг текущего листа
        break;
      }

      const rawLesson = getCellText(row.getCell(lessonCol)).trim();
      const lessonNum = parseInt(rawLesson, 10);
      if (!isNaN(lessonNum) && lessonNum > 0) {
        currentLesson = lessonNum;
      }

      if (!currentDay || !validDays.includes(currentDay) || !currentLesson) continue;

      // Читаем обе строки для текущей пары если они идут парами:
      // Строка A (r): числитель
      // Строка B (r + 1): знаменатель
      const rowA = sheet.getRow(r);
      const rowB = sheet.getRow(r + 1);

      // Проверяем, действительно ли r + 1 принадлежит той же паре
      const nextRawLesson = getCellText(rowB.getCell(lessonCol)).trim();
      const isPair = nextRawLesson === '' || nextRawLesson === String(currentLesson);

      for (const g of groupCols) {
        // Числитель
        const textA = getCellText(rowA.getCell(g.subjCol)).trim();
        const audA = g.audCol !== -1 ? getCellText(rowA.getCell(g.audCol)).trim() : '';

        // Знаменатель
        const textB = isPair ? getCellText(rowB.getCell(g.subjCol)).trim() : textA;
        const audB = isPair && g.audCol !== -1 ? getCellText(rowB.getCell(g.audCol)).trim() : audA;

        if (textA) {
          const p = parseCellContent(textA);
          baseLessons.push({
            course: sheet.name,
            day: currentDay,
            lesson: currentLesson,
            week_type: 'числитель',
            group: g.group,
            subject: p.subject,
            teacher: p.teacher,
            cabinet: audA,
            rawText: textA,
          });
          if (p.teacher) teachersSet.add(p.teacher);
          if (audA) cabinetsSet.add(audA);
        }

        if (textB) {
          const p = parseCellContent(textB);
          baseLessons.push({
            course: sheet.name,
            day: currentDay,
            lesson: currentLesson,
            week_type: 'знаменатель',
            group: g.group,
            subject: p.subject,
            teacher: p.teacher,
            cabinet: audB,
            rawText: textB,
          });
          if (p.teacher) teachersSet.add(p.teacher);
          if (audB) cabinetsSet.add(audB);
        }
      }

      if (isPair) {
        r++; // перескакиваем вторую строку пары
      }
    }
  }

  return {
    lessons: baseLessons,
    groups: Array.from(groupsSet).sort((a, b) => a.localeCompare(b, 'ru')),
    teachers: Array.from(teachersSet).sort((a, b) => a.localeCompare(b, 'ru')),
    cabinets: Array.from(cabinetsSet).sort((a, b) => a.localeCompare(b, 'ru')),
  };
}
