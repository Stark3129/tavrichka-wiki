'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { LessonTime, MapFloor, MapObject, ScheduleRow } from '@/lib/types';

/** Особые названия кнопок → фактическое значение cabinet в schedule_rows. */
const CABINET_OVERRIDE: Record<string, string> = {
  'Спортзал': 'с/з',
  'ЖД-18': 'жд18',
};

const CATEGORY_STYLES: Record<string, string> = {
  'аудитория': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  'лаборатория': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  'спорт': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  'столовая': 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  'администрация': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  'библиотека': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
};
const CATEGORY_FALLBACK = 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';

const CATEGORY_LABELS: Record<string, string> = {
  'аудитория': 'Аудитории',
  'лаборатория': 'Лаборатории',
  'спорт': 'Спорт',
  'столовая': 'Столовая',
  'администрация': 'Администрация',
  'библиотека': 'Библиотека',
};

/** Минуты от полуночи по московскому времени. */
function moscowMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function toMinutes(hhmmss: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmmss.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export default function MapExplorer({
  corpus,
  corpusOptions,
  floors,
  objects,
  times,
  today,
}: {
  corpus: number;
  corpusOptions: number[];
  floors: MapFloor[];
  objects: MapObject[];
  times: LessonTime[];
  today: string;
}) {
  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.sort - b.sort),
    [floors]
  );
  const [activeFloorId, setActiveFloorId] = useState<number | null>(
    sortedFloors[0]?.id ?? null
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [todayRows, setTodayRows] = useState<ScheduleRow[]>([]);
  const [rowsState, setRowsState] = useState<'idle' | 'loading' | 'done'>('idle');

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId) ?? null;
  const floorObjects = useMemo(
    () => objects.filter((o) => o.floor === activeFloor?.floor),
    [objects, activeFloor]
  );
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  // Клик по кабинету: грузим «Сегодня здесь» (cabinet = room или override по названию).
  useEffect(() => {
    if (!selected) {
      setTodayRows([]);
      setRowsState('idle');
      return;
    }
    const cabinet = CABINET_OVERRIDE[selected.name] ?? selected.room;
    setRowsState('loading');
    const supabase = createClient();
    supabase
      .from('schedule_rows')
      .select('*')
      .eq('cabinet', cabinet)
      .eq('date', today)
      .order('lesson', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setTodayRows((data as ScheduleRow[] | null) ?? []);
        setRowsState('done');
      });
  }, [selected, today]);

  const nowMin = moscowMinutesNow();
  const timeByLesson = useMemo(() => {
    const map = new Map<number, LessonTime>();
    times.forEach((t) => map.set(t.lesson, t));
    return map;
  }, [times]);

  function isLessonNow(lesson: number): boolean {
    const t = timeByLesson.get(lesson);
    if (!t) return false;
    const start = toMinutes(t.start_time);
    const end = toMinutes(t.end_time);
    return start !== null && end !== null && nowMin >= start && nowMin < end;
  }

  const categories = useMemo(() => {
    const set = new Set(floorObjects.map((o) => o.category));
    return Array.from(set);
  }, [floorObjects]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Карта</h1>
        <div className="ml-auto flex gap-2">
          {corpusOptions.map((c) => (
            <a
              key={c}
              href={`/map?corpus=${c}`}
              className={cn(
                'btn',
                c === corpus ? 'btn-primary' : 'btn-outline'
              )}
            >
              Корпус {c}
            </a>
          ))}
        </div>
      </div>

      {sortedFloors.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          Для этого корпуса этажи пока не добавлены.
        </p>
      ) : (
        <>
          {/* Вкладки этажей по sort */}
          <div className="flex flex-wrap gap-2">
            {sortedFloors.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFloorId(f.id);
                  setSelectedId(null);
                }}
                className={cn(
                  'btn',
                  f.id === activeFloorId ? 'btn-primary' : 'btn-outline'
                )}
              >
                {f.title}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            {/* Этаж: схема + облако кабинетов */}
            <div className="space-y-4">
              <div className="card p-4">
                {activeFloor?.image_url ? (
                  <>
                    <img
                      src={activeFloor.image_url}
                      alt={`${activeFloor.title} — схема этажа`}
                      className="w-full rounded-lg border border-slate-100"
                    />
                    <a
                      href={activeFloor.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline mt-3"
                    >
                      Открыть оригинал
                    </a>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Схема этажа пока не загружена.
                  </p>
                )}
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {categories.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5">
                      <span
                        className={cn('inline-block h-3 w-3 rounded border', (
                          CATEGORY_STYLES[c] ?? CATEGORY_FALLBACK
                        ).split(' ').slice(0, 2).join(' '))}
                      />
                      {CATEGORY_LABELS[c] ?? c}
                    </span>
                  ))}
                </div>
              )}

              {floorObjects.length === 0 ? (
                <p className="card p-6 text-center text-sm text-slate-500">
                  На этом этаже пока нет отмеченных кабинетов.
                </p>
              ) : (
                <div className="card flex flex-wrap gap-2 p-4">
                  {floorObjects.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                        CATEGORY_STYLES[o.category] ?? CATEGORY_FALLBACK,
                        o.id === selectedId && 'ring-2 ring-indigo-500'
                      )}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Боковая панель кабинета */}
            <aside className="card self-start p-4 lg:sticky lg:top-20">
              {!selected ? (
                <p className="text-sm text-slate-500">
                  Нажмите на кабинет на схеме или в списке, чтобы увидеть подробности
                  и занятия «Сегодня здесь».
                </p>
              ) : (
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                  <span className="badge mt-1.5 bg-slate-100 text-slate-700">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </span>
                  {selected.description && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {selected.description}
                    </p>
                  )}

                  <h3 className="mt-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-900">
                    Сегодня здесь
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Занятия в кабинете «{CABINET_OVERRIDE[selected.name] ?? selected.room}»
                  </p>

                  {rowsState === 'loading' && (
                    <p className="mt-2 text-sm text-slate-500">Загружаем…</p>
                  )}
                  {rowsState === 'done' && todayRows.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">Сегодня занятий нет.</p>
                  )}
                  {rowsState === 'done' && todayRows.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {todayRows.map((row) => (
                        <div key={row.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge bg-indigo-100 text-indigo-700">
                              {row.lesson} пара
                            </span>
                            {isLessonNow(row.lesson) && (
                              <span className="badge bg-emerald-100 text-emerald-700">
                                идёт сейчас
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-medium text-slate-900">{row.subject}</p>
                          <p className="text-xs text-slate-600">
                            {row.group_name}
                            {row.teacher ? ` · ${row.teacher}` : ''}
                          </p>
                          {timeByLesson.get(row.lesson) && (
                            <p className="text-xs text-slate-500">
                              {timeByLesson.get(row.lesson)!.start_time.slice(0, 5)}–
                              {timeByLesson.get(row.lesson)!.end_time.slice(0, 5)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
