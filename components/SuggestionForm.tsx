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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
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
      // Загрузка фото в Storage (если выбрано).
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        const fileExt = imageFile.name.includes('.')
          ? imageFile.name.split('.').pop()
          : 'jpg';
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          setError('Ошибка загрузки фото: ' + uploadError.message);
          setUploading(false);
          setBusy(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
        setUploading(false);
      }

      const result = await createPost({
        title: title.trim(),
        content: content.trim(),
        type,
        image_url: imageUrl,
      });
      setBusy(false);
      if (result.ok) {
        setSent(true);
        setTitle('');
        setContent('');
        setAuthorName('');
        setImageFile(null);
        setImagePreview('');
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

        <div>
          <label className="label">Фото (необязательно)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  alert('Файл слишком большой (максимум 5MB)');
                  return;
                }
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
              }
            }}
            className="w-full rounded-xl border border-[var(--border)] px-4 py-2 bg-[var(--bg)] text-[var(--text)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cyan-500 file:text-white hover:file:bg-cyan-600"
          />
          {imagePreview && (
            <div className="mt-2 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Превью" className="max-h-48 rounded-lg" />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview('');
                }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {sent && (
          <p className="text-sm font-medium text-emerald-600">
            Пост отправлен на модерацию!
          </p>
        )}

        <button
          type="submit"
          disabled={busy || uploading}
          className="btn btn-primary"
        >
          {uploading ? 'Загрузка...' : busy ? 'Отправляем…' : 'Отправить'}
        </button>
      </div>
    </form>
  );
}