'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate } from '@/lib/utils';
import { weekdayRu } from '@/lib/cabinets';
import { normalizeCabinet } from '@/lib/cabinet-mapping';
import type { LessonTime, MapFloor, MapObject, ScheduleRow } from '@/lib/types';

/** Особые названия кнопок → фактическое значение cabinet в schedule_rows. */
const CABINET_OVERRIDE: Record<string, string> = {
  'Спортзал': 'с/з',
  'ЖД-18': 'жд18',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Кабинеты, не отмеченные на схеме (ЖД-корпус, спортзал, актовый зал):
 * показываются отдельной сеткой в Корпусе 2, собираются из расписания.
 * Статический список — гарантия, что сетка не пустая при ошибке запроса. */
const EXTRA_CABINET_RE = /^(жд\d*|с\/з|а\/з)$/i;
const EXTRA_STATIC_CABINETS = [
  'жд4', 'жд5', 'жд8', 'жд9', 'жд10', 'жд11', 'жд13', 'жд14', 'жд15',
  'жд17', 'жд18', 'жд19', 'жд20', 'жд21', 'жд23', 'с/з', 'а/з',
];

/** Сортировка кабинетов: сначала по числу в названии, потом по алфавиту. */
function cabinetSort(a: string, b: string): number {
  const na = Number(/\d+/.exec(a)?.[0] ?? NaN);
  const nb = Number(/\d+/.exec(b)?.[0] ?? NaN);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'ru');
}

export default function MapExplorer({
  corpus,
  corpusOptions,
  floors,
  objects,
  times,
  today,
  initialCabinet = null,
  initialDate = null,
}: {
  corpus: number;
  corpusOptions: number[];
  floors: MapFloor[];
  objects: MapObject[];
  times: LessonTime[];
  today: string;
  /** Кабинет из URL ?cabinet= — открываем его панель при монтировании. */
  initialCabinet?: string | null;
  /** Дата из URL ?date= (ГГГГ-ММ-ДД). */
  initialDate?: string | null;
}) {
  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.sort - b.sort),
    [floors]
  );
  const [activeFloorId, setActiveFloorId] = useState<number | null>(
    sortedFloors[0]?.id ?? null
  );
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (!initialCabinet) return null;
    // Прямая ссылка: подбираем объект карты по кабинету/названию.
    const found = objects.find(
      (o) =>
        o.room === initialCabinet ||
        CABINET_OVERRIDE[o.name] === initialCabinet ||
        o.name === initialCabinet
    );
    return found?.id ?? null;
  });
  // Кабинет, выбранный кликом (в т.ч. жд*, с/з, а/з из дополнительной сетки).
  const [selectedCabinet, setSelectedCabinet] = useState<string | null>(initialCabinet);
  // Кабинеты из расписания, которых нет на схеме (показываются в Корпусе 2).
  const [extraCabinets, setExtraCabinets] = useState<string[]>([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [extraError, setExtraError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    initialDate && DATE_RE.test(initialDate) ? initialDate : today
  );
  const [todayRows, setTodayRows] = useState<ScheduleRow[]>([]);
  const [rowsState, setRowsState] = useState<'idle' | 'loading' | 'done'>('idle');

  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId) ?? null;
  const floorObjects = useMemo(
    () => objects.filter((o) => o.floor === activeFloor?.floor),
    [objects, activeFloor]
  );
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  // Кабинеты из расписания, не отмеченные на схеме, — показываем в Корпусе 2.
  useEffect(() => {
    if (corpus !== 2) {
      setExtraCabinets([]);
      setExtraError(false);
      return;
    }
    setExtraLoading(true);
    setExtraError(false);
    const supabase = createClient();
    supabase
      .from('schedule_rows')
      .select('cabinet')
      .not('cabinet', 'is', null)
      .limit(2000)
      .then(({ data, error }) => {
        // Кабинеты, уже покрытые картой этого корпуса, не дублируем.
        // Сравниваем в нормализованном виде: «14» на схеме = «жд14» в расписании.
        const covered = new Set(
          objects
            .flatMap((o) => [
              o.room,
              o.name,
              CABINET_OVERRIDE[o.name] ?? o.name,
            ])
            .filter((x): x is string => Boolean(x))
            .flatMap((x) => [x, normalizeCabinet(x, corpus)])
        );
        const set = new Set<string>();
        if (!error) {
          (data as Array<{ cabinet: string }> | null ?? []).forEach((r) => {
            const c = r.cabinet?.trim();
            if (c && EXTRA_CABINET_RE.test(c) && !covered.has(c)) set.add(c);
          });
        }
        // Гарантия непустой сетки даже при ошибке запроса.
        EXTRA_STATIC_CABINETS.forEach((c) => {
          if (!covered.has(c)) set.add(c);
        });
        setExtraCabinets(Array.from(set).sort(cabinetSort));
        setExtraError(Boolean(error));
        setExtraLoading(false);
      });
  }, [corpus, objects]);

  // Фактический кабинет в расписании: выбранный кликом или объект карты.
  // Кабинеты Корпуса 2 нормализуются («14» → «жд14»), т.к. в расписании
  // они записаны с префиксом «жд».
  const activeCabinet =
    normalizeCabinet(
      selectedCabinet ??
        (selected ? CABINET_OVERRIDE[selected.name] ?? selected.room : ''),
      corpus
    ) || null;

  // Занятия в кабинете на выбранную дату: шаблон недели + замены на дату.
  // Замены частичные: перекрывают только те пары (группа+пара), которые в них
  // указаны. Строки с датой полностью заменяют шаблонную пару; если группу
  // заменили В другой кабинет — её шаблонная пара из этого кабинета убирается.
  useEffect(() => {
    if (!activeCabinet) {
      setTodayRows([]);
      setRowsState('idle');
      return;
    }
    let stale = false;
    setRowsState('loading');
    const supabase = createClient();
    const day = weekdayRu(selectedDate);

    // Шаблон недели для этого кабинета.
    const tplQuery = supabase
      .from('schedule_rows')
      .select('*')
      .ilike('cabinet', activeCabinet)
      .is('date', null)
      .ilike('day_week', day)
      .order('lesson', { ascending: true })
      .limit(200);

    // Замены на дату в этом кабинете.
    const exactQuery = supabase
      .from('schedule_rows')
      .select('*')
      .ilike('cabinet', activeCabinet)
      .eq('date', selectedDate)
      .order('lesson', { ascending: true })
      .limit(200);

    Promise.all([
      tplQuery.then((r) => (r.data as ScheduleRow[] | null) ?? []),
      exactQuery.then((r) => (r.data as ScheduleRow[] | null) ?? []),
    ]).then(([tpl, exact]) => {
      if (stale) return;
      if (exact.length === 0) {
        setTodayRows(tpl);
        setRowsState('done');
        return;
      }
      // Группы из шаблона: проверяем, не увезли ли их заменами в другой кабинет.
      const groups = Array.from(new Set(tpl.map((r) => r.group_name)));
      const movedKeys = new Set<string>();
      if (groups.length > 0) {
        supabase
          .from('schedule_rows')
          .select('lesson, group_name, cabinet')
          .in('group_name', groups)
          .eq('date', selectedDate)
          .limit(500)
          .then(({ data: moved }) => {
            if (stale) return;
            const norm = (c: string) => (c ?? '').trim().toLowerCase();
            ((moved as Array<Pick<ScheduleRow, 'lesson' | 'group_name' | 'cabinet'>> | null) ?? []).forEach(
              (r) => {
                if (norm(r.cabinet) !== norm(activeCabinet)) {
                  movedKeys.add(`${r.lesson}|${r.group_name}`);
                }
              }
            );
            const exactKeys = new Set(
              exact.map((r) => `${r.lesson}|${r.group_name}`)
            );
            const merged = [
              ...exact,
              ...tpl.filter(
                (r) =>
                  !exactKeys.has(`${r.lesson}|${r.group_name}`) &&
                  !movedKeys.has(`${r.lesson}|${r.group_name}`)
              ),
            ].sort((a, b) => a.lesson - b.lesson);
            setTodayRows(merged);
            setRowsState('done');
          });
      } else {
        setTodayRows(exact);
        setRowsState('done');
      }
    });
    return () => {
      stale = true;
    };
  }, [activeCabinet, selectedDate]);

  const nowMin = moscowMinutesNow();
  const timeByLesson = useMemo(() => {
    const map = new Map<number, LessonTime>();
    times.forEach((t) => map.set(t.lesson, t));
    return map;
  }, [times]);

  function isLessonNow(lesson: number): boolean {
    if (selectedDate !== today) return false;
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

  const panel = (
    <aside className="card self-start p-4 lg:sticky lg:top-20">
      {!activeCabinet ? (
        <p className="text-sm text-slate-500">
          Нажмите на кабинет на схеме или в списке, чтобы увидеть подробности
          и занятия.
        </p>
      ) : (
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {selected?.name ?? activeCabinet}
          </h2>
          {selected && (
            <>
              <span className="badge mt-1.5 bg-slate-100 text-slate-700">
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </span>
              {selected.description && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {selected.description}
                </p>
              )}
            </>
          )}

          <h3 className="mt-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-900">
            {selectedDate === today
              ? 'Сегодня здесь'
              : `Занятия на ${formatDate(selectedDate)}`}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Занятия в кабинете «{activeCabinet}»
          </p>

          {/* GET-форма выбора даты — работает без клиентского JS */}
          <form action="/map" method="get" className="mt-2">
            <input
              type="hidden"
              name="corpus"
              value={String(corpus)}
            />
            <input type="hidden" name="cabinet" value={activeCabinet} />
            <label htmlFor="cabinet-date" className="label">
              Дата
            </label>
            <input
              id="cabinet-date"
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="input"
            />
            <button type="submit" className="btn btn-outline mt-2 w-full text-sm">
              Показать
            </button>
          </form>

          {rowsState === 'loading' && (
            <p className="mt-2 text-sm text-slate-500">Загружаем…</p>
          )}
          {rowsState === 'done' && todayRows.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">
              На эту дату занятий в этом кабинете нет.
            </p>
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
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Карта</h1>
        <div className="ml-auto flex flex-wrap gap-2">
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
            {/* Кабинеты из расписания, не отмеченные на схеме (жд*, с/з, а/з) */}
            {corpus === 2 && (extraCabinets.length > 0 || extraLoading) && (
              <div className="card p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Кабинеты из расписания
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  ЖД-корпус, спортзал и актовый зал — схемы нет, но занятия есть.
                </p>
                {extraLoading && (
                  <p className="mt-3 text-sm text-slate-500">Загружаем…</p>
                )}
                {extraError && !extraLoading && (
                  <p className="mt-3 text-xs text-amber-600">
                    Не удалось обновить список из расписания — показан базовый
                    список кабинетов.
                  </p>
                )}
                {!extraLoading && extraCabinets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extraCabinets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCabinet(c)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                          CATEGORY_STYLES['аудитория'] ?? CATEGORY_FALLBACK,
                          c === selectedCabinet && 'ring-2 ring-indigo-500'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Боковая панель кабинета */}
            {panel}
          </div>
        </>
      )}
    </div>
  );
}
