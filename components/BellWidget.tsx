'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, BookOpen, Clock, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMyGroup, subscribeMyGroup } from '@/lib/my-group';
import { mergeScheduleRows } from '@/lib/schedule-merge';
import { cn } from '@/lib/utils';
import type { LessonTime, ScheduleRow } from '@/lib/types';

/** Преобразует строку "ЧЧ:ММ" или "ЧЧ:ММ:СС" в минуты от полуночи */
function toMinutes(hhmmss: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmmss.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Форматирует остаток времени: "12 мин" или "1 ч 15 мин" */
function formatCountdown(minutes: number): string {
  if (minutes <= 0) return '0 мин';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  return `${m} мин`;
}

/** Получает компоненты текущего времени по Москве */
function getMoscowNow(): {
  nowMin: number;
  dayOfWeek: number;
  timeStr: string;
  todayIso: string;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const weekday = get('weekday'); // 'Sun', 'Mon', etc.
  const hour = Number(get('hour'));
  const min = Number(get('minute'));

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    nowMin: hour * 60 + min,
    dayOfWeek: dayMap[weekday] ?? now.getDay(),
    timeStr: `${pad(hour)}:${pad(min)}`,
    todayIso: `${year}-${month}-${day}`,
  };
}

function weekdayRu(iso: string): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Стандартные звонки колледжа как резерв
const DEFAULT_TIMES: LessonTime[] = [
  { lesson: 1, start_time: '08:00:00', end_time: '09:30:00' },
  { lesson: 2, start_time: '09:50:00', end_time: '11:20:00' },
  { lesson: 3, start_time: '11:30:00', end_time: '13:00:00' },
  { lesson: 4, start_time: '13:20:00', end_time: '14:50:00' },
  { lesson: 5, start_time: '15:00:00', end_time: '16:30:00' },
  { lesson: 6, start_time: '16:40:00', end_time: '18:10:00' },
];

export default function BellWidget({
  initialTimes,
}: {
  initialTimes?: LessonTime[];
}) {
  const [mounted, setMounted] = useState(false);
  const [times, setTimes] = useState<LessonTime[]>(initialTimes?.length ? initialTimes : DEFAULT_TIMES);
  const [myGroup, setMyGroupState] = useState<string | null>(null);
  const [nextLesson, setNextLesson] = useState<ScheduleRow | null>(null);
  const [groupHasLessonsToday, setGroupHasLessonsToday] = useState(false);
  const [clock, setClock] = useState(() => getMoscowNow());

  useEffect(() => {
    setMounted(true);
    setMyGroupState(getMyGroup());

    // Обновление каждую секунду/30 секунд
    const timer = setInterval(() => {
      setClock(getMoscowNow());
    }, 30000);

    // Подписка на изменение выбранной группы
    const unsub = subscribeMyGroup((group) => {
      setMyGroupState(group);
    });

    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  // Если звонки не были переданы, загружаем из Supabase
  useEffect(() => {
    if (initialTimes?.length) return;
    const supabase = createClient();
    supabase
      .from('lesson_times')
      .select('*')
      .order('lesson', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTimes(data as LessonTime[]);
        }
      });
  }, [initialTimes]);

  // Загрузка расписания "Моей группы" на сегодня
  useEffect(() => {
    if (!myGroup) {
      setNextLesson(null);
      setGroupHasLessonsToday(false);
      return;
    }

    const { todayIso, nowMin } = clock;
    const supabase = createClient();
    const day = weekdayRu(todayIso);

    // Параллельно загружаем недельный шаблон, замены на сегодня и постоянные изменения
    Promise.all([
      supabase
        .from('schedule_rows')
        .select('*')
        .is('date', null)
        .eq('group_name', myGroup)
        .ilike('day_week', day)
        .order('lesson', { ascending: true }),
      supabase
        .from('schedule_rows')
        .select('*')
        .eq('group_name', myGroup)
        .eq('date', todayIso)
        .order('lesson', { ascending: true }),
      supabase
        .from('schedule_rows')
        .select('*')
        .eq('group_name', myGroup)
        .eq('type', 'permanent')
        .lte('date', todayIso)
        .order('date', { ascending: false }),
    ]).then(([tplRes, datedRes, permRes]) => {
      const tpl = (tplRes.data as ScheduleRow[] | null) ?? [];
      const dated = (datedRes.data as ScheduleRow[] | null) ?? [];
      const perm = (permRes.data as ScheduleRow[] | null) ?? [];
      const todayRows = mergeScheduleRows(tpl, [...dated, ...perm], undefined, todayIso).sort(
        (a, b) => a.lesson - b.lesson
      );

      setGroupHasLessonsToday(todayRows.length > 0);

      // Сопоставляем со временем звонков и ищем следующую пару после текущего времени
      const timeMap = new Map<number, { startMin: number; endMin: number }>();
      times.forEach((t) => {
        timeMap.set(t.lesson, {
          startMin: toMinutes(t.start_time),
          endMin: toMinutes(t.end_time),
        });
      });

      // Ищем первую пару, которая ещё не закончилась или ещё впереди
      const upcoming = todayRows.find((r) => {
        const t = timeMap.get(r.lesson);
        // Если пара ещё не закончилась (или ещё не началась)
        return t ? t.endMin > nowMin : false;
      });

      setNextLesson(upcoming ?? null);
    });
  }, [myGroup, clock.todayIso, clock.nowMin, times]);

  // Сортированный список звонков с минутами
  const parsedTimes = useMemo(() => {
    return [...times]
      .sort((a, b) => a.lesson - b.lesson)
      .map((t) => ({
        lesson: t.lesson,
        startTime: t.start_time.slice(0, 5),
        endTime: t.end_time.slice(0, 5),
        startMin: toMinutes(t.start_time),
        endMin: toMinutes(t.end_time),
      }));
  }, [times]);

  // Расчёт текущего статуса звонков
  const status = useMemo(() => {
    const { nowMin, dayOfWeek, timeStr } = clock;

    // Выходной (суббота или воскресенье)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        type: 'weekend' as const,
        badge: 'Выходной',
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
        title: 'Сегодня выходной 😴',
        subtitle: 'Пары начнутся в понедельник',
        timeStr,
      };
    }

    if (parsedTimes.length === 0) {
      return {
        type: 'unknown' as const,
        badge: 'Звонки',
        badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        title: 'Расписание звонков',
        subtitle: 'Загрузка данных…',
        timeStr,
      };
    }

    const first = parsedTimes[0];
    const last = parsedTimes[parsedTimes.length - 1];

    // До первой пары
    if (nowMin < first.startMin) {
      const rem = first.startMin - nowMin;
      return {
        type: 'before' as const,
        badge: 'До начала пар',
        badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
        title: `Пары начнутся в ${first.startTime}`,
        subtitle: `До 1 пары осталось ${formatCountdown(rem)}`,
        timeStr,
      };
    }

    // После последней пары
    if (nowMin >= last.endMin) {
      return {
        type: 'after' as const,
        badge: 'Конец пар',
        badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
        title: 'Пары на сегодня всё 🎉',
        subtitle: 'Отдыхай или готовься к завтрашнему дню',
        timeStr,
      };
    }

    // Проверяем: идёт пара или перемена
    for (let i = 0; i < parsedTimes.length; i++) {
      const cur = parsedTimes[i];

      // Идёт пара
      if (nowMin >= cur.startMin && nowMin < cur.endMin) {
        const rem = cur.endMin - nowMin;
        return {
          type: 'lesson' as const,
          badge: 'Идёт пара',
          badgeClass: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-xs',
          title: `Сейчас ${cur.lesson} пара · осталось ${formatCountdown(rem)}`,
          subtitle: `Время пары: ${cur.startTime}–${cur.endTime}`,
          timeStr,
        };
      }

      // Перемена между текущей и следующей
      const next = parsedTimes[i + 1];
      if (next && nowMin >= cur.endMin && nowMin < next.startMin) {
        const rem = next.startMin - nowMin;
        return {
          type: 'break' as const,
          badge: 'Перемена',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
          title: `Перемена · следующая ${next.lesson} пара в ${next.startTime}`,
          subtitle: `До звонка осталось ${formatCountdown(rem)}`,
          timeStr,
        };
      }
    }

    return {
      type: 'general' as const,
      badge: 'Учебный день',
      badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      title: 'Учебное время',
      subtitle: '',
      timeStr,
    };
  }, [clock, parsedTimes]);

  // Защита от SSR-рассинхрона (hydration mismatch)
  if (!mounted) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent p-4 sm:p-5 shadow-lg lg:col-span-3">
        <div className="flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 glass-card bg-transparent p-4 sm:p-5 shadow-lg transition-transform duration-200 md:hover:-translate-y-0.5 lg:col-span-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Левая часть: статус звонков и крупный заголовок */}
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors',
              status.type === 'lesson'
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white animate-pulse'
                : 'bg-slate-100 text-cyan-600 dark:bg-slate-800 dark:text-cyan-400'
            )}
          >
            {status.type === 'lesson' ? (
              <Bell className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('badge text-xs', status.badgeClass)}>
                {status.badge}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                МСК {status.timeStr}
              </span>
            </div>

            <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-[var(--text)]">
              {status.title}
            </h2>

            {status.subtitle && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {status.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Правая часть: быстрый переход в расписание звонков */}
        <div className="self-end sm:self-center">
          <Link
            href="/schedule"
            className="btn btn-outline !px-3 !py-1.5 text-xs font-medium"
          >
            Расписание →
          </Link>
        </div>
      </div>

      {/* Дополнительная строка: следующая пара выбранной группы */}
      <div className="mt-3.5 border-t border-[var(--border)] pt-3 text-xs sm:text-sm">
        {myGroup ? (
          nextLesson ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[var(--text)]">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                Дальше у <strong className="font-bold text-cyan-600 dark:text-cyan-400">{myGroup}</strong>:{' '}
                <span className="font-semibold">{nextLesson.subject}</span>
                {nextLesson.cabinet ? (
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {', каб. '}{nextLesson.cabinet}
                  </span>
                ) : (
                  ''
                )}
                {nextLesson.teacher ? ` (${nextLesson.teacher})` : ''}
              </span>
              {nextLesson.type === 'permanent' && (
                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  постоянно
                </span>
              )}
              {nextLesson.type === 'замена' && (
                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  замена
                </span>
              )}
            </div>
          ) : groupHasLessonsToday ? (
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <BookOpen className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                У группы <strong className="text-[var(--text)]">{myGroup}</strong> пары на сегодня закончились 🎉
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <BookOpen className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                У группы <strong className="text-[var(--text)]">{myGroup}</strong> сегодня нет занятий в расписании.
              </span>
            </div>
          )
        ) : (
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline"
          >
            <span>💡 Выбери свою группу в расписании — и я подскажу кабинет →</span>
          </Link>
        )}
      </div>
    </section>
  );
}
