-- Миграция 004: поддержка постоянных замен ('permanent') и периода действия (valid_until)
-- Выполнить вручную в Supabase SQL Editor

-- 1. Добавляем колонку срока действия в schedule_rows и replacements
alter table public.schedule_rows add column if not exists valid_until timestamptz null;
alter table public.schedule_rows add column if not exists week_type text null;

alter table public.replacements add column if not exists valid_until timestamptz null;

-- 2. Ограничения на допустимые типы (если существуют старые - пересоздаем)
alter table public.schedule_rows drop constraint if exists schedule_rows_type_check;
alter table public.schedule_rows add constraint schedule_rows_type_check
  check (type in ('замена', 'отмена', 'permanent'));

alter table public.replacements drop constraint if exists replacements_change_type_check;
alter table public.replacements add constraint replacements_change_type_check
  check (change_type in ('замена', 'отмена', 'permanent', 'добавление'));
