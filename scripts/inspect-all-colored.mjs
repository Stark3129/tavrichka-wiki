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

function getCellFillArgb(cell) {
  if (!cell) return null;
  const fill = cell.fill || cell.master?.fill;
  if (!fill || fill.pattern === 'none') return null;
  return fill.fgColor?.argb || fill.bgColor?.argb || null;
}

async function inspectAllColored(filePath) {
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

  const coloredCells = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return;
    const day = getCellText(row.getCell(dayColIdx)).trim();
    const lesson = getCellText(row.getCell(lessonColIdx)).trim();

    for (const g of groups) {
      const cell = row.getCell(g.subjCol);
      const fill = getCellFillArgb(cell);
      const text = getCellText(cell).trim();
      const aud = g.audCol !== -1 ? getCellText(row.getCell(g.audCol)).trim() : '';

      if (fill) {
        coloredCells.push({
          row: rowNumber,
          group: g.name,
          fill,
          isMerged: cell.isMerged,
          master: cell.master?.address,
          addr: cell.address,
          text: text.replace(/\r?\n/g, ' / '),
          aud,
        });
      }
    }
  });

  console.log(`\n======================================================`);
  console.log(`File: ${fileName}`);
  console.log(`Total colored cells found: ${coloredCells.length}`);

  const byColor = {};
  for (const c of coloredCells) {
    if (!byColor[c.fill]) byColor[c.fill] = [];
    byColor[c.fill].push(c);
  }

  for (const [color, list] of Object.entries(byColor)) {
    console.log(`Color ${color}: count = ${list.length}`);
    list.slice(0, 10).forEach((c) => {
      console.log(`  Row ${c.row} (${c.addr}, merged:${c.isMerged}) [${c.group}]: "${c.text}" (aud: ${c.aud})`);
    });
  }
}

async function main() {
  const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.xlsx'));
  for (const f of files) {
    await inspectAllColored(path.join(SAMPLES_DIR, f));
  }
}

main().catch(console.error);
