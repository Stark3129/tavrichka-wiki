import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateUserRoleForm } from '@/lib/actions';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Пользователи — Админ-зона' };

/**
 * Управление пользователями (только для роли admin).
 * Server-компонент: данные из view admin_users_with_email (profiles + email),
 * смена роли через server action updateUserRoleForm.
 */
const ROLES = [
  { value: 'user', label: 'Пользователь' },
  { value: 'moderator', label: 'Модератор' },
  { value: 'admin', label: 'Админ' },
  { value: 'banned', label: 'Заблокирован' },
];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  banned: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Защита: страница только для админов (middleware пускает любых авторизованных).
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/auth');
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (me?.role !== 'admin') redirect('/');

  const { data: users, error } = await supabase
    .from('admin_users_with_email')
    .select('id, username, role, created_at, email')
    .order('created_at', { ascending: false })
    .range(0, 999); // PostgREST по умолчанию отдаёт максимум 1000 строк

  const rows = (users as Array<{
    id: string;
    username: string | null;
    role: string;
    created_at: string;
    email: string | null;
  }> | null) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-3xl font-bold text-transparent">
        Управление пользователями
      </h1>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
          Не удалось загрузить пользователей (проверьте, что view
          admin_users_with_email создан миграцией).
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        {rows.length === 0 && !error ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">
            Пользователей пока нет.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30">
                <th className="px-4 py-2.5 font-semibold text-[var(--text)]">Никнейм</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text)]">Email</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text)]">Роль</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text)]">Регистрация</th>
                <th className="px-4 py-2.5 font-semibold text-[var(--text)]">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[var(--border)] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-2.5 font-medium text-[var(--text)]">
                    {p.username || '(без никнейма)'}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.email ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${ROLE_BADGE[p.role] ?? ROLE_BADGE.user}`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={updateUserRoleForm} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={p.id} />
                      <select
                        name="role"
                        defaultValue={p.role}
                        className="input !py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="btn btn-primary !px-3 !py-1 text-xs"
                      >
                        Сохранить
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}