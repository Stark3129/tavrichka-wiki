import fs from 'fs';
import path from 'path';
import { parseBaseSchedule } from './parse-base-schedule.mjs';
import { parseReplacementsWorkbook } from '../lib/replacements-parser.ts';
import { mergeScheduleRows } from '../lib/schedule-merge.ts';

// Функция вычисления расстояния Левенштейна для поиска опечаток
function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array(an + 1)
    .fill(null)
    .map(() => Array(bn + 1).fill(null));
  for (let i = 0; i <= an; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bn; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= an; i += 1) {
    for (let j = 1; j <= bn; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

function norm(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.\-,–—]/g, '');
}

function normTeacher(t) {
  return (t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normGroup(g) {
  return (g || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function runAudit() {
  console.log('Запуск полного аудита расписания и замен...');

  const baseFilePath = 'samples/базовое_расписание.xlsx';
  const replacementFiles = [
    'samples/замены 24.09 (ЗНАМЕНАТЕЛЬ) (1).xlsx',
    'samples/замены 25.09 (ЗНАМЕНАТЕЛЬ).xlsx',
    'samples/замены 28.09 (ЧИСЛИТЕЛЬ).xlsx',
  ];

  // ==========================================
  // ШАГ 1. Загрузка и парсинг
  // ==========================================
  console.log('\n=============================================================');
  console.log('ШАГ 1. Загрузка и парсинг базового расписания и замен');
  console.log('=============================================================');

  const baseResult = await parseBaseSchedule(baseFilePath);
  console.log(`Базовое расписание: ${baseResult.lessons.length} записей пар`);
  console.log(`Групп в базовом расписании: ${baseResult.groups.length}`);
  console.log(`Преподавателей в базе: ${baseResult.teachers.length}`);
  console.log(`Аудиторий в базе: ${baseResult.cabinets.length}`);

  // Индексируем базовое расписание
  // Ключ: `${week_type}|${day}|${lesson}|${normGroup(group)}`
  const baseMap = new Map();
  for (const l of baseResult.lessons) {
    const k = `${l.week_type}|${l.day}|${l.lesson}|${normGroup(l.group)}`;
    baseMap.set(k, l);
  }

  // Парсим все файлы замен
  const parsedReplacements = [];
  for (const f of replacementFiles) {
    const buf = fs.readFileSync(f);
    const parsed = await parseReplacementsWorkbook(buf, { fileName: path.basename(f) });
    parsedReplacements.push({
      fileName: path.basename(f),
      result: parsed,
    });
    console.log(
      `Файл замен: ${path.basename(f)} -> Замен: ${parsed.replacementsCount}, Постоянных: ${parsed.permanentCount}, Отмен: ${parsed.cancellationsCount}, Пропущено белых: ${parsed.skippedCount}`
    );
  }

  // ==========================================
  // ШАГ 2. Сравнение базы с заменами
  // ==========================================
  console.log('\n=============================================================');
  console.log('ШАГ 2 & 3. Сравнение и проверка целостности данных');
  console.log('=============================================================');

  let totalReplacementsCount = 0;
  let correctReplacementsCount = 0;
  let addedLessonsCount = 0;
  let cancelNonExistentCount = 0;
  let permanentConflictsCount = 0;
  let duplicateCount = 0;

  const criticalErrors = [];
  const warnings = [];
  const allReplacementTeachers = new Set();
  const allReplacementCabinets = new Set();
  const allReplacementGroups = new Set();

  const allPermanentRows = [];

  for (const fileItem of parsedReplacements) {
    const { fileName, result } = fileItem;
    const fileDate = result.date;
    const fileWeekType = result.weekType;

    // Проверка на дубликаты внутри одного файла замен
    const seenFileKeys = new Map();

    for (const r of result.rows) {
      totalReplacementsCount++;
      const groupKey = normGroup(r.group_name);
      allReplacementGroups.add(r.group_name);
      if (r.teacher) allReplacementTeachers.add(r.teacher);
      if (r.cabinet) allReplacementCabinets.add(r.cabinet);

      // Проверка дубликатов на одну группу и пару
      const dupKey = `${groupKey}|${r.lesson}`;
      if (seenFileKeys.has(dupKey)) {
        duplicateCount++;
        criticalErrors.push({
          type: 'Дубликат замены',
          file: fileName,
          date: fileDate,
          group: r.group_name,
          lesson: r.lesson,
          description: `В одном файле две строки для группы ${r.group_name}, пара ${r.lesson}: "${seenFileKeys.get(dupKey).subject}" vs "${r.subject}"`,
        });
      } else {
        seenFileKeys.set(dupKey, r);
      }

      // Поиск базовой пары
      const baseKeyExact = `${fileWeekType}|${r.day_week.toLowerCase()}|${r.lesson}|${groupKey}`;
      const baseLesson = baseMap.get(baseKeyExact);

      // Также проверяем противоположный тип недели
      const otherWeekType = fileWeekType === 'числитель' ? 'знаменатель' : 'числитель';
      const baseKeyOther = `${otherWeekType}|${r.day_week.toLowerCase()}|${r.lesson}|${groupKey}`;
      const baseLessonOther = baseMap.get(baseKeyOther);

      if (r.type === 'отмена') {
        if (!baseLesson && !baseLessonOther) {
          cancelNonExistentCount++;
          criticalErrors.push({
            type: 'Отмена несуществующей пары',
            file: fileName,
            date: fileDate,
            group: r.group_name,
            lesson: r.lesson,
            description: `Отмена пары ${r.lesson} у группы ${r.group_name} (${r.day_week}), но в базовом расписании на эту пару занятия нет вовсе.`,
            context: { replacement: r, base: null },
          });
        } else {
          correctReplacementsCount++;
        }
      } else if (r.type === 'permanent') {
        allPermanentRows.push({ ...r, fileName });
        if (!baseLesson && !baseLessonOther) {
          addedLessonsCount++;
          warnings.push({
            type: 'Постоянное добавление пары',
            file: fileName,
            date: fileDate,
            group: r.group_name,
            lesson: r.lesson,
            description: `Постоянное изменение ${r.lesson} пары у группы ${r.group_name} (${r.subject}), которой не было в базовом расписании (постоянное добавление).`,
            context: { replacement: r, base: null },
          });
        } else {
          correctReplacementsCount++;
        }
      } else {
        // Обычная разовая замена
        if (!baseLesson && !baseLessonOther) {
          addedLessonsCount++;
          warnings.push({
            type: 'Добавленная пара (не было в базе)',
            file: fileName,
            date: fileDate,
            group: r.group_name,
            lesson: r.lesson,
            description: `В замене указана пара ${r.lesson} у группы ${r.group_name} (${r.subject}), которой не было в базовом шаблоне (разовое добавление пары).`,
            context: { replacement: r, base: null },
          });
        } else {
          correctReplacementsCount++;
          // Сравнение предметов
          const baseSubj = baseLesson ? baseLesson.subject : baseLessonOther.subject;
          if (norm(baseSubj) === norm(r.subject)) {
            // Предмет тот же, замена преподавателя или аудитории
          } else {
            // Полная замена предмета
          }
        }
      }
    }
  }

  // ==========================================
  // Проверка конфликтов permanent
  // ==========================================
  const permByKey = new Map();
  for (const pr of allPermanentRows) {
    const k = `${normGroup(pr.group_name)}|${pr.lesson}`;
    if (!permByKey.has(k)) {
      permByKey.set(k, []);
    }
    permByKey.get(k).push(pr);
  }

  for (const [k, list] of permByKey.entries()) {
    if (list.length > 1) {
      // Проверяем, разные ли предметы/преподаватели
      const first = list[0];
      const different = list.slice(1).some((item) => norm(item.subject) !== norm(first.subject) || norm(item.teacher) !== norm(first.teacher));
      if (different) {
        permanentConflictsCount++;
        warnings.push({
          type: 'Конфликт постоянных изменений (permanent)',
          file: list.map((l) => l.fileName).join(' & '),
          date: list.map((l) => l.date).join(' -> '),
          group: first.group_name,
          lesson: first.lesson,
          description: `Группа ${first.group_name}, пара ${first.lesson} имеет несколько permanent-изменений: ${list.map((l) => `${l.date} (${l.subject}, ${l.teacher})`).join(' vs ')}. По правилам действует последнее по дате.`,
        });
      }
    }
  }

  // ==========================================
  // Проверка преподавателей на опечатки
  // ==========================================
  const allKnownTeachers = Array.from(baseResult.teachers);
  const teacherTypos = [];

  for (const repT of allReplacementTeachers) {
    // Разбиваем если несколько преподавателей через запятую
    const subTeachers = repT.split(',').map((t) => t.trim()).filter(Boolean);
    for (const st of subTeachers) {
      if (!allKnownTeachers.includes(st)) {
        // Ищем близкие совпадения
        const normSt = normTeacher(st);
        let bestMatch = null;
        let minDistance = 999;

        for (const kt of allKnownTeachers) {
          const normKt = normTeacher(kt);
          if (normSt === normKt && st !== kt) {
            // Совпадают без учета пробелов/точек
            bestMatch = kt;
            minDistance = 0;
            break;
          }
          const dist = levenshtein(normSt, normKt);
          if (dist < minDistance && dist <= 3) {
            minDistance = dist;
            bestMatch = kt;
          }
        }

        if (bestMatch) {
          teacherTypos.push({
            inReplacement: st,
            inBase: bestMatch,
            distance: minDistance,
          });
        }
      }
    }
  }

  // Также проверяем опечатки внутри самого базового расписания
  const baseInternalTypos = [];
  for (let i = 0; i < allKnownTeachers.length; i++) {
    for (let j = i + 1; j < allKnownTeachers.length; j++) {
      const t1 = allKnownTeachers[i];
      const t2 = allKnownTeachers[j];
      const n1 = normTeacher(t1);
      const n2 = normTeacher(t2);
      if (n1 === n2 && t1 !== t2) {
        baseInternalTypos.push({ name1: t1, name2: t2, diff: 'пробелы / точки' });
      } else {
        const d = levenshtein(n1, n2);
        if (d >= 1 && d <= 2 && n1.length > 5 && n2.length > 5) {
          // Проверяем фамилию
          const f1 = n1.split(' ')[0];
          const f2 = n2.split(' ')[0];
          if (levenshtein(f1, f2) <= 1) {
            baseInternalTypos.push({ name1: t1, name2: t2, diff: 'буквы в фамилии/инициалах' });
          }
        }
      }
    }
  }

  // ==========================================
  // Проверка неизвестных групп
  // ==========================================
  const unknownGroups = [];
  for (const rg of allReplacementGroups) {
    const found = baseResult.groups.some((bg) => normGroup(bg) === normGroup(rg));
    if (!found) {
      unknownGroups.push(rg);
      criticalErrors.push({
        type: 'Несуществующая группа',
        file: 'Замены',
        group: rg,
        lesson: '-',
        description: `Группа "${rg}" из файла замен отсутствует в базовом расписании колледжа.`,
      });
    }
  }

  // ==========================================
  // Проверка аудиторий
  // ==========================================
  const knownCabinetsNorm = new Set(baseResult.cabinets.map((c) => norm(c)));
  const unknownCabinets = [];
  for (const rc of allReplacementCabinets) {
    if (!rc) continue;
    // Аудитории могут быть "1.2\n5.6"
    const splitAud = rc.split(/[\n,;/ ]+/).map((s) => s.trim()).filter(Boolean);
    for (const a of splitAud) {
      if (!knownCabinetsNorm.has(norm(a))) {
        unknownCabinets.push(a);
      }
    }
  }

  // ==========================================
  // ШАГ 4. Проверка логики mergeScheduleRows
  // ==========================================
  // Тестируем правила слияния на конкретных кейсах
  let mergeLogicPassed = true;
  try {
    const dummyTemplate = [
      { id: 1, date: null, week_type: 'знаменатель', day_week: 'понедельник', lesson: 1, group_name: 'TEST-1', subject: 'База', teacher: 'Т1', cabinet: '1.1' },
      { id: 2, date: null, week_type: 'знаменатель', day_week: 'понедельник', lesson: 2, group_name: 'TEST-1', subject: 'База2', teacher: 'Т2', cabinet: '1.2' },
    ];
    // 1. Permanent отменяется отменой
    const repWithCancel = [
      { id: 10, date: '2026-09-24', week_type: 'знаменатель', day_week: 'понедельник', lesson: 1, group_name: 'TEST-1', subject: 'Постоянная', teacher: 'П1', cabinet: '2.1', type: 'permanent' },
      { id: 11, date: '2026-09-25', week_type: 'знаменатель', day_week: 'понедельник', lesson: 1, group_name: 'TEST-1', subject: '', teacher: '', cabinet: '', type: 'отмена' },
    ];
    const mRes1 = mergeScheduleRows(dummyTemplate, repWithCancel, undefined, '2026-09-25');
    const p1 = mRes1.find((r) => r.lesson === 1);
    if (p1) mergeLogicPassed = false; // Отмена должна удалить пару

    // 2. Замена побеждает permanent на конкретный день
    const repWithOverride = [
      { id: 20, date: '2026-09-24', week_type: 'знаменатель', day_week: 'понедельник', lesson: 1, group_name: 'TEST-1', subject: 'Постоянная', teacher: 'П1', cabinet: '2.1', type: 'permanent' },
      { id: 21, date: '2026-09-25', week_type: 'знаменатель', day_week: 'понедельник', lesson: 1, group_name: 'TEST-1', subject: 'Разовая замена', teacher: 'Р1', cabinet: '3.1', type: 'замена' },
    ];
    const mRes2 = mergeScheduleRows(dummyTemplate, repWithOverride, undefined, '2026-09-25');
    const p2 = mRes2.find((r) => r.lesson === 1);
    if (!p2 || p2.subject !== 'Разовая замена') mergeLogicPassed = false;
  } catch (e) {
    mergeLogicPassed = false;
  }

  // ==========================================
  // ВЫВОД ИТОГОВОГО ОТЧЕТА
  // ==========================================
  console.log('\n\n=============================================================');
  console.log('                 ИТОГОВЫЙ ОТЧЕТ АУДИТА');
  console.log('=============================================================');

  console.log('\n### Статистика');
  console.log(`- Всего проверено замен во всех 3 файлах: ${totalReplacementsCount}`);
  console.log(`- Корректных замен (есть соответствие в базе): ${correctReplacementsCount}`);
  console.log(`- Замен с критическими ошибками: ${criticalErrors.length}`);
  console.log(`- Добавленных пар (не было в базовом шаблоне): ${addedLessonsCount}`);
  console.log(`- Отмен несуществующих пар: ${cancelNonExistentCount}`);
  console.log(`- Конфликтующих permanent на одно место: ${permanentConflictsCount}`);
  console.log(`- Дубликатов в одном файле: ${duplicateCount}`);
  console.log(`- Подозрительных опечаток в преподавателях: ${teacherTypos.length + baseInternalTypos.length}`);
  console.log(`- Неизвестных групп: ${unknownGroups.length}`);
  console.log(`- Неизвестных аудиторий: ${Array.from(new Set(unknownCabinets)).length}`);
  console.log(`- Проверка логики слияния (schedule-merge.ts): ${mergeLogicPassed ? '✅ УСПЕШНО' : '❌ ОШИБКА'}`);

  console.log('\n### Критические ошибки (требуют внимания составителя расписания)');
  if (criticalErrors.length === 0) {
    console.log('Критических ошибок не обнаружено.');
  } else {
    criticalErrors.slice(0, 15).forEach((err, idx) => {
      console.log(`\n${idx + 1}. [${err.type}] Файл: ${err.file}`);
      console.log(`   Дата: ${err.date || '-'} | Группа: ${err.group} | Пара: ${err.lesson}`);
      console.log(`   Суть ошибки: ${err.description}`);
    });
    if (criticalErrors.length > 15) {
      console.log(`   ... и ещё ${criticalErrors.length - 15} критических ошибок.`);
    }
  }

  console.log('\n### Предупреждения (подозрительные расхождения, опечатки)');
  console.log('\n1. Опечатки в написании ФИО преподавателей:');
  const uniqueTypos = [];
  const seenTypo = new Set();
  for (const t of teacherTypos) {
    const k = `${t.inReplacement}|${t.inBase}`;
    if (!seenTypo.has(k)) {
      seenTypo.add(k);
      uniqueTypos.push(t);
    }
  }
  uniqueTypos.slice(0, 10).forEach((t, i) => {
    console.log(`   ${i + 1}) В заменах: "${t.inReplacement}" -> В базе: "${t.inBase}" (дистанция: ${t.distance})`);
  });

  if (baseInternalTypos.length > 0) {
    console.log('\n2. Расхождения в ФИО внутри самого базового расписания:');
    baseInternalTypos.slice(0, 10).forEach((t, i) => {
      console.log(`   ${i + 1}) "${t.name1}" vs "${t.name2}" (${t.diff})`);
    });
  }

  if (unknownCabinets.length > 0) {
    console.log('\n3. Нестандартные аудитории в заменах (отсутствуют в базовом расписании):');
    const uAud = Array.from(new Set(unknownCabinets));
    console.log(`   Список: ${uAud.join(', ')}`);
  }

  console.log('\n### Примеры проблемных строк с полным контекстом');
  let exampleNum = 1;

  // Пример 1: Отмена несуществующей пары
  const cancelErrors = criticalErrors.filter((e) => e.type === 'Отмена несуществующей пары');
  if (cancelErrors.length > 0) {
    console.log(`\nПример ${exampleNum++}: [Отмена несуществующей пары]`);
    const ex = cancelErrors[0];
    console.log(`   Файл: ${ex.file}`);
    console.log(`   Дата: ${ex.date}, Группа: ${ex.group}, Пара: ${ex.lesson}`);
    console.log(`   В замене: указана отмена (клетка пустая с заливкой)`);
    console.log(`   В базе: у группы ${ex.group} на эту пару нет занятия в сетке`);
  }

  // Пример 2: Добавление пары которой нет в базе
  const addedLessons = warnings.filter((w) => w.type === 'Добавленная пара (не было в базе)');
  if (addedLessons.length > 0) {
    console.log(`\nПример ${exampleNum++}: [Добавленная пара]`);
    const ex = addedLessons[0];
    console.log(`   Файл: ${ex.file}`);
    console.log(`   Дата: ${ex.date}, Группа: ${ex.group}, Пара: ${ex.lesson}`);
    console.log(`   В замене: ${ex.context.replacement.subject} (преп: ${ex.context.replacement.teacher}, ауд: ${ex.context.replacement.cabinet})`);
    console.log(`   В базе: пара в шаблоне недели отсутствовала`);
  }

  // Пример 3: Постоянное изменение
  if (allPermanentRows.length > 0) {
    console.log(`\nПример ${exampleNum++}: [Постоянное изменение]`);
    const ex = allPermanentRows[0];
    console.log(`   Файл: ${ex.fileName}`);
    console.log(`   Дата: ${ex.date}, Группа: ${ex.group_name}, Пара: ${ex.lesson}`);
    console.log(`   В замене: ${ex.subject} (${ex.teacher}, ауд: ${ex.cabinet}) [тип permanent]`);
  }

  // Пример 4: Опечатка в фамилии
  if (uniqueTypos.length > 0) {
    console.log(`\nПример ${exampleNum++}: [Опечатка в ФИО]`);
    const ex = uniqueTypos[0];
    console.log(`   В файле замен: "${ex.inReplacement}"`);
    console.log(`   В базовом расписании: "${ex.inBase}"`);
  }

  console.log('\n=============================================================');
  console.log('Аудит успешно завершен.');
  console.log('=============================================================\n');
}

runAudit().catch(console.error);
