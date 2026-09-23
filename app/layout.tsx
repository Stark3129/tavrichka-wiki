import type { Metadata } from 'next';
import Header from '@/components/Header';
import SearchModal from '@/components/SearchModal';
import { SearchProvider } from '@/lib/search-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Тавричка Вики',
    template: '%s — Тавричка Вики',
  },
  description:
    'Студенческий портал колледжа: лента постов, замены, расписание, преподаватели и карта корпусов.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
        <SearchProvider>
          <Header />
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
