'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Выход из аккаунта (server action, вызывается из формы в шапке). */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/');
}

/**
 * Фильтр мата: заменяет запрещённые слова из таблицы banned_words
 * на их replacement-значения. Простая посимвольная замена по regex.
 */
export async function sanitizeText(text: string): Promise<string> {
  if (!text) return text;
  const supabase = await createClient();
  const { data: words } = await supabase
    .from('banned_words')
    .select('word, replacement')
    .eq('active', true);
  if (!words || words.length === 0) return text;

  let sanitized = text;
  for (const w of words) {
    try {
      const regex = new RegExp(w.word, 'gi');
      sanitized = sanitized.replace(regex, w.replacement ?? '****');
    } catch {
      // Пропускаем некорректные слова (не валидный regex).
    }
  }
  return sanitized;
}

export interface CreatePostInput {
  title: string;
  content: string;
  type: string;
  image_url?: string | null;
}

const ALLOWED_ROLES = ['user', 'student', 'moderator', 'admin', 'banned'] as const;

/** Проверка, что текущий пользователь — админ (для server actions). */
async function assertAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) throw new Error('Необходима авторизация');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') throw new Error('Доступ только для админов');
}

/** Смена роли пользователя (вызов из кода). */
export async function updateUserRole(userId: string, newRole: string) {
  await assertAdmin();
  if (!(ALLOWED_ROLES as readonly string[]).includes(newRole)) {
    throw new Error('Недопустимая роль');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);
  if (error) throw new Error('Не удалось изменить роль');

  revalidatePath('/admin/users');
}

/** Смена роли из <form action={...}> на серверной странице админки. */
export async function updateUserRoleForm(formData: FormData) {
  const userId = String(formData.get('userId') ?? '');
  const newRole = String(formData.get('role') ?? '');
  await updateUserRole(userId, newRole);
}

/**
 * Создание поста авторизованным пользователем.
 * Пост попадает в модерацию (status = 'pending').
 */
export async function createPost(
  input: CreatePostInput
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return { ok: false, message: 'Необходима авторизация' };
  }

  const title = (input.title || '').trim();
  const content = (input.content || '').trim();
  if (!title || !content) {
    return { ok: false, message: 'Заполните заголовок и текст' };
  }

  const sanitizedContent = await sanitizeText(content);
  const sanitizedTitle = await sanitizeText(title);

  const { error } = await supabase.from('posts').insert({
    title: sanitizedTitle,
    content: sanitizedContent,
    type: input.type,
    image_url: input.image_url ?? null,
    author_id: user.id,
    status: 'pending',
  });

  if (error) {
    return { ok: false, message: 'Не удалось отправить. Попробуйте ещё раз.' };
  }

  revalidatePath('/');
  return { ok: true, message: 'Пост отправлен на модерацию' };
}

/** Проверка роли модератора/админа внутри feedback-действий. */
async function assertModeratorOrAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data?.user?.id ?? '')
    .single();
  return !!(profile && ['admin', 'moderator'].includes(profile.role));
}

/** Смена статуса и заметка админа (форма на /admin/feedback). */
export async function updateFeedbackStatus(formData: FormData) {
  if (!(await assertModeratorOrAdmin())) return;
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? 'new');
  const note = String(formData.get('note') ?? '');
  if (!id) return;
  await supabase
    .from('site_feedback')
    .update({ status, admin_note: note || null })
    .eq('id', id);
  revalidatePath('/admin/feedback');
}

/** Удаление сообщения обратной связи (форма на /admin/feedback). */
export async function deleteFeedback(formData: FormData) {
  if (!(await assertModeratorOrAdmin())) return;
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('site_feedback').delete().eq('id', id);
  revalidatePath('/admin/feedback');
}

/**
 * Редактирование комментария: автор — свой, админ/модератор — любой.
 * Текст пропускается через фильтр мата перед сохранением.
 */
export async function updateComment(
  commentId: string | number,
  newText: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { ok: false, message: 'Не авторизован' };

  const { data: comment } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', commentId)
    .single();
  if (!comment) return { ok: false, message: 'Комментарий не найден' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isOwner = comment.author_id === user.id;
  const isModerator = profile?.role === 'admin' || profile?.role === 'moderator';
  if (!isOwner && !isModerator) {
    return { ok: false, message: 'Нет прав для редактирования' };
  }

  const trimmed = (newText || '').trim();
  if (!trimmed) return { ok: false, message: 'Текст не может быть пустым' };

  const sanitized = await sanitizeText(trimmed);

  const { error } = await supabase
    .from('comments')
    .update({ text: sanitized })
    .eq('id', commentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/');
  return { ok: true, message: 'Сохранено' };
}