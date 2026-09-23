'use client';

import { useEffect, useState, type FormEvent } from 'react';
import RequireRole from '@/components/RequireRole';
import { createClient } from '@/lib/supabase/client';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { MapFloor, MapObject } from '@/lib/types';

const CATEGORIES = [
  'аудитория',
  'лаборатория',
  'спорт',
  'столовая',
  'администрация',
  'библиотека',
];

const EMPTY_OBJECT = {
  name: '',
  floor: 1,
  room: '',
  category: CATEGORIES[0],
  description: '',
  corpus: 1,
};

const EMPTY_FLOOR = {
  title: '',
  corpus: 1,
  floor: 1,
  image_url: '',
  sort: 0,
};

export default function AdminMapPage() {
  return (
    <RequireRole allowed={['admin']}>
      <AdminMapPageInner />
    </RequireRole>
  );
}

function AdminMapPageInner() {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [floors, setFloors] = useState<MapFloor[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [objEditingId, setObjEditingId] = useState<number | null>(null);
  const [objForm, setObjForm] = useState({ ...EMPTY_OBJECT });
  const [floorEditingId, setFloorEditingId] = useState<number | null>(null);
  const [floorForm, setFloorForm] = useState({ ...EMPTY_FLOOR });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function reload() {
    const supabase = createClient();
    const [oRes, fRes] = await Promise.all([
      supabase
        .from('map_objects')
        .select('*')
        .order('corpus', { ascending: true })
        .order('floor', { ascending: true })
        .order('name', { ascending: true })
        .limit(1000),
      supabase
        .from('map_floors')
        .select('*')
        .order('corpus', { ascending: true })
        .order('sort', { ascending: true })
        .limit(200),
    ]);
    if (oRes.error || fRes.error) {
      setListError('Не удалось загрузить данные карты.');
    } else {
      setObjects((oRes.data as MapObject[] | null) ?? []);
      setFloors((fRes.data as MapFloor[] | null) ?? []);
      setListError('');
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  function num(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // --- Объекты карты ---
  async function saveObject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setOkMsg('');
    if (!objForm.name.trim()) {
      setFormError('Укажите название объекта.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: objForm.name.trim(),
      floor: num(String(objForm.floor)),
      room: objForm.room.trim(),
      category: objForm.category,
      description: objForm.description.trim(),
      corpus: num(String(objForm.corpus)),
    };
    const { error } =
      objEditingId === null
        ? await supabase.from('map_objects').insert(payload)
        : await supabase.from('map_objects').update(payload).eq('id', objEditingId);
    if (error) {
      setFormError(
        objEditingId === null
          ? 'Не удалось создать объект карты.'
          : 'Не удалось сохранить объект карты.'
      );
    } else {
      setOkMsg(objEditingId === null ? 'Объект добавлен.' : 'Объект обновлён.');
      setObjEditingId(null);
      setObjForm({ ...EMPTY_OBJECT });
      await reload();
    }
    setSaving(false);
  }

  async function deleteObject(o: MapObject) {
    if (!window.confirm(`Удалить объект «${o.name}»?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('map_objects').delete().eq('id', o.id);
    if (!error) {
      setOkMsg(`Объект «${o.name}» удалён.`);
      if (objEditingId === o.id) {
        setObjEditingId(null);
        setObjForm({ ...EMPTY_OBJECT });
      }
      await reload();
    }
  }

  // --- Этажи ---
  async function saveFloor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setOkMsg('');
    if (!floorForm.title.trim()) {
      setFormError('Укажите название этажа.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title: floorForm.title.trim(),
      corpus: num(String(floorForm.corpus)),
      floor: num(String(floorForm.floor)),
      image_url: floorForm.image_url.trim(),
      sort: num(String(floorForm.sort)),
    };
    const { error } =
      floorEditingId === null
        ? await supabase.from('map_floors').insert(payload)
        : await supabase.from('map_floors').update(payload).eq('id', floorEditingId);
    if (error) {
      setFormError(
        floorEditingId === null
          ? 'Не удалось создать этаж.'
          : 'Не удалось сохранить этаж.'
      );
    } else {
      setOkMsg(floorEditingId === null ? 'Этаж добавлен.' : 'Этаж обновлён.');
      setFloorEditingId(null);
      setFloorForm({ ...EMPTY_FLOOR });
      await reload();
    }
    setSaving(false);
  }

  async function deleteFloor(f: MapFloor) {
    if (!window.confirm(`Удалить этаж «${f.title}» (корпус ${f.corpus})?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('map_floors').delete().eq('id', f.id);
    if (!error) {
      setOkMsg(`Этаж «${f.title}» удалён.`);
      if (floorEditingId === f.id) {
        setFloorEditingId(null);
        setFloorForm({ ...EMPTY_FLOOR });
      }
      await reload();
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Админ', href: '/admin' }, { label: 'Карта' }]} />

      {/* Форма объекта карты */}
      <form onSubmit={saveObject} className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">
            {objEditingId === null ? 'Новый объект карты' : 'Редактирование объекта'}
          </h1>
          {objEditingId !== null && (
            <button
              type="button"
              onClick={() => {
                setObjEditingId(null);
                setObjForm({ ...EMPTY_OBJECT });
              }}
              className="btn btn-outline ml-auto text-sm"
            >
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="o-name" className="label">
              Название *
            </label>
            <input
              id="o-name"
              type="text"
              required
              value={objForm.name}
              onChange={(e) => setObjForm({ ...objForm, name: e.target.value })}
              placeholder="ЖД-18 или Спортзал"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="o-room" className="label">
              Кабинет в расписании
            </label>
            <input
              id="o-room"
              type="text"
              value={objForm.room}
              onChange={(e) => setObjForm({ ...objForm, room: e.target.value })}
              placeholder="жд18"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="o-category" className="label">
              Категория
            </label>
            <select
              id="o-category"
              value={objForm.category}
              onChange={(e) => setObjForm({ ...objForm, category: e.target.value })}
              className="input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="o-corpus" className="label">
              Корпус
            </label>
            <input
              id="o-corpus"
              type="number"
              min={1}
              value={objForm.corpus}
              onChange={(e) => setObjForm({ ...objForm, corpus: num(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="o-floor" className="label">
              Этаж
            </label>
            <input
              id="o-floor"
              type="number"
              min={0}
              value={objForm.floor}
              onChange={(e) => setObjForm({ ...objForm, floor: num(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="o-desc" className="label">
              Описание
            </label>
            <input
              id="o-desc"
              type="text"
              value={objForm.description}
              onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
              className="input"
            />
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary mt-4">
          {saving ? 'Сохраняем…' : objEditingId === null ? 'Добавить объект' : 'Сохранить объект'}
        </button>
      </form>

      {/* Форма этажа */}
      <form onSubmit={saveFloor} className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-[var(--text)]">
            {floorEditingId === null ? 'Новый этаж' : 'Редактирование этажа'}
          </h2>
          {floorEditingId !== null && (
            <button
              type="button"
              onClick={() => {
                setFloorEditingId(null);
                setFloorForm({ ...EMPTY_FLOOR });
              }}
              className="btn btn-outline ml-auto text-sm"
            >
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="f-title" className="label">
              Название *
            </label>
            <input
              id="f-title"
              type="text"
              required
              value={floorForm.title}
              onChange={(e) => setFloorForm({ ...floorForm, title: e.target.value })}
              placeholder="1 этаж"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="f-corpus" className="label">
              Корпус
            </label>
            <input
              id="f-corpus"
              type="number"
              min={1}
              value={floorForm.corpus}
              onChange={(e) => setFloorForm({ ...floorForm, corpus: num(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="f-floor" className="label">
              Номер этажа
            </label>
            <input
              id="f-floor"
              type="number"
              min={0}
              value={floorForm.floor}
              onChange={(e) => setFloorForm({ ...floorForm, floor: num(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="f-sort" className="label">
              Порядок сортировки
            </label>
            <input
              id="f-sort"
              type="number"
              value={floorForm.sort}
              onChange={(e) => setFloorForm({ ...floorForm, sort: num(e.target.value) })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="f-image" className="label">
              Ссылка на схему этажа (image_url)
            </label>
            <input
              id="f-image"
              type="url"
              value={floorForm.image_url}
              onChange={(e) => setFloorForm({ ...floorForm, image_url: e.target.value })}
              placeholder="https://…"
              className="input"
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary mt-4">
          {saving ? 'Сохраняем…' : floorEditingId === null ? 'Добавить этаж' : 'Сохранить этаж'}
        </button>
      </form>

      {okMsg && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</p>
      )}
      {listError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</p>
      )}

      {/* Список этажей */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--text)]">
          Этажи {floors.length > 0 && <span className="text-slate-400">({floors.length})</span>}
        </h2>
        {loading && <p className="mt-3 text-sm text-[var(--text-muted)]">Загружаем…</p>}
        {!loading && floors.length === 0 && !listError && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Этажи пока не добавлены.</p>
        )}
        <div className="mt-3 space-y-2">
          {floors.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            >
              <div className="min-w-0 flex-1">
                <span className="font-bold text-[var(--text)]">{f.title}</span>
                <span className="badge ml-2 bg-indigo-50 text-indigo-700">
                  корпус {f.corpus}
                </span>
                <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                  этаж {f.floor} · сортировка {f.sort}
                  {f.image_url ? ` · ${f.image_url}` : ' · без схемы'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFloorEditingId(f.id);
                    setFloorForm({
                      title: f.title,
                      corpus: f.corpus,
                      floor: f.floor,
                      image_url: f.image_url,
                      sort: f.sort,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn btn-outline text-xs"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => deleteFloor(f)}
                  className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Список объектов */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--text)]">
          Объекты карты{' '}
          {objects.length > 0 && <span className="text-slate-400">({objects.length})</span>}
        </h2>
        {!loading && objects.length === 0 && !listError && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Объекты пока не добавлены.</p>
        )}
        <div className="mt-3 space-y-2">
          {objects.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[var(--text)]">{o.name}</span>
                  <span className="badge bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)]">{o.category}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                  корпус {o.corpus} · этаж {o.floor}
                  {o.room ? ` · кабинет «${o.room}»` : ''}
                  {o.description ? ` · ${o.description}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setObjEditingId(o.id);
                    setObjForm({
                      name: o.name,
                      floor: o.floor,
                      room: o.room,
                      category: o.category,
                      description: o.description,
                      corpus: o.corpus,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn btn-outline text-xs"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => deleteObject(o)}
                  className="btn btn-outline text-xs text-rose-600 hover:bg-rose-50"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
