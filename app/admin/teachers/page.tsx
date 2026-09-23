'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Teacher, TeacherEdit } from '@/lib/types';

const STATUS_BADGE: Record<Teacher['status'], string> = {
  published: 'bg-emerald-100 text-emerald-700',
  hidden: 'bg-slate-200 dark:bg-slate-700 text-[var(--text-muted)]',
};

const FIELD_LABELS: Record<string, string> = {
  subject: 'Предмет',
  cabinet: 'Кабинет',
  email: 'Почта',
  consultation: 'Консультации',
  description: 'Описание',
  full_name: 'ФИО',
  photo: 'Фото',
};

const EMPTY_FORM = {
  full_name: '',
  subject: '',
  cabinet: '',
  email: '',
  consultation: '',
  description: '',
  status: 'published' as Teacher['status'],
};

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [edits, setEdits] = useState<TeacherEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null); // null = создание
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function reload() {
    const supabase = createClient();
    const [tRes, eRes] = await Promise.all([
      supabase.from('teachers').select('*').order('full_name', { ascending: true }).limit(500),
      supabase
        .from('teacher_edits')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (tRes.error || eRes.error) {
      setListError('Не удалось загрузить данные преподавателей.');
    } else {
      setTeachers((tRes.data as Teacher[] | null) ?? []);
      setEdits((eRes.data as TeacherEdit[] | null) ?? []);
      setListError('');
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setPhotoFile(null);
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id);
    setForm({
      full_name: t.full_name,
      subject: t.subject,
      cabinet: t.cabinet,
      email: t.email,
      consultation: t.consultation,
      description: t.description,
      status: t.status,
    });
    setFormError('');
    setPhotoFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setOkMsg('');

    if (!form.full_name.trim()) {
      setFormError('Укажите ФИО преподавателя.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      full_name: form.full_name.trim(),
      subject: form.subject.trim(),
      cabinet: form.cabinet.trim(),
      email: form.email.trim(),
      consultation: form.consultation.trim(),
      description: form.description.trim(),
      status: form.status,
    };

    try {
      let teacherId: number;
      if (editingId === null) {
        const { data, error } = await supabase
          .from('teachers')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw new Error('Не удалось создать преподавателя.');
        teacherId = (data as { id: number }).id;
      } else {
        teacherId = editingId;
        const { error } = await supabase
          .from('teachers')
          .update(payload)
          .eq('id', editingId);
        if (error) throw new Error('Не удалось сохранить изменения.');
      }

      // Загрузка фото: uploads/teachers/<id>.<ext>, затем записываем public URL.
      if (photoFile) {
        const ext = photoFile.name.includes('.')
          ? (photoFile.name.split('.').pop() ?? 'jpg').toLowerCase()
          : 'jpg';
        const path = `teachers/${teacherId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('uploads')
          .upload(path, photoFile, { cacheControl: '3600', upsert: true });
        if (upErr) throw new Error('Не удалось загрузить фото в хранилище.');

        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
        const { error: phErr } = await supabase
          .from('teachers')
          .update({ photo_url: urlData.publicUrl })
          .eq('id', teacherId);
        if (phErr) throw new Error('Фото загружено, но путь не удалось сохранить.');
      }

      setOkMsg(editingId === null ? 'Преподаватель добавлен.' : 'Изменения сохранены.');
      startCreate();
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Неизвестная ошибка.');
    }
    setSaving(false);
  }

  async function removeTeacher(t: Teacher) {
    if (
      !window.confirm(
        `Удалить преподавателя «${t.full_name}»? Действие необратимо.`
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from('teachers').delete().eq('id', t.id);
    if (!error) {
      setOkMsg(`Преподаватель «${t.full_name}» удалён.`);
      if (editingId === t.id) startCreate();
      await reload();
    }
  }

  async function applyEdit(edit: TeacherEdit, approve: boolean) {
    const supabase = createClient();
    if (approve) {
      // Особый случай — фото: переносим файл из teachers/pending/ в teachers/<id>.<ext>
      // и записываем public URL в photo_url.
      if (edit.field === 'photo') {
        try {
          const ext = edit.new_value.includes('.')
            ? (edit.new_value.split('.').pop() ?? 'jpg').toLowerCase()
            : 'jpg';
          const dest = `teachers/${edit.teacher_id}.${ext}`;
          const { error: mvErr } = await supabase.storage
            .from('uploads')
            .move(edit.new_value, dest);
          if (mvErr) throw new Error('move');

          const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(dest);
          const { error: upErr } = await supabase
            .from('teachers')
            .update({ photo_url: urlData.publicUrl })
            .eq('id', edit.teacher_id);
          if (upErr) throw new Error('update');
        } catch {
          setOkMsg('');
          setListError('Не удалось применить фото к преподавателю.');
          return;
        }
      } else {
        // Обычные поля: применяем новое значение к полю преподавателя.
        const { error: upErr } = await supabase
          .from('teachers')
          .update({ [edit.field]: edit.new_value })
          .eq('id', edit.teacher_id);
        if (upErr) {
          setOkMsg('');
          setListError('Не удалось применить правку к преподавателю.');
          return;
        }
      }
    }
    const { error } = await supabase
      .from('teacher_edits')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('id', edit.id);
    if (!error) {
      setOkMsg(approve ? 'Правка одобрена и применена.' : 'Правка отклонена.');
      await reload();
    }
  }

  const teacherNameById = new Map(teachers.map((t) => [t.id, t.full_name]));

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Админ', href: '/admin' }, { label: 'Преподаватели' }]} />

      <form onSubmit={handleSave} className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">
            {editingId === null ? 'Новый преподаватель' : 'Редактирование преподавателя'}
          </h1>
          {editingId !== null && (
            <button type="button" onClick={startCreate} className="btn btn-outline ml-auto text-sm">
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="t-fullname" className="label">
              ФИО *
            </label>
            <input
              id="t-fullname"
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="t-subject" className="label">
              Предмет
            </label>
            <input
              id="t-subject"
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="t-cabinet" className="label">
              Кабинет
            </label>
            <input
              id="t-cabinet"
              type="text"
              value={form.cabinet}
              onChange={(e) => setForm({ ...form, cabinet: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="t-email" className="label">
              Почта
            </label>
            <input
              id="t-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="t-consult" className="label">
              Консультации
            </label>
            <input
              id="t-consult"
              type="text"
              value={form.consultation}
              onChange={(e) => setForm({ ...form, consultation: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="t-status" className="label">
              Статус
            </label>
            <select
              id="t-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Teacher['status'] })}
              className="input"
            >
              <option value="published">Опубликован</option>
              <option value="hidden">Скрыт</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="t-desc" className="label">
            Описание
          </label>
          <textarea
            id="t-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input resize-y"
          />
        </div>

        <div className="mt-3">
          <label htmlFor="t-photo" className="label">
            Фото (необязательно)
          </label>
          <input
            id="t-photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="input"
          />
        </div>

        {formError && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}
        {okMsg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {okMsg}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary mt-4">
          {saving
            ? 'Сохраняем…'
            : editingId === null
              ? 'Добавить преподавателя'
              : 'Сохранить изменения'}
        </button>
      </form>

      {/* Правки от пользователей */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--text)]">
          Правки от пользователей{' '}
          {edits.length > 0 && (
            <span className="badge ml-1 bg-amber-100 text-amber-700">{edits.length}</span>
          )}
        </h2>

        {loading && <p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем…</p>}
        {!loading && edits.length === 0 && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Новых правок нет.</p>
        )}

        <div className="mt-3 space-y-3">
          {edits.map((ed) => (
            <div key={ed.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-[var(--text)]">
                  {teacherNameById.get(ed.teacher_id) ?? `ID ${ed.teacher_id}`}
                </span>
                <span className="badge bg-indigo-50 text-indigo-700">
                  {FIELD_LABELS[ed.field] ?? ed.field}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(ed.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm text-[var(--text)]">
                {ed.field === 'photo' ? (
                  // Превью предложенного фото (120px) — файл лежит в teachers/pending/.
                  <span className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={createClient()
                        .storage.from('uploads')
                        .getPublicUrl(ed.new_value).data.publicUrl}
                      alt="Предложенное фото"
                      width={120}
                      height={120}
                      className="h-[120px] w-[120px] rounded-full object-cover"
                    />
                    <span className="text-xs text-[var(--text-muted)]">
                      Предложено новое фото ({ed.new_value})
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="text-[var(--text-muted)] line-through">{ed.old_value || '—'}</span>
                    {' → '}
                    <span className="font-medium">{ed.new_value}</span>
                  </>
                )}
              </p>
              {ed.comment && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Комментарий: {ed.comment}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyEdit(ed, true)}
                  className="btn btn-outline text-xs text-emerald-700 hover:bg-emerald-50"
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  onClick={() => applyEdit(ed, false)}
                  className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Список преподавателей */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--text)]">
          Все преподаватели{' '}
          {teachers.length > 0 && (
            <span className="text-slate-400">({teachers.length})</span>
          )}
        </h2>

        {listError && <p className="mt-3 text-sm text-rose-600">{listError}</p>}
        {!loading && teachers.length === 0 && !listError && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Список пуст.</p>
        )}

        <div className="mt-3 space-y-2">
          {teachers.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[var(--text)]">{t.full_name}</span>
                  <span className={`badge ${STATUS_BADGE[t.status]}`}>
                    {t.status === 'published' ? 'Опубликован' : 'Скрыт'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                  {t.subject || '—'} · каб. {t.cabinet || '—'}
                  {t.email ? ` · ${t.email}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  className="btn btn-outline text-xs"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => removeTeacher(t)}
                  className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
