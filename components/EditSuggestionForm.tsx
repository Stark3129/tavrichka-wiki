'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Teacher } from '@/lib/types';

type EditableField = 'subject' | 'cabinet' | 'email' | 'consultation' | 'description';

const FIELDS: Array<{ value: EditableField; label: string }> = [
  { value: 'subject', label: 'Предмет' },
  { value: 'cabinet', label: 'Кабинет' },
  { value: 'email', label: 'Почта' },
  { value: 'consultation', label: 'Консультации' },
  { value: 'description', label: 'Описание' },
];

export default function EditSuggestionForm({ teacher }: { teacher: Teacher }) {
  const [authState, setAuthState] = useState<'loading' | 'anon' | 'authed'>('loading');
  const [userId, setUserId] = useState<string>('');
  const [field, setField] = useState<EditableField>('subject');
  const [oldValue, setOldValue] = useState<string>(teacher.subject);
  const [newValue, setNewValue] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setAuthState('authed');
        setUserId(data.user.id);
      } else {
        setAuthState('anon');
      }
    });
  }, []);

  function handleFieldChange(next: EditableField) {
    setField(next);
    setOldValue((teacher[next] as string) ?? '');
    setNewValue('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');
    setSending(true);

    const supabase = createClient();
    const { error } = await supabase.from('teacher_edits').insert({
      teacher_id: teacher.id,
      field,
      old_value: oldValue,
      new_value: newValue,
      comment,
      author_id: userId,
      status: 'pending',
    });

    if (error) {
      setErrorMsg('Не удалось отправить правку. Попробуйте ещё раз.');
      setSending(false);
      return;
    }

    setDone(true);
    setNewValue('');
    setComment('');
    setSending(false);
  }

  if (authState === 'loading') {
    return <p className="text-sm text-slate-500">Проверяем вход…</p>;
  }

  if (authState === 'anon') {
    return (
      <div className="card p-4 text-sm text-slate-600">
        Форма «Предложить правку» доступна только авторизованным пользователям.{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 sm:p-5">
      <h2 className="text-lg font-bold text-slate-900">Предложить правку</h2>
      <p className="mt-1 text-sm text-slate-500">
        Правка попадёт на проверку модератору и появится после одобрения.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-field" className="label">
            Что меняем
          </label>
          <select
            id="edit-field"
            value={field}
            onChange={(e) => handleFieldChange(e.target.value as EditableField)}
            className="input"
          >
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="edit-old" className="label">
            Текущее значение
          </label>
          <input
            id="edit-old"
            type="text"
            value={oldValue}
            onChange={(e) => setOldValue(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="edit-new" className="label">
          Новое значение
        </label>
        <textarea
          id="edit-new"
          required
          rows={3}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Что должно быть вместо текущего"
          className="input resize-y"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="edit-comment" className="label">
          Комментарий (необязательно)
        </label>
        <input
          id="edit-comment"
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Поясните, откуда данные"
          className="input"
        />
      </div>

      {done && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Спасибо! Правка отправлена на проверку.
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMsg}
        </p>
      )}

      <button type="submit" disabled={sending || newValue.trim() === ''} className="btn btn-primary mt-4">
        {sending ? 'Отправляем…' : 'Отправить правку'}
      </button>
    </form>
  );
}
