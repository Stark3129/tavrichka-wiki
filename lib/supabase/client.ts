import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase-клиент для браузера (Client Components, обработчики событий, хуки).
 * Вызывайте внутри компонентов/функций, а не на уровне модуля:
 * createBrowserClient кеширует экземпляр сам.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
