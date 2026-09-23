'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Teacher } from '@/lib/types';

/** Инициалы для заглушки: первые буквы первых двух слов ФИО. */
function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export default function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <motion.article
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-md transition-all duration-200 hover:shadow-lg md:hover:-translate-y-0.5"
      whileHover={{ y: 0 }}
    >
      <div className="flex items-center gap-3">
        {teacher.photo_url ? (
          <Image
            src={teacher.photo_url}
            alt={teacher.full_name}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-lg font-bold text-white">
            {initials(teacher.full_name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--text)]">{teacher.full_name}</h3>
          <p className="mt-1 line-clamp-2 break-words text-sm text-[var(--text-muted)]">
            {teacher.subject}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Кабинет: {teacher.cabinet || '—'}</p>
      {teacher.email && (
        <a
          href={`mailto:${teacher.email}`}
          className="mt-1 block truncate text-sm text-[var(--accent)] hover:underline"
        >
          {teacher.email}
        </a>
      )}
      <Link
        href={`/teachers/${teacher.id}`}
        className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
      >
        Подробнее →
      </Link>
    </motion.article>
  );
}
