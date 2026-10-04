import path from 'path';
import ExcelJS from 'exceljs';

const filePath = path.resolve('samples/замены 24.09 (ЗНАМЕНАТЕЛЬ) (1).xlsx');

async function checkMerges() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  console.log('Worksheet model merges:');
  const merges = sheet.model.merges || [];
  console.log(`Total merged ranges: ${merges.length}`);
  console.log('Sample merges:', merges.slice(0, 15));

  // Check rows 3 and 4 for 2Т29 (col 35)
  const c3 = sheet.getRow(3).getCell(35);
  const c4 = sheet.getRow(4).getCell(35);
  console.log('c3 address:', c3.address, 'isMerged:', c3.isMerged, 'type:', c3.type, 'master:', c3.master?.address);
  console.log('c4 address:', c4.address, 'isMerged:', c4.isMerged, 'type:', c4.type, 'master:', c4.master?.address);
}

checkMerges().catch(console.error);
