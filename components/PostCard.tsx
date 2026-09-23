'use client';

import { motion } from 'framer-motion';
import { Calendar, Laugh, Lightbulb, Megaphone, Newspaper } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { Comment, Post } from '@/lib/types';
import Comments from '@/components/Comments';

const TYPE_META: Record<
  Post['type'],
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  news: { label: 'Новость', className: 'bg-sky-100 text-sky-800', Icon: Newspaper },
  meme: { label: 'Мем', className: 'bg-amber-100 text-amber-800', Icon: Laugh },
  announce: { label: 'Анонс', className: 'bg-violet-100 text-violet-800', Icon: Megaphone },
  useful: { label: 'Полезное', className: 'bg-emerald-100 text-emerald-800', Icon: Lightbulb },
  event: { label: 'Событие', className: 'bg-rose-100 text-rose-800', Icon: Calendar },
};

export default function PostCard({
  post,
  comments = [],
}: {
  post: Post;
  comments?: Comment[];
}) {
  const meta = TYPE_META[post.type] ?? {
    label: post.type,
    className: 'bg-slate-100 dark:bg-slate-800 text-[var(--text)]',
    Icon: Newspaper,
  };

  return (
    <motion.article
      className="card overflow-hidden"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className={cn('badge', meta.className)}>{meta.label}</span>
          <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
        </div>

        <h2 className="mt-2 flex items-start gap-2 text-lg font-bold text-[var(--text)]">
          <meta.Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--accent)]" />
          <span>{post.title}</span>
        </h2>

        {post.content && (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[var(--text-muted)]">
            {post.content}
          </p>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          loading="lazy"
          className="max-h-96 w-full border-t border-[var(--border)] object-cover"
        />
      )}

      <div className="border-t border-[var(--border)] px-4 pb-4 sm:px-5">
        <Comments postId={String(post.id)} initialComments={comments} />
      </div>
    </motion.article>
  );
}
