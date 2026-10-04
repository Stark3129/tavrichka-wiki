import path from 'path';
import ExcelJS from 'exceljs';

const filePath = path.resolve('samples/замены 24.09 (ЗНАМЕНАТЕЛЬ) (1).xlsx');

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

async function debugFile() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  let col2T29 = -1;
  sheet.getRow(2).eachCell((cell, colNumber) => {
    if (String(cell.value).includes('2Т29')) {
      col2T29 = colNumber;
    }
  });

  console.log('Column for 2Т29 is:', col2T29);

  for (let r = 1; r <= 20; r++) {
    const row = sheet.getRow(r);
    const day = getCellText(row.getCell(1));
    const lesson = getCellText(row.getCell(2));
    const cell = row.getCell(col2T29);
    const audCell = row.getCell(col2T29 + 1);

    const text = getCellText(cell);
    const aud = getCellText(audCell);
    const fill = cell.fill?.fgColor?.argb || (cell.fill ? JSON.stringify(cell.fill) : 'none');

    console.log(`Row ${r.toString().padStart(2, ' ')} | D: ${day.padEnd(8, ' ')} | L: ${lesson.padEnd(2, ' ')} | Aud: ${aud.padEnd(5, ' ')} | Fill: ${fill}`);
    if (text) {
      console.log(`       Text: ${text.replace(/\r?\n/g, ' / ')}`);
    }
  }
}

debugFile().catch(console.error);
