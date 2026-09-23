'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import RequireRole from '@/components/RequireRole';
import { cn, formatDate } from '@/lib/utils';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Post } from '@/lib/types';

const TYPES: Array<{ value: Post['type']; label: string }> = [
  { value: 'news', label: 'Новость' },
  { value: 'announce', label: 'Анонс' },
  { value: 'event', label: 'Событие' },
  { value: 'useful', label: 'Полезное' },
  { value: 'meme', label: 'Мем' },
];

const STATUS_LABELS: Record<Post['status'], { label: string; className: string }> = {
  published: { label: 'Опубликовано', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'На проверке', className: 'bg-amber-100 text-amber-700' },
  hidden: { label: 'Скрыто', className: 'bg-slate-200 dark:bg-slate-700 text-[var(--text-muted)]' },
};

export default function AdminPostsPage() {
  return (
    <RequireRole allowed={['admin', 'moderator']}>
      <AdminPostsPageInner />
    </RequireRole>
  );
}

function AdminPostsPageInner() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [type, setType] = useState<Post['type']>('news');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [createError, setCreateError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setListError('Не удалось загрузить посты.');
        else setPosts((data as Post[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError('');
    setOkMsg('');

    if (!title.trim() || !content.trim()) {
      setCreateError('Заполните заголовок и текст поста.');
      return;
    }

    setPublishing(true);
    const supabase = createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      const authorId = userData.user?.id ?? '';
      if (!authorId) throw new Error('Нет активной сессии. Перевойдите в систему.');

      let imageUrl = '';
      if (image) {
        if (image.size > 5 * 1024 * 1024) {
          setCreateError('Файл слишком большой (максимум 5MB).');
          setPublishing(false);
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
          setCreateError('Поддерживаются только JPG, PNG и WebP.');
          setPublishing(false);
          return;
        }
        const ext = image.name.includes('.') ? image.name.split('.').pop() : 'jpg';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('post-images')
          .upload(path, image, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error('Не удалось загрузить картинку в хранилище.');

        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error: insErr } = await supabase.from('posts').insert({
        type,
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl,
        author_id: authorId,
        status: 'published',
      });
      if (insErr) throw new Error('Не удалось сохранить пост.');

      setOkMsg('Пост опубликован.');
      setTitle('');
      setContent('');
      setImage(null);
      const { data } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setPosts((data as Post[] | null) ?? []);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Неизвестная ошибка.');
    } finally {
      setPublishing(false);
    }
  }

  async function setStatus(post: Post, status: Post['status']) {
    const supabase = createClient();
    const { error } = await supabase.from('posts').update({ status }).eq('id', post.id);
    if (!error) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status } : p)));
    }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Удалить пост «${post.title}»? Действие необратимо.`)) return;
    const supabase = createClient();
    // Сначала удаляем фото из Storage, потом сам пост.
    if (post.image_url) {
      const filePath = post.image_url.split('/post-images/')[1];
      if (filePath) {
        await supabase.storage.from('post-images').remove([filePath]);
      }
    }
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Админ', href: '/admin' }, { label: 'Посты' }]} />

      <form onSubmit={handleCreate} className="card p-4 sm:p-5">
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Новый пост</h1>

        <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="post-type" className="label">
              Тип
            </label>
            <select
              id="post-type"
              value={type}
              onChange={(e) => setType(e.target.value as Post['type'])}
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
            <label htmlFor="post-title" className="label">
              Заголовок
            </label>
            <input
              id="post-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="post-content" className="label">
            Текст
          </label>
          <textarea
            id="post-content"
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input resize-y"
          />
        </div>

        <div className="mt-3">
          <label htmlFor="post-image" className="label">
            Картинка (необязательно)
          </label>
          <input
            id="post-image"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700"
          />
        </div>

        {createError && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {createError}
          </p>
        )}
        {okMsg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {okMsg}
          </p>
        )}

        <button type="submit" disabled={publishing} className="btn btn-primary mt-4">
          {publishing ? 'Публикуем…' : 'Опубликовать пост'}
        </button>
      </form>

      <div className="card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--text)]">
          Все посты {posts.length > 0 && <span className="text-slate-400">({posts.length})</span>}
        </h2>

        {loading && <p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем…</p>}
        {listError && <p className="mt-3 text-sm text-rose-600">{listError}</p>}
        {!loading && !listError && posts.length === 0 && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Постов пока нет.</p>
        )}

        <div className="mt-3 space-y-3">
          {posts.map((p) => {
            const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.hidden;
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-indigo-50 text-indigo-700">{p.type}</span>
                  <span className={cn('badge', st.className)}>{st.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(p.created_at)}</span>
                </div>
                <h3 className="mt-1.5 font-bold text-[var(--text)]">{p.title}</h3>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-[var(--text-muted)]">
                  {p.content}
                </p>
                {p.image_url && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt={p.title || 'Фото'}
                      className="max-h-48 rounded-xl object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => setStatus(p, 'published')}
                      className="btn btn-outline text-xs"
                    >
                      Опубликовать
                    </button>
                  )}
                  {p.status !== 'hidden' && (
                    <button
                      type="button"
                      onClick={() => setStatus(p, 'hidden')}
                      className="btn btn-outline text-xs"
                    >
                      Скрыть
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
