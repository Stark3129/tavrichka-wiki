import path from 'path';
import ExcelJS from 'exceljs';

const filePath = path.resolve('samples/замены 25.09 (ЗНАМЕНАТЕЛЬ).xlsx');

function getCellRaw(row, col) {
  const cell = row.getCell(col);
  const fill = cell.fill ? (cell.fill.fgColor?.argb || cell.fill.pattern) : 'none';
  const val = cell.value;
  let text = '';
  if (val && typeof val === 'object' && val.richText) {
    text = val.richText.map((t) => t.text).join('');
  } else if (val) {
    text = String(val);
  }
  return {
    addr: cell.address,
    isMerged: cell.isMerged,
    type: cell.type,
    master: cell.master?.address,
    fill,
    text: text.replace(/\r?\n/g, ' / '),
  };
}

async function debug25() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  let col2KSK33 = -1;
  sheet.getRow(2).eachCell((cell, colNumber) => {
    if (String(cell.value).includes('2КСК33')) {
      col2KSK33 = colNumber;
    }
  });

  console.log('Column 2КСК33 is:', col2KSK33);

  for (let r = 2; r <= 14; r++) {
    const row = sheet.getRow(r);
    const day = getCellRaw(row, 1);
    const lesson = getCellRaw(row, 2);
    const subj = getCellRaw(row, col2KSK33);
    const aud = getCellRaw(row, col2KSK33 + 1);

    console.log(`Row ${r.toString().padStart(2, ' ')} | D: ${day.text.padEnd(8, ' ')} | L: ${lesson.text.padEnd(2, ' ')}`);
    console.log(`  Subj: [${subj.addr}, fill:${subj.fill}, master:${subj.master}] "${subj.text}"`);
    console.log(`  Aud:  [${aud.addr}, fill:${aud.fill}, master:${aud.master}] "${aud.text}"`);
  }
}

debug25().catch(console.error);
