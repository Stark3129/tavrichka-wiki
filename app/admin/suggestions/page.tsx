import Breadcrumbs from '@/components/Breadcrumbs';
import SuggestionActions from '@/components/SuggestionActions';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Предложки' };

const TYPE_BADGES: Record<string, string> = {
  news: 'bg-sky-100 text-sky-800',
  meme: 'bg-amber-100 text-amber-800',
  announce: 'bg-violet-100 text-violet-800',
  useful: 'bg-emerald-100 text-emerald-800',
  event: 'bg-rose-100 text-rose-800',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

interface Suggestion {
  id: number;
  type: string;
  title: string;
  content: string;
  author_name: string | null;
  status: string;
  created_at: string;
}

export default async function AdminSuggestionsPage() {
  const supabase = await createClient();

  const { data: pendingData } = await supabase
    .from('post_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const { data: processedData } = await supabase
    .from('post_suggestions')
    .select('*')
    .in('status', ['approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(20);

  const pending = (pendingData as Suggestion[] | null) ?? [];
  const processed = (processedData as Suggestion[] | null) ?? [];

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Админ', href: '/admin' }, { label: 'Предложки' }]} />

      <h1 className="text-2xl font-extrabold text-slate-900">
        Предложки{pending.length > 0 ? ` (${pending.length})` : ''}
      </h1>

      {pending.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">
          Новых предложений нет.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`badge ${TYPE_BADGES[s.type] ?? 'bg-slate-100 text-slate-700'}`}
                >
                  {s.type}
                </span>
                <h2 className="font-bold text-slate-900">{s.title}</h2>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{s.content}</p>
              <p className="mt-2 text-xs text-slate-500">
                {s.author_name || 'Анонимно'} · {formatDate(s.created_at)}
              </p>
              <div className="mt-3">
                <SuggestionActions
                  id={s.id}
                  type={s.type}
                  title={s.title}
                  content={s.content}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-900">
          Обработанные (последние 20) — {processed.length}
        </summary>
        {processed.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Пока ничего не обработано.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {processed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 last:border-b-0">
                <span
                  className={`badge ${TYPE_BADGES[s.type] ?? 'bg-slate-100 text-slate-700'}`}
                >
                  {s.type}
                </span>
                <span className="font-medium text-slate-900">{s.title}</span>
                <span
                  className={
                    s.status === 'approved' ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'
                  }
                >
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {formatDate(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}