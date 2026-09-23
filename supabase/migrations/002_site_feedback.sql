-- Миграция 002: обратная связь с сайта (баги, идеи, предложения).
-- Гостевые сообщения разрешены (anon insert), чтение/модерация — админ и модератор.

create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'bug' check (type in ('bug', 'feature', 'improvement', 'other')),
  title text not null,
  description text not null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  author_email text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);

alter table public.site_feedback enable row level security;

drop policy if exists "Кто угодно может отправить сообщение" on public.site_feedback;
create policy "Кто угодно может отправить сообщение" on public.site_feedback
  for insert with check (true);

drop policy if exists "Админ и модератор видят сообщения" on public.site_feedback;
create policy "Админ и модератор видят сообщения" on public.site_feedback
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );

drop policy if exists "Админ и модератор меняют сообщения" on public.site_feedback;
create policy "Админ и модератор меняют сообщения" on public.site_feedback
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );

drop policy if exists "Админ и модератор удаляют сообщения" on public.site_feedback;
create policy "Админ и модератор удаляют сообщения" on public.site_feedback
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'))
  );
