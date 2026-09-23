'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Share2, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ScheduleRow } from '@/lib/types';

// Тяжёлые библиотеки экспорта грузим лениво и только на клиенте.
const ScheduleExport = dynamic(() => import('@/components/ScheduleExport'), {
  ssr: false,
});

/**
 * Кнопка «Поделиться» + модалка с превью расписания
 * и экспортом в PNG/PDF (html2canvas, jsPDF).
 */
export default function ShareSchedule({
  group,
  date,
  dayLabel,
  rows,
}: {
  group: string;
  date: string;
  dayLabel: string;
  rows: ScheduleRow[];
}) {
  const [open, setOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fileNameBase = `${group}_${date}`.replace(/[^\w-]+/g, '_');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-outline"
        aria-label="Поделиться расписанием"
      >
        <Share2 className="h-4 w-4" />
        Поделиться
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card w-full max-w-3xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[var(--text)]">Предпросмотр</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="btn btn-outline !px-2.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Превью: явные цвета, чтобы PNG/PDF выглядели одинаково в обеих темах */}
            <div className="mt-4 overflow-x-auto">
              <div
                ref={previewRef}
                className="min-w-[640px] bg-white p-5 text-slate-900"
              >
                <h3 className="text-lg font-bold">
                  Расписание: {group} на {formatDate(date)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{dayLabel}</p>

                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-1.5">День</th>
                      <th className="px-2 py-1.5">Пара</th>
                      <th className="px-2 py-1.5">Предмет</th>
                      <th className="px-2 py-1.5">Преподаватель</th>
                      <th className="px-2 py-1.5">Аудитория</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-200">
                        <td className="whitespace-nowrap px-2 py-1.5">
                          {r.day_week || dayLabel}
                        </td>
                        <td className="px-2 py-1.5">{r.lesson}</td>
                        <td className="px-2 py-1.5 font-medium">{r.subject}</td>
                        <td className="px-2 py-1.5">{r.teacher}</td>
                        <td className="px-2 py-1.5">{r.cabinet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ScheduleExport previewRef={previewRef} fileNameBase={fileNameBase} />
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}