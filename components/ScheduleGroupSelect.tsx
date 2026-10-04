'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getMyGroup, setMyGroup, subscribeMyGroup } from '@/lib/my-group';
import { cn } from '@/lib/utils';

export default function ScheduleGroupSelect({
  groups,
  defaultValue,
}: {
  groups: string[];
  defaultValue: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(defaultValue);
  const [savedGroup, setSavedGroup] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Синхронизация сохранённой группы из localStorage
  useEffect(() => {
    const my = getMyGroup();
    setSavedGroup(my);

    // Если группа не выбрана в URL, но есть в localStorage — сразу открываем её
    if (!defaultValue && my && groups.includes(my)) {
      setSelected(my);
      router.replace(`/schedule?group=${encodeURIComponent(my)}`);
    }

    return subscribeMyGroup((group) => {
      setSavedGroup(group);
    });
  }, [defaultValue, groups, router]);

  useEffect(() => {
    setSelected(defaultValue);
  }, [defaultValue]);

  function showToast(msg: string) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelected(val);
    if (val) {
      setMyGroup(val);
      showToast('Сохранено как моя группа ⭐');
      const form = e.target.form;
      if (form) form.requestSubmit();
    }
  }

  function handleToggleStar() {
    if (!selected) {
      showToast('Сначала выберите группу');
      return;
    }
    const isSaved = savedGroup === selected;
    if (isSaved) {
      setMyGroup('');
      showToast('Группа удалена из избранного');
    } else {
      setMyGroup(selected);
      showToast('Сохранено как моя группа ⭐');
    }
  }

  const isCurrentSaved = Boolean(selected && savedGroup === selected);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <select
          id="sch-group"
          name="group"
          value={selected}
          className="input flex-1"
          onChange={handleSelectChange}
        >
          <option value="">— выберите группу —</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g} {savedGroup === g ? '⭐' : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleToggleStar}
          title="Это моя группа"
          aria-label="Это моя группа"
          className={cn(
            'btn btn-outline !px-3 !py-2 shrink-0 transition-all duration-200',
            isCurrentSaved &&
              'border-amber-400 bg-amber-50/70 text-amber-600 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300 shadow-xs'
          )}
        >
          <Star
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isCurrentSaved
                ? 'fill-amber-400 text-amber-500 scale-110'
                : 'text-[var(--text-muted)]'
            )}
          />
          <span className="hidden sm:inline text-xs font-medium">
            {isCurrentSaved ? 'Моя группа' : '⭐ Моя группа'}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-10 mt-1.5 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 shadow-md dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-200"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
