'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Teacher } from '@/lib/types';

export default function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <motion.article
      className="card p-4"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <h3 className="text-base font-bold text-[var(--text)]">{teacher.full_name}</h3>
      <span className="badge mt-1.5 bg-[var(--accent)] text-white">{teacher.subject}</span>
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
