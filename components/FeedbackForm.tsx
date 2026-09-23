'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const TYPES = [
  { value: 'bug', label: '🐛 Баг', desc: 'Что-то не работает' },
  { value: 'feature', label: '✨ Новая функция', desc: 'Хочу чтобы добавили' },
  { value: 'improvement', label: '💡 Улучшение', desc: 'Как сделать лучше' },
  { value: 'other', label: '💬 Другое', desc: 'Всё остальное' },
];

/**
 * Форма обратной связи на странице /about.
 * Авторизованным подставляются имя и email (поля заблокированы),
 * гостевые сообщения отправляются анонимно.
 */
export default function FeedbackForm() {
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (stale || !data.user) return;
      setUser(data.user);
      setAuthorEmail(data.user.email || '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single();
      if (!stale && profile) setAuthorName(profile.username || '');
    })();
    return () => {
      stale = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!title.trim() || !description.trim()) {
      setError('Заполните заголовок и описание');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from('site_feedback').insert({
      author_id: user?.id || null,
      author_name: authorName.trim() || 'Аноним',
      author_email: authorEmail || null,
      type,
      title: title.trim(),
      description: description.trim(),
      status: 'new',
    });

    if (insertError) {
      setError('Не удалось отправить. Попробуйте ещё раз.');
    } else {
      setSuccess('Спасибо! Ваше сообщение отправлено. Мы его прочитаем.');
      setTitle('');
      setDescription('');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Тип обращения */}
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text)]">
          Тип обращения
        </label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-xl border p-3 text-left transition ${
                type === t.value
                  ? 'border-cyan-500 bg-cyan-500/10 text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-cyan-300 dark:hover:border-cyan-700'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="mt-0.5 text-xs">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Заголовок */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text)]">
          Заголовок
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко опишите проблему или идею"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Описание */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text)]">
          Описание
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Подробно опишите баг, идею или предложение. Чем больше деталей — тем лучше!"
          rows={5}
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Имя и email */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">
            Имя {user ? '(авто)' : '(необязательно)'}
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Как к вам обращаться"
            disabled={!!user}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">
            Email {user ? '(авто)' : '(необязательно)'}
          </label>
          <input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="Для обратной связи"
            disabled={!!user}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Сообщения */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Кнопка */}
      <button type="submit" disabled={loading} className="btn btn-primary !px-6 !py-2.5 disabled:opacity-50">
        {loading ? 'Отправка…' : 'Отправить'}
      </button>
    </form>
  );
}