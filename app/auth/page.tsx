'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Единая страница входа/регистрации (/auth).
 * Регистрация signUp + username в user_metadata;
 * профиль создаётся триггером on_auth_user_created в Supabase.
 */
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(
          err.status === 400 || err.status === 422
            ? 'Неверная почта или пароль.'
            : `Не удалось войти: ${err.message}`
        );
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });

    if (authError) {
      setError(`Не удалось зарегистрироваться: ${authError.message}`);
      setLoading(false);
      return;
    }

    // Подстраховка: если триггер не сработал — обновляем username явно.
    if (authData.user && username.trim()) {
      await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', authData.user.id);
    }

    setError('Регистрация успешна! Теперь войдите.');
    setIsLogin(true);
    setLoading(false);
  }

  const isError = error && !error.includes('успешна');

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 bg-transparent p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-[var(--text)]">
          {isLogin ? 'Вход в Тавричку Вики' : 'Регистрация'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="auth-username" className="label">
                Никнейм
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                placeholder="student123"
                disabled={loading}
                className="input"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="label">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="student@tavrichka.ru"
              autoComplete="email"
              disabled={loading}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="label">
              Пароль
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              disabled={loading}
              className="input"
            />
          </div>

          {error && (
            <div
              className={`rounded-lg p-3 text-sm ${
                isError
                  ? 'border border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-400'
                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Загрузка…' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            {isLogin
              ? 'Нет аккаунта? Зарегистрироваться'
              : 'Уже есть аккаунт? Войти'}
          </button>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            <Link href="/" className="hover:underline">
              ← На главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}