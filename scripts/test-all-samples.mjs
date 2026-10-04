import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const SAMPLES_DIR = path.resolve('samples');

function getCellText(cell) {
  if (!cell) return '';
  try {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val.richText && Array.isArray(val.richText)) {
        return val.richText.map((t) => t.text).join('');
      }
      if (val.text !== undefined && val.text !== null) return String(val.text);
      if (val.result !== undefined && val.result !== null) return String(val.result);
      if (cell.master && cell.master !== cell) return getCellText(cell.master);
    }
    return String(val);
  } catch {
    return '';
  }
}

function getFillColor(cell) {
  if (!cell) return null;
  const fill = cell.fill || cell.master?.fill;
  if (!fill || fill.pattern === 'none') return null;
  return fill.fgColor?.argb || fill.bgColor?.argb || null;
}

const COLOR_MAP = {
  YELLOW: 'FFFFFF00',
  GREEN: 'FF92D050',
};

function isYellow(argb) {
  if (!argb) return false;
  const u = argb.toUpperCase();
  // FFFFFF00 (чистый желтый) или вариации желтого
  return u === 'FFFFFF00' || u.endsWith('FFFF00') || u === 'FFFFE599';
}

function isGreen(argb) {
  if (!argb) return false;
  const u = argb.toUpperCase();
  // FF92D050 (лайм/зеленый Excel)
  return u === 'FF92D050' || u === 'FF00FF00' || u === 'FFA9D08E';
}

function parseCellContent(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { subject: '', teacher: '', note: '' };

  let note = '';
  const filteredLines = [];
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

async function testFile(filePath) {
  const fileName = path.basename(filePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  let headerRowIdx = -1;
  let dayColIdx = -1;
  let lessonColIdx = -1;
  const groups = [];

  sheet.eachRow((row, rowNumber) => {
    if (headerRowIdx !== -1) return;
    const values = [];
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

  const rowsData = [];
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

  const parsedItems = [];
  let skippedWhite = 0;

  for (let i = 0; i < rowsData.length; i += 2) {
    const baseRow = rowsData[i];
    const actRow = rowsData[i + 1];
    if (!actRow) continue;

    const day = baseRow.day;
    const lesson = Number(baseRow.lesson);

    for (const g of groups) {
      const cBase = baseRow.row.getCell(g.subjCol);
      const cAct = actRow.row.getCell(g.subjCol);

      const audBase = g.audCol !== -1 ? getCellText(baseRow.row.getCell(g.audCol)).trim() : '';
      const audAct = g.audCol !== -1 ? getCellText(actRow.row.getCell(g.audCol)).trim() : '';

      const baseText = getCellText(cBase).trim();
      const actText = getCellText(cAct).trim();

      const baseFill = getFillColor(cBase);
      const actFill = getFillColor(cAct);

      const isMergedAcrossPair = cBase.isMerged && cAct.isMerged && (cBase.master?.address === cAct.master?.address || cBase.address === cAct.master?.address);

      // 1. Обе пустые и без заливки
      if (!baseText && !actText && !baseFill && !actFill && !audBase && !audAct) {
        continue;
      }

      // 2. Если ячейки объединены между base и actual
      if (isMergedAcrossPair) {
        const fill = actFill || baseFill;
        const text = actText || baseText;
        const aud = audAct || audBase;

        if (isYellow(fill)) {
          if (text) {
            const parsed = parseCellContent(text);
            parsedItems.push({
              group_name: g.name,
              lesson,
              type: 'permanent',
              subject: parsed.subject,
              teacher: parsed.teacher,
              cabinet: aud,
              note: parsed.note,
              color: fill,
              day,
            });
          } else {
            parsedItems.push({
              group_name: g.name,
              lesson,
              type: 'отмена',
              subject: '',
              teacher: '',
              cabinet: '',
              note: '',
              color: fill,
              day,
            });
          }
        } else if (isGreen(fill)) {
          if (text) {
            const parsed = parseCellContent(text);
            parsedItems.push({
              group_name: g.name,
              lesson,
              type: 'замена',
              subject: parsed.subject,
              teacher: parsed.teacher,
              cabinet: aud,
              note: parsed.note,
              color: fill,
              day,
            });
          } else {
            parsedItems.push({
              group_name: g.name,
              lesson,
              type: 'отмена',
              subject: '',
              teacher: '',
              cabinet: '',
              note: '',
              color: fill,
              day,
            });
          }
        } else {
          // Белая объединенная ячейка = пара из расписания без замен
          skippedWhite++;
        }
        continue;
      }

      // 3. Не объединены: сравниваем base и actual
      const isSameTextAndAud = baseText === actText && audBase === audAct;

      if (isSameTextAndAud && !actFill && !baseFill) {
        skippedWhite++;
        continue;
      }

      // Если actual пустая при непустой base -> отмена
      if (baseText && !actText) {
        const baseParsed = parseCellContent(baseText);
        parsedItems.push({
          group_name: g.name,
          lesson,
          type: 'отмена',
          subject: baseParsed.subject, // сохраняем предмет базовой пары
          teacher: '',
          cabinet: '',
          note: '',
          color: actFill || 'none',
          day,
        });
        continue;
      }

      // Если base пустая при непустой actual -> добавление (замена или permanent)
      if (!baseText && actText) {
        const parsed = parseCellContent(actText);
        const itemType = isYellow(actFill) ? 'permanent' : 'замена';
        parsedItems.push({
          group_name: g.name,
          lesson,
          type: itemType,
          subject: parsed.subject,
          teacher: parsed.teacher,
          cabinet: audAct,
          note: parsed.note,
          color: actFill || 'none',
          day,
        });
        continue;
      }

      // Обе непустые и разные (или с заливкой)
      const parsed = parseCellContent(actText);
      const itemType = isYellow(actFill) ? 'permanent' : 'замена';
      parsedItems.push({
        group_name: g.name,
        lesson,
        type: itemType,
        subject: parsed.subject,
        teacher: parsed.teacher,
        cabinet: audAct,
        note: parsed.note,
        color: actFill || 'none',
        day,
      });
    }
  }

  const replacements = parsedItems.filter((i) => i.type === 'замена');
  const permanent = parsedItems.filter((i) => i.type === 'permanent');
  const cancellations = parsedItems.filter((i) => i.type === 'отмена');

  console.log(`\n======================================================`);
  console.log(`Файл: ${fileName}`);
  console.log(`Замен: ${replacements.length} · Постоянных: ${permanent.length} · Отмен: ${cancellations.length} · Пропущено белых: ${skippedWhite}`);

  console.log('\n--- Примеры замен (до 5): ---');
  replacements.slice(0, 5).forEach((r) => {
    console.log(`  ${r.group_name} | п.${r.lesson} | ${r.subject} | преп: ${r.teacher} | ауд: ${r.cabinet} | цвет: ${r.color}`);
  });

  console.log('\n--- Примеры постоянных (до 5): ---');
  permanent.slice(0, 5).forEach((r) => {
    console.log(`  ${r.group_name} | п.${r.lesson} | ${r.subject} | преп: ${r.teacher} | ауд: ${r.cabinet} | цвет: ${r.color}`);
  });

  console.log('\n--- Примеры отмен (до 5): ---');
  cancellations.slice(0, 5).forEach((r) => {
    console.log(`  ${r.group_name} | п.${r.lesson} | ${r.subject || '(без предмета)'} | цвет: ${r.color}`);
  });
}

async function main() {
  const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.xlsx'));
  for (const f of files) {
    await testFile(path.join(SAMPLES_DIR, f));
  }
}

main().catch(console.error);
