'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatDate } from '@/lib/utils';
import { weekdayRu } from '@/lib/cabinets';
import { normalizeCabinet } from '@/lib/cabinet-mapping';
import { mergeScheduleRows, rowKey } from '@/lib/schedule-merge';
import type { LessonTime, MapFloor, MapObject, ScheduleRow } from '@/lib/types';

/** Особые названия кнопок → фактическое значение cabinet в schedule_rows. */
const CABINET_OVERRIDE: Record<string, string> = {
  'Спортзал': 'с/з',
  'ЖД-18': 'жд18',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORY_STYLES: Record<string, string> = {
  'classroom': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  'аудитория': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  'lab': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  'лаборатория': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  'sport': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  'спорт': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  'food': 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  'столовая': 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  'admin': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  'administration': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  'администрация': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  'library': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  'библиотека': 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  'service': 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100',
  'служебное': 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100',
  'other': 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
  'другое': 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
};
const CATEGORY_FALLBACK = 'bg-slate-50 dark:bg-slate-900 text-[var(--text)] border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';

const CATEGORY_LABELS: Record<string, string> = {
  'classroom': 'Аудитория',
  'аудитория': 'Аудитории',
  'lab': 'Лаборатория',
  'лаборатория': 'Лаборатории',
  'sport': 'Спортзал',
  'спорт': 'Спорт',
  'food': 'Столовая',
  'столовая': 'Столовая',
  'admin': 'Администрация',
  'administration': 'Администрация',
  'администрация': 'Администрация',
  'library': 'Библиотека',
  'библиотека': 'Библиотека',
  'service': 'Служебное',
  'служебное': 'Служебное',
  'other': 'Другое',
  'другое': 'Другое',
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
  const [imageLoaded, setImageLoaded] = useState(false);
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

    async function load() {
      try {
        const { data, error } = await supabase
          .from('schedule_rows')
          .select('cabinet')
          .or('cabinet.ilike.жд%,cabinet.ilike.с/з%,cabinet.ilike.а/з%')
          .limit(1000);

        const set = new Set<string>();
        if (!error && data) {
          (data as Array<{ cabinet: string }>).forEach((r) => {
            const c = r.cabinet?.trim();
            if (c && EXTRA_CABINET_RE.test(c) && !covered.has(c)) set.add(c);
          });
        }
        // Гарантия базовой сетки
        EXTRA_STATIC_CABINETS.forEach((c) => {
          if (!covered.has(c)) set.add(c);
        });
        setExtraCabinets(Array.from(set).sort(cabinetSort));
        setExtraError(Boolean(error));
        setExtraLoading(false);
      } catch {
        const set = new Set<string>();
        EXTRA_STATIC_CABINETS.forEach((c) => {
          if (!covered.has(c)) set.add(c);
        });
        setExtraCabinets(Array.from(set).sort(cabinetSort));
        setExtraError(true);
        setExtraLoading(false);
      }
    }

    load();
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
      if (groups.length > 0) {
        supabase
          .from('schedule_rows')
          .select('lesson, group_name, cabinet')
          .in('group_name', groups)
          .eq('date', selectedDate)
          .limit(500)
          .then(({ data: moved }) => {
            if (stale) return;
            const movedKeys = new Set<string>();
            const normCab = (c: string | null | undefined) =>
              (c ?? '').trim().toLowerCase();
            (
              (moved as Array<
                Pick<ScheduleRow, 'lesson' | 'group_name' | 'cabinet'>
              > | null) ?? []
            ).forEach((r) => {
              if (normCab(r.cabinet) !== normCab(activeCabinet)) {
                movedKeys.add(rowKey(r.lesson, r.group_name));
              }
            });
            // Замены перекрывают шаблонные пары (нормализованный ключ
            // пара+группа); пары, увезённые в другой кабинет, убираются.
            setTodayRows(mergeScheduleRows(tpl, exact, movedKeys));
            setRowsState('done');
          });
      } else {
        setTodayRows(mergeScheduleRows([], exact));
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
        <p className="text-sm text-[var(--text-muted)]">
          Нажмите на кабинет на схеме или в списке, чтобы увидеть подробности
          и занятия.
        </p>
      ) : (
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">
            {selected?.name ?? activeCabinet}
          </h2>
          {selected && (
            <>
              <span className="badge mt-1.5 bg-slate-100 dark:bg-slate-800 text-[var(--text)]">
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </span>
              {selected.description && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                  {selected.description}
                </p>
              )}
            </>
          )}

          <h3 className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm font-bold text-[var(--text)]">
            {selectedDate === today
              ? 'Сегодня здесь'
              : `Занятия на ${formatDate(selectedDate)}`}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
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
            <p className="mt-2 text-sm text-[var(--text-muted)]">Загружаем…</p>
          )}
          {rowsState === 'done' && todayRows.length === 0 && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              На эту дату занятий в этом кабинете нет.
            </p>
          )}
          {rowsState === 'done' && todayRows.length > 0 && (
            <div className="mt-2 space-y-2">
              {todayRows.map((row) => (
                <div key={row.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 text-sm">
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
                  <p className="mt-1 font-medium text-[var(--text)]">{row.subject}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {row.group_name}
                    {row.teacher ? ` · ${row.teacher}` : ''}
                  </p>
                  {timeByLesson.get(row.lesson) && (
                    <p className="text-xs text-[var(--text-muted)]">
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
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Карта</h1>
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
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">
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
                  setSelectedCabinet(null);
                  setImageLoaded(false);
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
                    <div className="relative min-h-[320px] sm:min-h-[420px] w-full overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                      {!imageLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-pulse bg-slate-100 dark:bg-slate-900 text-sm text-[var(--text-muted)]">
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                          <span>Загрузка схемы этажа…</span>
                        </div>
                      )}
                      <img
                        key={activeFloor.image_url}
                        src={activeFloor.image_url}
                        alt={`${activeFloor.title} — схема этажа`}
                        onLoad={() => setImageLoaded(true)}
                        className={cn(
                          'w-full rounded-lg transition-opacity duration-300',
                          imageLoaded ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </div>
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
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Схема этажа пока не загружена.
                  </p>
                )}
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
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
                <p className="card p-6 text-center text-sm text-[var(--text-muted)]">
                  На этом этаже пока нет отмеченных кабинетов.
                </p>
              ) : (
                <div className="card flex flex-wrap gap-2 p-4">
                  {floorObjects.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(o.id);
                        setSelectedCabinet(null);
                      }}
                      className={cn(
                        'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-200',
                        o.id === selectedId
                          ? 'border-blue-600 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30',
                        o.id === selectedId && 'ring-2 ring-cyan-500'
                      )}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              )}
            {/* Кабинеты из расписания, не отмеченные на схеме (жд*, с/з, а/з) */}
            {corpus === 2 && (extraCabinets.length > 0 || extraLoading || extraError) && (
              <div className="card p-4">
                <h3 className="text-sm font-bold text-[var(--text)]">
                  Кабинеты из расписания
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  ЖД-корпус, спортзал и актовый зал — схемы нет, но занятия есть.
                </p>
                {extraLoading && (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем…</p>
                )}
                {extraError && !extraLoading && extraCabinets.length === 0 && (
                  <p className="mt-3 text-sm text-red-500">Не удалось загрузить кабинеты.</p>
                )}
                {extraError && !extraLoading && extraCabinets.length > 0 && (
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Не удалось загрузить кабинеты. Показан базовый список.
                  </p>
                )}
                {!extraLoading && extraCabinets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extraCabinets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setSelectedCabinet(c);
                          setSelectedId(null);
                        }}
                        className={cn(
                          'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-200',
                          c === selectedCabinet
                            ? 'border-blue-600 bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                            : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30',
                          c === selectedCabinet && 'ring-2 ring-cyan-500'
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
