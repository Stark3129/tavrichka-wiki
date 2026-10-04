'use client';

import { useState } from 'react';
import { updateUsername } from '@/lib/actions';

interface EditUsernameFormProps {
  initialUsername?: string | null;
}

export default function EditUsernameForm({
  initialUsername = '',
}: EditUsernameFormProps) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setError('Никнейм должен быть от 3 до 20 символов');
      return;
    }

    setLoading(true);
    try {
      await updateUsername(trimmed);
      setSuccess('Никнейм успешно сохранён');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении никнейма');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Новый никнейм"
          maxLength={20}
          disabled={loading}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || username.trim() === (initialUsername ?? '').trim()}
          className="btn btn-primary !px-3 !py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-rose-500 dark:text-rose-400">{error}</p>
      )}
      {success && (
        <p className="mt-1.5 text-xs text-emerald-500 dark:text-emerald-400">{success}</p>
      )}
    </form>
  );
}
