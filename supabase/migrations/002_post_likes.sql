create table if not exists public.post_likes (
  id bigint generated always as identity primary key,
  post_id bigint references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique (post_id, user_id)
);

alter table public.post_likes enable row level security;
create policy "Все видят лайки" on public.post_likes for select using (true);
create policy "Авторизованные ставят лайки" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "Авторизованные убирают свои лайки" on public.post_likes for delete using (auth.uid() = user_id);
