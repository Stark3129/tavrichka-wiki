import assert from 'assert';
import path from 'path';
import { mergeScheduleRows } from '../lib/schedule-merge.ts';

const tpl = [
  {
    id: 1,
    date: null,
    week_type: 'числитель',
    day_week: 'понедельник',
    lesson: 1,
    group_name: '4КСК30',
    subject: 'Шаблон 1',
    teacher: 'Учитель 1',
    cabinet: '101',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 2,
    date: null,
    week_type: 'числитель',
    day_week: 'понедельник',
    lesson: 2,
    group_name: '4КСК30',
    subject: 'Шаблон 2',
    teacher: 'Учитель 2',
    cabinet: '102',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 3,
    date: null,
    week_type: 'числитель',
    day_week: 'понедельник',
    lesson: 3,
    group_name: '4КСК30',
    subject: 'Шаблон 3',
    teacher: 'Учитель 3',
    cabinet: '103',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 4,
    date: null,
    week_type: 'числитель',
    day_week: 'понедельник',
    lesson: 4,
    group_name: '4КСК30',
    subject: 'Шаблон 4',
    teacher: 'Учитель 4',
    cabinet: '104',
    created_at: '2026-09-01T00:00:00Z',
  },
];

// Test 1: permanent replacement overrides template on any date D >= permanent.date
const permRows = [
  {
    id: 10,
    date: '2026-09-24',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 2,
    group_name: '4КСК30',
    subject: 'Постоянный предмет 2',
    teacher: 'Постоянный учитель 2',
    cabinet: '202',
    type: 'permanent',
    valid_until: null,
    created_at: '2026-09-24T00:00:00Z',
  },
];

const res1 = mergeScheduleRows(tpl, permRows, new Set(), '2026-10-05');
assert.strictEqual(res1.find(r => r.lesson === 2)?.subject, 'Постоянный предмет 2', 'Permanent should override template on 2026-10-05');

// Test 2: permanent does NOT apply before its date
const resBefore = mergeScheduleRows(tpl, permRows, new Set(), '2026-09-20');
assert.strictEqual(resBefore.find(r => r.lesson === 2)?.subject, 'Шаблон 2', 'Permanent should NOT override before its start date');

// Test 3: valid_until expired
const permExpired = [
  {
    id: 10,
    date: '2026-09-24',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 2,
    group_name: '4КСК30',
    subject: 'Постоянный предмет 2',
    teacher: 'Постоянный учитель 2',
    cabinet: '202',
    type: 'permanent',
    valid_until: '2026-10-01',
    created_at: '2026-09-24T00:00:00Z',
  },
];
const resExpired = mergeScheduleRows(tpl, permExpired, new Set(), '2026-10-05');
assert.strictEqual(resExpired.find(r => r.lesson === 2)?.subject, 'Шаблон 2', 'Expired permanent should revert to template');

// Test 4: Conflict priorities: отмена > замена > permanent > шаблон
const conflictRows = [
  // Lesson 1: permanent vs замена -> замена wins
  {
    id: 20,
    date: '2026-09-24',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 1,
    group_name: '4КСК30',
    subject: 'Permanent 1',
    teacher: 'Учитель P',
    cabinet: 'P1',
    type: 'permanent',
    created_at: '2026-09-24T00:00:00Z',
  },
  {
    id: 21,
    date: '2026-10-05',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 1,
    group_name: '4КСК30',
    subject: 'One-day Замена 1',
    teacher: 'Учитель Z',
    cabinet: 'Z1',
    type: 'замена',
    created_at: '2026-10-05T00:00:00Z',
  },

  // Lesson 3: permanent vs отмена -> отмена wins (pair disappears!)
  {
    id: 30,
    date: '2026-09-24',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 3,
    group_name: '4КСК30',
    subject: 'Permanent 3',
    teacher: 'Учитель P3',
    cabinet: 'P3',
    type: 'permanent',
    created_at: '2026-09-24T00:00:00Z',
  },
  {
    id: 31,
    date: '2026-10-05',
    week_type: 'знаменатель',
    day_week: 'понедельник',
    lesson: 3,
    group_name: '4КСК30',
    subject: 'Отмена 3',
    teacher: '',
    cabinet: '',
    type: 'отмена',
    created_at: '2026-10-05T00:00:00Z',
  },
];

const resConflict = mergeScheduleRows(tpl, conflictRows, new Set(), '2026-10-05');
assert.strictEqual(resConflict.find(r => r.lesson === 1)?.subject, 'One-day Замена 1', 'Замена wins over permanent');
assert.strictEqual(resConflict.find(r => r.lesson === 3), undefined, 'Отмена completely removes lesson 3 even with permanent present');
assert.strictEqual(resConflict.find(r => r.lesson === 4)?.subject, 'Шаблон 4', 'Template preserved when no change');

console.log('Merge unit tests PASSED successfully!');
