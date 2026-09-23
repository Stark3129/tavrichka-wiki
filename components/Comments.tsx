'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { updateComment } from '@/lib/actions';
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
  const [userRole, setUserRole] = useState('user');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Проверяем авторизацию и роль сразу: гостям — подсказка, модераторам/админам
  // и авторам — кнопка удаления комментария.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        setUserRole(profile?.role || 'user');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isModerator = ['admin', 'moderator'].includes(userRole);

  async function deleteComment(commentId: string | number, commentAuthorId: string) {
    const isOwner = userId === commentAuthorId;
    if (!isOwner && !isModerator) {
      alert('У вас нет прав для удаления этого комментария');
      return;
    }
    if (!confirm('Удалить комментарий?')) return;

    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      alert('Ошибка: ' + error.message);
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditText(comment.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit() {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    try {
      const result = await updateComment(editingId, editText);
      if (!result.ok) {
        alert('Ошибка: ' + result.message);
      } else {
        // Оптимистичное обновление без перезагрузки.
        setComments((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? { ...c, text: editText.trim(), updated_at: new Date().toISOString() }
              : c
          )
        );
        setEditingId(null);
        setEditText('');
      }
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : 'неизвестная'));
    }
    setSaving(false);
  }

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
            className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 p-3"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text)]">
                {comment.profiles?.username || 'Аноним'}
              </span>
              <span className="ml-auto shrink-0 text-xs text-[var(--text-muted)]">
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                  locale: ru,
                })}
                {new Date(comment.updated_at ?? comment.created_at).getTime() -
                  new Date(comment.created_at).getTime() >
                  60000 && (
                  <span className="italic text-[var(--text-muted)]"> (ред.)</span>
                )}
              </span>
            </div>
            {editingId === comment.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="input resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editText.trim()}
                    className="btn btn-primary !px-3 !py-1 text-xs disabled:opacity-50"
                  >
                    {saving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text)] transition hover:bg-[var(--bg)] disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-line text-sm text-[var(--text)]">
                  {comment.text}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {(userId === comment.author_id || isModerator) && (
                    <>
                      <button
                        onClick={() => startEdit(comment)}
                        className="text-xs text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                        title="Редактировать комментарий"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => deleteComment(comment.id, comment.author_id)}
                        className="text-xs text-red-500 opacity-60 transition hover:text-red-600 hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
                        title="Удалить комментарий"
                      >
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}