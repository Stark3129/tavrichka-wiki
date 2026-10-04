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

function getCellFill(cell) {
  if (!cell) return null;
  return cell.fill || cell.master?.fill || null;
}

function getFillColor(cell) {
  const fill = getCellFill(cell);
  if (!fill || fill.pattern === 'none') return null;
  return fill.fgColor?.argb || fill.bgColor?.argb || null;
}

async function analyzePairs(filePath) {
  const fileName = path.basename(filePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log(`\n==================================================`);
  console.log(`File: ${fileName}`);
  console.log(`Sheets: ${wb.worksheets.map((s) => s.name).join(', ')}`);

  const sheet = wb.worksheets[0];
  let headerRowIdx = -1;
  let dayColIdx = -1;
  let lessonColIdx = -1;
  const groups = []; // { name, subjCol, audCol }

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

  console.log(`Header at row ${headerRowIdx}, detected ${groups.length} groups.`);

  // Считываем все строки после заголовка
  const rowsData = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return;
    const day = getCellText(row.getCell(dayColIdx)).trim();
    const lesson = getCellText(row.getCell(lessonColIdx)).trim();
    rowsData.push({ rowNumber, day, lesson, row });
  });

  console.log(`Total data rows: ${rowsData.length}`);

  // Заполняем пропуски в day и lesson (объединенные ячейки)
  let curDay = '';
  let curLesson = '';
  for (const r of rowsData) {
    if (r.day) curDay = r.day;
    else r.day = curDay;

    if (r.lesson) curLesson = r.lesson;
    else r.lesson = curLesson;
  }

  // Группируем строки по парам (день + пара)
  // В Excel: обычно 2 строки на каждый номер пары:
  // строка 1 (base), строка 2 (actual)
  const pairGroups = [];
  for (let i = 0; i < rowsData.length; i += 2) {
    const r1 = rowsData[i];
    const r2 = rowsData[i + 1];
    pairGroups.push({ base: r1, actual: r2 });
  }

  console.log(`Formed ${pairGroups.length} pair groups.`);

  let totalIdentical = 0;
  let totalCancellations = 0;
  let totalReplacements = 0;
  let totalPermanent = 0;
  let totalAdded = 0;

  const samples = {
    cancellations: [],
    replacements: [],
    permanent: [],
    added: [],
    identical: [],
  };

  for (const pg of pairGroups) {
    const { base, actual } = pg;
    if (!actual) continue; // нечетное число строк?

    for (const g of groups) {
      const baseCell = base.row.getCell(g.subjCol);
      const actCell = actual.row.getCell(g.subjCol);

      const baseText = getCellText(baseCell).trim();
      const actText = getCellText(actCell).trim();

      const baseFill = getFillColor(baseCell);
      const actFill = getFillColor(actCell);

      const baseAud = g.audCol !== -1 ? getCellText(base.row.getCell(g.audCol)).trim() : '';
      const actAud = g.audCol !== -1 ? getCellText(actual.row.getCell(g.audCol)).trim() : '';

      // Проверяем статус
      if (!baseText && !actText && !baseAud && !actAud) {
        // Обе пустые - нет пары вообще
        continue;
      }

      if (baseText === actText && baseAud === actAud) {
        totalIdentical++;
        if (samples.identical.length < 3 && baseText) {
          samples.identical.push({
            day: base.day,
            lesson: base.lesson,
            group: g.name,
            text: baseText.replace(/\r?\n/g, ' / '),
            aud: baseAud,
            actFill,
          });
        }
        continue;
      }

      if (baseText && !actText) {
        totalCancellations++;
        samples.cancellations.push({
          day: base.day,
          lesson: base.lesson,
          group: g.name,
          baseText: baseText.replace(/\r?\n/g, ' / '),
          baseAud,
          actFill,
        });
        continue;
      }

      if (!baseText && actText) {
        totalAdded++;
        samples.added.push({
          day: base.day,
          lesson: base.lesson,
          group: g.name,
          actText: actText.replace(/\r?\n/g, ' / '),
          actAud,
          actFill,
        });
        continue;
      }

      // Обе непустые и разные
      if (actFill === 'FFFFFF00') {
        totalPermanent++;
        samples.permanent.push({
          day: base.day,
          lesson: base.lesson,
          group: g.name,
          baseText: baseText.replace(/\r?\n/g, ' / '),
          actText: actText.replace(/\r?\n/g, ' / '),
          actAud,
          actFill,
        });
      } else {
        totalReplacements++;
        samples.replacements.push({
          day: base.day,
          lesson: base.lesson,
          group: g.name,
          baseText: baseText.replace(/\r?\n/g, ' / '),
          actText: actText.replace(/\r?\n/g, ' / '),
          actAud,
          actFill,
        });
      }
    }
  }

  console.log(`Results for ${fileName}:`);
  console.log(`- Identical (skipped, white): ${totalIdentical}`);
  console.log(`- Replacements (one-day, green/other): ${totalReplacements}`);
  console.log(`- Added lessons: ${totalAdded}`);
  console.log(`- Permanent (yellow): ${totalPermanent}`);
  console.log(`- Cancellations (base present, act empty): ${totalCancellations}`);

  if (samples.permanent.length > 0) {
    console.log(`\nPermanent samples (${samples.permanent.length}):`);
    samples.permanent.slice(0, 5).forEach((s) => {
      console.log(`  ${s.day} п.${s.lesson} ${s.group}: "${s.baseText}" -> "${s.actText}" (${s.actAud}) [fill: ${s.actFill}]`);
    });
  }

  if (samples.cancellations.length > 0) {
    console.log(`\nCancellation samples (${samples.cancellations.length}):`);
    samples.cancellations.slice(0, 5).forEach((s) => {
      console.log(`  ${s.day} п.${s.lesson} ${s.group}: was "${s.baseText}" (${s.baseAud}) -> canceled [fill: ${s.actFill}]`);
    });
  }

  if (samples.replacements.length > 0) {
    console.log(`\nReplacement samples (${samples.replacements.length}):`);
    samples.replacements.slice(0, 5).forEach((s) => {
      console.log(`  ${s.day} п.${s.lesson} ${s.group}: "${s.baseText}" -> "${s.actText}" (${s.actAud}) [fill: ${s.actFill}]`);
    });
  }

  if (samples.added.length > 0) {
    console.log(`\nAdded samples (${samples.added.length}):`);
    samples.added.slice(0, 5).forEach((s) => {
      console.log(`  ${s.day} п.${s.lesson} ${s.group}: added "${s.actText}" (${s.actAud}) [fill: ${s.actFill}]`);
    });
  }
}

async function main() {
  const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.xlsx'));
  for (const f of files) {
    await analyzePairs(path.join(SAMPLES_DIR, f));
  }
}

main().catch(console.error);
