import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { updateFeedbackStatus, deleteFeedback } from '@/lib/actions';

export const metadata = { title: 'Обратная связь — Админ' };

const TYPE_BADGES: Record<string, string> = {
  bug: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  feature: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  improvement: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
};

const TYPE_LABELS: Record<string, string> = {
  bug: '🐛 Баг',
  feature: '✨ Функция',
  improvement: '💡 Улучшение',
  other: '💬 Другое',
};

const STATUS_BADGES: Record<string, string> = {
  new: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  resolved: 'Решено',
  rejected: 'Отклонено',
};

/** Проверка роли внутри server actions. */

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/auth');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (!profile || !['admin', 'moderator'].includes(profile.role)) redirect('/');

  const { data: feedbacks } = await supabase
    .from('site_feedback')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[var(--text)]">Обратная связь 💬</h1>

      {!feedbacks || feedbacks.length === 0 ? (
        <div className="card p-8 text-center text-[var(--text-muted)]">
          Пока нет сообщений
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb) => {
            const typeBadge = TYPE_BADGES[fb.type] ?? TYPE_BADGES.other;
            const typeLabel = TYPE_LABELS[fb.type] ?? TYPE_LABELS.other;
            const statusBadge = STATUS_BADGES[fb.status] ?? STATUS_BADGES.new;
            const statusLabel = STATUS_LABELS[fb.status] ?? STATUS_LABELS.new;
            return (
              <div key={fb.id} className="card p-6">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeBadge}`}>
                        {typeLabel}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text)]">{fb.title}</h3>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {fb.author_name || 'Аноним'}
                      {fb.author_email ? ` • ${fb.author_email}` : ''} • {formatDate(fb.created_at)}
                    </div>
                  </div>
                  <form action={deleteFeedback}>
                    <input type="hidden" name="id" value={fb.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-500 transition hover:text-red-600 dark:text-red-400"
                    >
                      Удалить
                    </button>
                  </form>
                </div>

                <p className="mb-4 whitespace-pre-wrap text-sm text-[var(--text)]">
                  {fb.description}
                </p>

                {fb.admin_note && (
                  <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
                    <div className="mb-1 text-xs font-medium text-cyan-600 dark:text-cyan-400">
                      Заметка админа:
                    </div>
                    <div className="text-sm text-[var(--text)]">{fb.admin_note}</div>
                  </div>
                )}

                <form action={updateFeedbackStatus} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={fb.id} />
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Статус</label>
                    <select
                      name="status"
                      defaultValue={fb.status}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]"
                    >
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="resolved">Решено</option>
                      <option value="rejected">Отклонено</option>
                    </select>
                  </div>
                  <div className="min-w-[300px] flex-[2]">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">
                      Заметка (необязательно)
                    </label>
                    <input
                      name="note"
                      defaultValue={fb.admin_note || ''}
                      placeholder="Комментарий для себя"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary !px-4 !py-1.5 text-sm">
                    Сохранить
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}