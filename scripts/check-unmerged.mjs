import path from 'path';
import ExcelJS from 'exceljs';

const filePath = path.resolve('samples/замены 24.09 (ЗНАМЕНАТЕЛЬ) (1).xlsx');

async function checkUnmerged() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  console.log('Comparing rows 3 and 4 (Lesson 1):');
  for (let c = 3; c <= 58; c += 2) {
    const groupName = sheet.getRow(2).getCell(c).value;
    const c3 = sheet.getRow(3).getCell(c);
    const c4 = sheet.getRow(4).getCell(c);

    const t3 = String(c3.value || '').replace(/\r?\n/g, ' / ');
    const t4 = String(c4.value || '').replace(/\r?\n/g, ' / ');

    const fill3 = c3.fill?.fgColor?.argb || (c3.fill ? c3.fill.pattern : 'none');
    const fill4 = c4.fill?.fgColor?.argb || (c4.fill ? c4.fill.pattern : 'none');

    const m3 = c3.isMerged ? `merged(${c3.master?.address})` : 'unmerged';
    const m4 = c4.isMerged ? `merged(${c4.master?.address})` : 'unmerged';

    if (t3 !== t4 || fill3 !== fill4 || fill3 === 'FF92D050' || fill3 === 'FFFFFF00') {
      console.log(`Group: ${groupName} (col ${c}):`);
      console.log(`  Row 3 [${m3}, fill:${fill3}]: "${t3}"`);
      console.log(`  Row 4 [${m4}, fill:${fill4}]: "${t4}"`);
    }
  }

  console.log('\nComparing rows 5 and 6 (Lesson 2):');
  for (let c = 3; c <= 58; c += 2) {
    const groupName = sheet.getRow(2).getCell(c).value;
    const c5 = sheet.getRow(5).getCell(c);
    const c6 = sheet.getRow(6).getCell(c);

    const t5 = String(c5.value || '').replace(/\r?\n/g, ' / ');
    const t6 = String(c6.value || '').replace(/\r?\n/g, ' / ');

    const fill5 = c5.fill?.fgColor?.argb || (c5.fill ? c5.fill.pattern : 'none');
    const fill6 = c6.fill?.fgColor?.argb || (c6.fill ? c6.fill.pattern : 'none');

    const m5 = c5.isMerged ? `merged(${c5.master?.address})` : 'unmerged';
    const m6 = c6.isMerged ? `merged(${c6.master?.address})` : 'unmerged';

    if (t5 !== t6 || fill5 !== fill6 || fill5 === 'FF92D050' || fill5 === 'FFFFFF00') {
      console.log(`Group: ${groupName} (col ${c}):`);
      console.log(`  Row 5 [${m5}, fill:${fill5}]: "${t5}"`);
      console.log(`  Row 6 [${m6}, fill:${fill6}]: "${t6}"`);
    }
  }
}

checkUnmerged().catch(console.error);
