'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Comment } from '@/lib/types';

/**
 * Комментарии под постом. Писать могут только авторизованные
 * (RLS в Supabase дополнительно страхует).
 */
export default function Comments({
  postId,
  initialComments,
}: {
  postId: number | string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  // Проверяем авторизацию сразу, чтобы неавторизованным показать подсказку.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    setNotice('');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setNotice('Необходима авторизация — войдите через /auth');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: userData.user.id,
        text: newComment.trim(),
      })
      .select('*, profiles(username)')
      .single();

    if (error || !data) {
      setNotice('Не удалось отправить комментарий.');
    } else {
      setComments([...comments, data as Comment]);
      setNewComment('');
    }
    setLoading(false);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">
        💬 Комментарии ({comments.length})
      </h3>

      {!userId ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 px-3 py-2 text-sm text-[var(--text-muted)]">
          <Link
            href="/auth"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Войдите
          </Link>
          , чтобы комментировать
        </p>
      ) : (
        <form onSubmit={addComment} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать комментарий…"
            className="input resize-none"
            rows={2}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary !px-4 !py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Отправка…' : 'Отправить'}
            </button>
            {notice && (
              <span className="text-xs text-rose-600 dark:text-rose-400">{notice}</span>
            )}
          </div>
        </form>
      )}

      <div className="space-y-2">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text)]">
                {comment.profiles?.username || 'Аноним'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-[var(--text)]">
              {comment.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}