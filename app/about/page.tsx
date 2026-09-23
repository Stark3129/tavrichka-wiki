import Link from 'next/link';
import { Newspaper, CalendarDays, Clock, Map } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata = { title: 'О проекте' };

const FEATURES = [
  {
    icon: Newspaper,
    title: 'Лента',
    text: 'Новости, анонсы, события, полезные материалы и мемы — всё в одной ленте с фильтрами по типу поста.',
  },
  {
    icon: Clock,
    title: 'Замены',
    text: 'Актуальные замены занятий с фильтрами по дате, группе и преподавателю. Обновляется администрацией.',
  },
  {
    icon: CalendarDays,
    title: 'Расписание',
    text: 'Расписание по группам на любой день: выберите группу и дату — покажем пары, преподавателей и аудитории.',
  },
  {
    icon: Map,
    title: 'Карта',
    text: 'Интерактивная карта корпусов по этажам: найдите аудиторию, столовую или спортзал и посмотрите занятия в кабинете.',
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'О проекте' }]} />

      <div className="card p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-[var(--text)]">
          О проекте «Тавричка Вики»
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--text-muted)]">
          Студенческий портал колледжа: здесь собраны лента постов, замены,
          расписание занятий, информация о преподавателях и карта корпусов.
          Проект создан и поддерживается студентами — чтобы вся нужная учёба
          и жизнь колледжа была под рукой в одном месте.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-base font-bold text-[var(--text)]">{title}</h2>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">{text}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-[var(--text)]">Контакты</h2>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Проект разработан и поддерживается студентами Таврического колледжа.
          По всем вопросам обращайтесь к администрации колледжа.
        </p>
        <Link
          href="/"
          className="btn btn-outline mt-5"
        >
          ← На главную
        </Link>
      </div>
    </div>
  );
}