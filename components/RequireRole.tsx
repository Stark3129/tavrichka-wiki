'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Клиентская защита раздела по ролям. Server-redirect невозможен
 * (страницы-клиенты), поэтому роль проверяется при монтировании.
 */
export default function RequireRole({
  allowed,
  children,
}: {
  allowed: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok'>('loading');

  useEffect(() => {
    let stale = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace('/auth');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (stale) return;
      if (profile && allowed.includes(profile.role)) {
        setState('ok');
      } else {
        router.replace('/');
      }
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state !== 'ok') {
    return (
      <p className="text-sm text-[var(--text-muted)]">Проверка доступа…</p>
    );
  }
  return <>{children}</>;
}