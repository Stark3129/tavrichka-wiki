# Тавричка Вики

Студенческий портал колледжа: лента постов, замены занятий, преподаватели, карта кабинетов и админ-зона.

## Стек

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** — светлая тема, один акцентный цвет
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — авторизация, база данных, storage
- **xlsx** (SheetJS) — чтение Excel-файлов с заменами в браузере

## Переменные окружения

Проект использует ровно две переменные (см. `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Значения берутся в Supabase: **Project Settings → API**.

## Запуск локально

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env.local на основе .env.example и заполнить переменные

# 3. Запустить dev-сервер
npm run dev
```

Открыть <http://localhost:3000>.

Продакшн-сборка: `npm run build`, затем `npm run start`.

## Деплой на Vercel

**Через сайт:**

1. Запушить проект в репозиторий GitHub.
2. На <https://vercel.com> → **Add New… → Project** → импортировать репозиторий.
3. В **Settings → Environment Variables** добавить `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Нажать **Deploy**. Все последующие push в репозиторий будут деплоиться автоматически.

**Через CLI (альтернатива):**

```bash
npm i -g vercel
vercel login
vercel            # из папки проекта (preview)
vercel --production
```
