'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Кнопки модерации предложки: «Одобрить» публикует пост и переводит
 * предложку в approved; «Отклонить» — в rejected. После действия
 * обновляет серверные данные (router.refresh).
 */
export default function SuggestionActions({
  id,
  type,
  title,
  content,
}: {
  id: number;
  type: string;
  title: string;
  content: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function approve() {
    setBusy(true);
    setError('');
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from('posts').insert({
      type,
      title,
      content,
      status: 'published',
      author_id: userData.user?.id ?? null,
    });
    if (insErr) {
      setError('Не удалось опубликовать пост.');
      setBusy(false);
      return;
    }

    const { error: updErr } = await supabase
      .from('post_suggestions')
      .update({ status: 'approved' })
      .eq('id', id);
    if (updErr) {
      setError('Пост опубликован, но статус предложки не обновлён.');
      setBusy(false);
      return;
    }

    router.refresh();
    setBusy(false);
  }

  async function reject() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from('post_suggestions')
      .update({ status: 'rejected' })
      .eq('id', id);
    if (updErr) {
      setError('Не удалось отклонить предложку.');
      setBusy(false);
      return;
    }

    router.refresh();
    setBusy(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={approve} disabled={busy} className="btn btn-primary text-sm">
          Одобрить
        </button>
        <button type="button" onClick={reject} disabled={busy} className="btn btn-outline text-sm">
          Отклонить
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}