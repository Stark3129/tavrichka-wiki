-- Добавляем тип строки расписания ('замена' | 'отмена') для поддержки отмен пар
alter table public.schedule_rows
  add column if not exists type text not null default 'замена';

-- Разрешаем null в subject для отмен, когда предмет не указан
alter table public.schedule_rows
  alter column subject drop not null;

alter table public.replacements
  alter column subject drop not null;
