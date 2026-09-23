'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createPost } from '@/lib/actions';

const TYPES = [
  { value: 'news', label: 'Новость' },
  { value: 'meme', label: 'Мем' },
  { value: 'announce', label: 'Анонс' },
  { value: 'useful', label: 'Полезное' },
  { value: 'event', label: 'Событие' },
] as const;

/**
 * Форма «предложки»: студенты предлагают новости/мемы/идеи.
 * Пишет в post_suggestions со status 'pending' — публикация только
 * после одобрения модератором в /admin/suggestions.
 */
export default function SuggestionForm() {
  const [type, setType] = useState<string>('news');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSent(false);

    if (!title.trim() || !content.trim()) {
      setError('Заполните заголовок и текст.');
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // Авторизованный пользователь -> пост сразу в posts (status 'pending'),
    // с фильтрацией мата в server action createPost.
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const result = await createPost({ title: title.trim(), content: content.trim(), type });
      setBusy(false);
      if (result.ok) {
        setSent(true);
        setTitle('');
        setContent('');
        setAuthorName('');
      } else {
        setError(result.message);
      }
      return;
    }

    // Гость -> классическая предложка в post_suggestions.
    const { error: insErr } = await supabase.from('post_suggestions').insert({
      type,
      title: title.trim(),
      content: content.trim(),
      author_name: authorName.trim() || null,
      status: 'pending',
    });

    if (insErr) {
      setError('Не удалось отправить. Попробуйте ещё раз.');
      setBusy(false);
      return;
    }

    setSent(true);
    setTitle('');
    setContent('');
    setAuthorName('');
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4">
      <div className="grid gap-3">
        <div>
          <label htmlFor="sug-type" className="label">
            Тип
          </label>
          <select
            id="sug-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sug-title" className="label">
            Заголовок
          </label>
          <input
            id="sug-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="sug-content" className="label">
            Текст
          </label>
          <textarea
            id="sug-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="input resize-y"
          />
        </div>

        <div>
          <label htmlFor="sug-author" className="label">
            Имя (необязательно)
          </label>
          <input
            id="sug-author"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="input"
            maxLength={100}
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {sent && (
          <p className="text-sm font-medium text-emerald-600">
            Пост отправлен на модерацию!
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? 'Отправляем…' : 'Отправить'}
        </button>
      </div>
    </form>
  );
}