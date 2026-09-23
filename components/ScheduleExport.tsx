'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useState, type RefObject } from 'react';

/**
 * Кнопки экспорта превью расписания в PNG и PDF.
 * Модуль подключается через next/dynamic ({ ssr: false }),
 * поэтому библиотеки не попадают в начальный бандл страницы.
 */
export default function ScheduleExport({
  previewRef,
  fileNameBase,
}: {
  previewRef: RefObject<HTMLDivElement | null>;
  fileNameBase: string;
}) {
  const [pngBusy, setPngBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function downloadPng() {
    const node = previewRef.current;
    if (!node) return;
    setPngBusy(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${fileNameBase}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setPngBusy(false);
    }
  }

  async function downloadPdf() {
    const node = previewRef.current;
    if (!node) return;
    setPdfBusy(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      // Альбомная ориентация — таблица расписания широкая.
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      // Вписываем картинку с сохранением пропорций.
      let w = maxW;
      let h = (canvas.height * w) / canvas.width;
      if (h > maxH) {
        h = maxH;
        w = (canvas.width * h) / canvas.height;
      }
      pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`${fileNameBase}.pdf`);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={downloadPng}
        disabled={pngBusy || pdfBusy}
        className="btn btn-primary"
      >
        {pngBusy ? 'Готовим PNG…' : 'Скачать PNG'}
      </button>
      <button
        type="button"
        onClick={downloadPdf}
        disabled={pngBusy || pdfBusy}
        className="btn btn-primary"
      >
        {pdfBusy ? 'Готовим PDF…' : 'Скачать PDF'}
      </button>
    </>
  );
}