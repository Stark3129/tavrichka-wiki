import Link from 'next/link';
import type { Teacher } from '@/lib/types';

export default function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <article className="card p-4 transition-shadow hover:shadow-md">
      <h3 className="text-base font-bold text-slate-900">{teacher.full_name}</h3>
      <span className="badge mt-1.5 bg-indigo-50 text-indigo-700">{teacher.subject}</span>
      <p className="mt-2 text-sm text-slate-600">Кабинет: {teacher.cabinet || '—'}</p>
      {teacher.email && (
        <a
          href={`mailto:${teacher.email}`}
          className="mt-1 block truncate text-sm text-indigo-600 hover:underline"
        >
          {teacher.email}
        </a>
      )}
      <Link
        href={`/teachers/${teacher.id}`}
        className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
      >
        Подробнее →
      </Link>
    </article>
  );
}
