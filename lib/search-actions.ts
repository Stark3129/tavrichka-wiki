'use server';

import { createClient } from '@/lib/supabase/server';

export interface SearchResults {
  posts: Array<{ id: number; title: string; type: string }>;
  teachers: Array<{ id: number; full_name: string; subject: string }>;
  cabinets: Array<{ id: number; name: string; room: string; floor: number }>;
}

const EMPTY: SearchResults = { posts: [], teachers: [], cabinets: [] };

/** Глобальный поиск по сайту: посты, преподаватели, кабинеты карты. */
export async function searchSite(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return EMPTY;

  const pattern = `%${q}%`;
  const supabase = await createClient();

  const [postsRes, teachersRes, cabinetsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, type')
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .eq('status', 'published')
      .limit(5),
    supabase
      .from('teachers')
      .select('id, full_name, subject')
      .or(`full_name.ilike.${pattern},subject.ilike.${pattern}`)
      .eq('status', 'published')
      .limit(5),
    supabase
      .from('map_objects')
      .select('id, name, room, floor')
      .or(`name.ilike.${pattern},room.ilike.${pattern}`)
      .limit(5),
  ]);

  if (postsRes.error || teachersRes.error || cabinetsRes.error) {
    throw new Error('search_failed');
  }

  return {
    posts: (postsRes.data as SearchResults['posts'] | null) ?? [],
    teachers: (teachersRes.data as SearchResults['teachers'] | null) ?? [],
    cabinets: (cabinetsRes.data as SearchResults['cabinets'] | null) ?? [],
  };
}