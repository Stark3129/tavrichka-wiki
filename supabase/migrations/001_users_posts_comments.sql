-- ============================================================
-- Миграция: пользователи, комментарии, фильтр мата
-- Запустить в Supabase SQL Editor (идемпотентная).
-- ВАЖНО: таблица profiles уже существует в этом проекте
-- (роли student/admin/moderator), поэтому она НЕ пересоздаётся —
-- только дополняется недостающими политиками/колонками.
-- ============================================================

-- 1. Профили: убеждаемся, что role допускает user/banned (сохраняем старые значения).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'student', 'moderator', 'admin', 'banned'));

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists created_at timestamp with time zone default now();
alter table public.profiles add column if not exists updated_at timestamp with time zone default now();

alter table public.profiles enable row level security;

-- Политики profiles (drop if exists, чтобы повторный запуск не падал).
drop policy if exists "Профили видны всем" on public.profiles;
create policy "Профили видны всем" on public.profiles for select using (true);

drop policy if exists "Пользователь может редактировать свой профиль" on public.profiles;
create policy "Пользователь может редактировать свой профиль" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Админ может редактировать все профили" on public.profiles;
create policy "Админ может редактировать все профили" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Триггер создания профиля при регистрации.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Общий триггер updated_at.
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();


-- 4. Комментарии.
-- post_id — bigint, т.к. posts.id в этом проекте числовой (serial/bigint).
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id bigint references public.posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table public.comments enable row level security;

drop policy if exists "Все читают комментарии" on public.comments;
create policy "Все читают комментарии" on public.comments for select using (true);

drop policy if exists "Авторизованные могут создавать комментарии" on public.comments;
create policy "Авторизованные могут создавать комментарии" on public.comments
  for insert with check (auth.uid() is not null);

drop policy if exists "Автор может редактировать свой комментарий" on public.comments;
create policy "Автор может редактировать свой комментарий" on public.comments
  for update using (auth.uid() = author_id);

drop policy if exists "Модератор/админ может редактировать все комментарии" on public.comments;
create policy "Модератор/админ может редактировать все комментарии" on public.comments
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );

drop policy if exists "Модератор/админ может удалять комментарии" on public.comments;
create policy "Модератор/админ может удалять комментарии" on public.comments
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at
  before update on public.comments
  for each row execute procedure public.handle_updated_at();

-- 5. Фильтр мата.
create table if not exists public.banned_words (
  id uuid default gen_random_uuid() primary key,
  word text not null unique,
  replacement text not null default '****',
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

alter table public.banned_words enable row level security;

drop policy if exists "Все читают banned words" on public.banned_words;
create policy "Все читают banned words" on public.banned_words for select using (true);

drop policy if exists "Только админ управляет banned words" on public.banned_words;
create policy "Только админ управляет banned words" on public.banned_words
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

insert into public.banned_words (word, replacement) values
  ('плохое_слово1', 'нехорошее_слово'),
  ('плохое_слово2', 'неприличное_выражение')
on conflict (word) do nothing;

-- 6. Посты: author_id/status уже есть в этом проекте — добавляем только недостающее
--    и обновляем RLS.
alter table public.posts add column if not exists author_id uuid references public.profiles(id) on delete set null;
alter table public.posts add column if not exists status text not null default 'pending';

drop policy if exists "Все читают опубликованные посты" on public.posts;
create policy "Все читают опубликованные посты" on public.posts
  for select using (status = 'published' or auth.uid() is not null);

drop policy if exists "Авторизованные могут создавать посты" on public.posts;
create policy "Авторизованные могут создавать посты" on public.posts
  for insert with check (auth.uid() is not null);

drop policy if exists "Пользователь может редактировать свой пост" on public.posts;
create policy "Пользователь может редактировать свой пост" on public.posts
  for update using (auth.uid() = author_id);

drop policy if exists "Модератор/админ может редактировать все посты" on public.posts;
create policy "Модератор/админ может редактировать все посты" on public.posts
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );

-- 7. View для админки: profiles + email из auth.users.
--    View исполняется с правами владельца, поэтому видит auth.users.
--    ВНИМАНИЕ: email виден любому авторизованному пользователю.
create or replace view public.admin_users_with_email as
select p.id, p.username, p.role, p.created_at, u.email
from public.profiles p
join auth.users u on u.id = p.id;

grant select on public.admin_users_with_email to authenticated;
