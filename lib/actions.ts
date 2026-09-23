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