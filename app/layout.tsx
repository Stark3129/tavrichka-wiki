import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/Header';
import SearchModal from '@/components/SearchModal';
import { SearchProvider } from '@/lib/search-context';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import './globals.css';

// Единый шрифт сайта: Inter с поддержкой кириллицы.
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Тавричка Вики',
    template: '%s — Тавричка Вики',
  },
  description:
    'Студенческий портал колледжа: лента постов, замены, расписание, преподаватели и карта корпусов.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Пользователь и роль получаем на сервере и передаём в Header пропсами.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user: User | null = data?.user ?? null;

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

  return (
    <html lang="ru">
      <body
        className={`flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)] ${inter.variable} font-sans`}
      >
        {/* Живой фон: сетка, точки и плавающие градиентные пятна (чистый CSS) */}
        <div className="bg-grid" />
        <div className="bg-dots" />
        <div className="bg-gradient-blob blob-1" />
        <div className="bg-gradient-blob blob-2" />
        <div className="bg-gradient-blob blob-3" />
        <div className="bg-gradient-blob blob-4" />
        <div className="bg-gradient-blob blob-5" />
        <SearchProvider>
          <Header user={user} isAdmin={isAdmin} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
          {/* Модалка поиска (глобально) + обработчик Ctrl/Cmd+K внутри неё */}
          <SearchModal />
        </SearchProvider>
      </body>
    </html>
  );
}
