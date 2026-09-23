import { createClient } from '@/lib/supabase/server';
import MapExplorer from '@/components/MapExplorer';
import type { LessonTime, MapFloor, MapObject } from '@/lib/types';

export const metadata = { title: 'Карта' };

/** Текущая дата по московскому времени в формате ГГГГ-ММ-ДД. */
function todayIso(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
    new Date()
  );
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ corpus?: string }>;
}) {
  const { corpus = '' } = await searchParams;
  const corpusNum = Number(corpus) || 1;

  const supabase = await createClient();

  const [floorsRes, objectsRes, timesRes] = await Promise.all([
    supabase
      .from('map_floors')
      .select('*')
      .eq('corpus', corpusNum)
      .order('sort', { ascending: true }),
    supabase.from('map_objects').select('*').eq('corpus', corpusNum),
    supabase.from('lesson_times').select('*').order('lesson', { ascending: true }),
  ]);

  const floors = (floorsRes.data as MapFloor[] | null) ?? [];
  const objects = (objectsRes.data as MapObject[] | null) ?? [];
  const times = (timesRes.data as LessonTime[] | null) ?? [];

  // Список корпусов — из всех этажей карты.
  const { data: allFloors } = await supabase
    .from('map_floors')
    .select('corpus');
  const corpusOptions = Array.from(
    new Set((allFloors ?? []).map((f) => Number(f.corpus)))
  ).sort((a, b) => a - b);

  return (
    <MapExplorer
      corpus={corpusNum}
      corpusOptions={corpusOptions.length ? corpusOptions : [corpusNum]}
      floors={floors}
      objects={objects}
      times={times}
      today={todayIso()}
    />
  );
}
