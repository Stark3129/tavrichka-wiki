'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  postId: number;
  initialCount?: number;
  initialLiked?: boolean;
}

export default function LikeButton({
  postId,
  initialCount = 0,
  initialLiked = false,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const handleToggle = async () => {
    if (loading) return;
    setHint(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setHint('Войдите, чтобы лайкать');
      setTimeout(() => setHint(null), 4000);
      return;
    }

    setLoading(true);

    const nextLiked = !liked;
    const nextCount = nextLiked ? count + 1 : Math.max(0, count - 1);

    // Оптимистичное обновление
    setLiked(nextLiked);
    setCount(nextCount);

    try {
      if (nextLiked) {
        const { error } = await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: user.id,
        });
        if (error) {
          console.error('Ошибка добавления лайка:', error);
          setLiked(liked);
          setCount(count);
        }
      } else {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) {
          console.error('Ошибка удаления лайка:', error);
          setLiked(liked);
          setCount(count);
        }
      }
    } catch (err) {
      console.error('Ошибка переключения лайка:', err);
      setLiked(liked);
      setCount(count);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
        className="group flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium transition focus:outline-none"
      >
        <Heart
          className={cn(
            'h-5 w-5 transition-transform duration-200 hover:scale-110',
            liked
              ? 'fill-red-500 text-red-500'
              : 'text-[var(--text-muted)] group-hover:text-red-500'
          )}
        />
        <span
          className={cn(
            'text-xs transition-colors',
            liked ? 'font-semibold text-red-500' : 'text-[var(--text-muted)]'
          )}
        >
          {count}
        </span>
      </button>

      {hint && (
        <span className="text-xs text-rose-500 dark:text-rose-400">
          <Link href="/auth" className="underline hover:text-rose-600 font-medium">
            Войдите
          </Link>
          , чтобы лайкать
        </span>
      )}
    </div>
  );
}
