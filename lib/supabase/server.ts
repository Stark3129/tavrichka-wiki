import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase-клиент для серверных компонентов, Route Handlers и Server Actions.
 * В Next.js 15 cookies() асинхронный, поэтому функция возвращает Promise.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Из серверного компонента cookies писать нельзя — это нормально.
            // Обновление сессии выполнится в Server Action / Route Handler / middleware.
          }
        },
      },
    }
  );
}
