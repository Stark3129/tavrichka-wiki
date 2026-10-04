import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/Voyager764/.gemini/antigravity/brain/f7811ee6-aef9-4269-8fce-04313b40db4f/scratch/node_modules/puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Voyager764\\.gemini\\antigravity\\brain\\f7811ee6-aef9-4269-8fce-04313b40db4f';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const WIDTHS = [1024, 1280, 1440, 1920];

async function checkOverlapsOnPage(page) {
  return await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return { error: 'No header element found' };
    const container = header.querySelector('div');
    if (!container) return { error: 'No header container found' };

    // Проверка видимости заголовка "Тавричка Вики"
    const logoLink = container.querySelector('a[href="/"]');
    const titleSpan = logoLink ? logoLink.querySelector('span:last-child') : null;
    const badgeSpan = logoLink ? logoLink.querySelector('span:first-child') : null;

    const titleRect = titleSpan ? titleSpan.getBoundingClientRect() : null;
    const badgeRect = badgeSpan ? badgeSpan.getBoundingClientRect() : null;
    const isTitleVisible = Boolean(
      titleRect &&
      titleRect.width > 30 &&
      titleRect.height > 0 &&
      window.getComputedStyle(titleSpan).display !== 'none'
    );

    // 1. Попарные пересечения дочерних элементов верхнего уровня
    const topChildren = Array.from(container.children).filter((el) => {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });

    const topRects = topChildren.map((el) => ({
      name: el.tagName + (el.className ? `.${el.className.split(' ')[0]}` : ''),
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
      rect: el.getBoundingClientRect(),
    }));

    const topOverlaps = [];
    for (let i = 0; i < topRects.length; i++) {
      for (let j = i + 1; j < topRects.length; j++) {
        const a = topRects[i].rect;
        const b = topRects[j].rect;
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (xOverlap > 0.5 && yOverlap > 0.5) {
          topOverlaps.push({
            itemA: `${topRects[i].name} ("${topRects[i].text}")`,
            itemB: `${topRects[j].name} ("${topRects[j].text}")`,
            overlapWidth: Math.round(xOverlap * 10) / 10,
          });
        }
      }
    }

    // 2. Детальная проверка всех видимых интерактивных элементов в строке
    const items = [];
    if (logoLink) items.push({ name: 'Логотип [2.8 Тавричка Вики]', el: logoLink });

    const navLinks = container.querySelectorAll('nav a');
    navLinks.forEach((l) => {
      items.push({ name: `Пункт навигации: "${l.textContent.trim()}"`, el: l });
    });

    const rightBlock = container.children[container.children.length - 1];
    if (rightBlock) {
      const interactive = rightBlock.querySelectorAll('a, button, span, form');
      interactive.forEach((el) => {
        // Пропускаем вложенные элементы внутри кнопок/ссылок
        if (el.tagName === 'SPAN' && (el.closest('button') || (el.parentElement && el.parentElement.tagName === 'A'))) return;
        if (el.tagName === 'FORM') return; // кнопка внутри формы учитывается отдельно
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const label = el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName;
        items.push({ name: `Правый блок: "${label}"`, el });
      });
    }

    const itemOverlaps = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].el.contains(items[j].el) || items[j].el.contains(items[i].el)) continue;
        const a = items[i].el.getBoundingClientRect();
        const b = items[j].el.getBoundingClientRect();
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (xOverlap > 0.5 && yOverlap > 0.5) {
          itemOverlaps.push({
            itemA: items[i].name,
            itemB: items[j].name,
            overlapWidth: Math.round(xOverlap * 10) / 10,
          });
        }
      }
    }

    return {
      isTitleVisible,
      titleText: titleSpan ? titleSpan.textContent.trim() : null,
      topOverlaps,
      itemOverlaps,
      itemCount: items.length,
    };
  });
}

async function main() {
  console.log(`Проверка наложений шапки на ${BASE_URL}...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  console.log('\n=== 1. ПРОВЕРКА В ГОСТЕВОМ РЕЖИМЕ ===');
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 800 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    const result = await checkOverlapsOnPage(page);
    console.log(`\nШирина: ${width}px`);
    console.log(`  Заголовок "Тавричка Вики" виден: ${result.isTitleVisible ? '✅ ДА' : '❌ НЕТ'}`);
    console.log(`  Элементов в строке шапки: ${result.itemCount}`);
    console.log(`  Пересечений верхнего уровня: ${result.topOverlaps.length === 0 ? '0 (пусто ✅)' : result.topOverlaps.length}`);
    if (result.topOverlaps.length > 0) {
      console.log('    Конфликты:', result.topOverlaps);
    }
    console.log(`  Детальных попарных пересечений: ${result.itemOverlaps.length === 0 ? '0 (пусто ✅)' : result.itemOverlaps.length}`);
    if (result.itemOverlaps.length > 0) {
      console.log('    Конфликты:', result.itemOverlaps);
    }

    if (width === 1280 || width === 1920) {
      const headerEl = await page.$('header');
      const filename = `desktop_header_${width}.png`;
      if (headerEl) {
        await headerEl.screenshot({ path: path.join(ARTIFACTS_DIR, filename) });
        console.log(`  📸 Скриншот шапки сохранён: ${filename}`);
      }
    }
  }

  // Попытка авторизации
  console.log('\n=== 2. ПОПЫТКА ВХОДА В ТЕСТОВЫЙ АККАУНТ ===');
  try {
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('#auth-email', 'qa_student_test@tavrichka.ru');
    await page.type('#auth-password', 'testing123');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise((r) => setTimeout(r, 2500));
    }

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const isLogged = await page.evaluate(() => Boolean(document.querySelector('form button[type="submit"]')));

    if (isLogged) {
      console.log('✅ Успешный вход в систему! Проверяем авторизованную шапку:');
      for (const width of WIDTHS) {
        await page.setViewport({ width, height: 800 });
        await new Promise((r) => setTimeout(r, 400));
        const result = await checkOverlapsOnPage(page);
        console.log(`\nШирина: ${width}px (авторизован)`);
        console.log(`  Заголовок "Тавричка Вики" виден: ${result.isTitleVisible ? '✅ ДА' : '❌ НЕТ'}`);
        console.log(`  Элементов в строке: ${result.itemCount}`);
        console.log(`  Пересечений: ${result.itemOverlaps.length === 0 ? '0 (пусто ✅)' : result.itemOverlaps.length}`);
        if (result.itemOverlaps.length > 0) {
          console.log('    Конфликты:', result.itemOverlaps);
        }

        if (width === 1280 || width === 1920) {
          const headerEl = await page.$('header');
          const filename = `desktop_header_auth_${width}.png`;
          if (headerEl) {
            await headerEl.screenshot({ path: path.join(ARTIFACTS_DIR, filename) });
            console.log(`  📸 Скриншот авторизованной шапки сохранён: ${filename}`);
          }
        }
      }
    } else {
      console.log('ℹ️ Авторизация через тестовый логин не завершилась (возможно требуется локальная сессия).');
    }
  } catch (err) {
    console.log('ℹ️ Проверка авторизованной сессии пропущена:', err.message);
  }

  await browser.close();
  console.log('\nПроверка завершена.');
}

main().catch(console.error);
