import { cn, formatDate } from '@/lib/utils';
import type { Post } from '@/lib/types';

const TYPE_META: Record<Post['type'], { label: string; className: string }> = {
  news: { label: 'Новость', className: 'bg-sky-100 text-sky-800' },
  meme: { label: 'Мем', className: 'bg-amber-100 text-amber-800' },
  announce: { label: 'Анонс', className: 'bg-violet-100 text-violet-800' },
  useful: { label: 'Полезное', className: 'bg-emerald-100 text-emerald-800' },
  event: { label: 'Событие', className: 'bg-rose-100 text-rose-800' },
};

export default function PostCard({ post }: { post: Post }) {
  const meta = TYPE_META[post.type] ?? {
    label: post.type,
    className: 'bg-slate-100 text-slate-700',
  };

  return (
    <article className="card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className={cn('badge', meta.className)}>{meta.label}</span>
          <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
        </div>

        <h2 className="mt-2 text-lg font-bold text-slate-900">{post.title}</h2>

        {post.content && (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {post.content}
          </p>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          loading="lazy"
          className="max-h-96 w-full border-t border-slate-100 object-cover"
        />
      )}
    </article>
  );
}
