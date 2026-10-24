// ============================================================
// 博客 UI 原型 — 变体切换器 + 站内页面切换 + 标签筛选
// 一次性原型代码：无持久化、无错误处理，只为对比三个变体。
// ============================================================
import { wireTheme, wireReadouts, wireParallax } from './assets/fx.js';

const KEYS = ['A', 'B', 'C', 'D'];
const NAMES = {
  A: '顶部导航 · 档案馆',
  B: '左侧栏 · 运行日志',
  C: '极简 · 大开本杂志',
  D: '简洁 · 安静阅读型',
};

const panes = Object.fromEntries(
  KEYS.map((k) => [k, document.querySelector(`[data-vpane="${k}"]`)]),
);

function currentVariant() {
  const v = new URLSearchParams(location.search).get('variant');
  return KEYS.includes(v?.toUpperCase()) ? v.toUpperCase() : 'A';
}

function showPage(pane, name) {
  pane.querySelectorAll('.pg').forEach((pg) => {
    pg.hidden = pg.dataset.pg !== name;
  });
  // aria-current 只标在导航里的链接上，正文里的跳转链接不标
  pane.querySelectorAll('nav [data-nav]').forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  pane.dataset.page = name;
}

function showVariant(k) {
  KEYS.forEach((key) => {
    panes[key].hidden = key !== k;
  });
  // 恢复该变体上次所在的页面（首次进入为首页）
  showPage(panes[k], panes[k].dataset.page || 'home');
  document.querySelector('.pt-label').innerHTML = `<b>${k}</b>${NAMES[k]}`;
  window.scrollTo({ top: 0 });
}

function cycle(dir) {
  const cur = KEYS.indexOf(currentVariant());
  const next = KEYS[(cur + dir + KEYS.length) % KEYS.length];
  history.replaceState(null, '', `?variant=${next}`);
  showVariant(next);
}

// 底栏箭头
document.querySelector('.pt-prev').addEventListener('click', () => cycle(-1));
document.querySelector('.pt-next').addEventListener('click', () => cycle(1));

// 键盘左右切换变体（正在输入时不拦截）
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable]')) return;
  cycle(e.key === 'ArrowRight' ? 1 : -1);
});

// 站内导航（每个变体自己的页面切换）
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-nav]');
  if (!a) return;
  e.preventDefault();
  const pane = a.closest('[data-vpane]');
  showPage(pane, a.dataset.nav);
  window.scrollTo({ top: 0, behavior: 'instant' });
});

// 随笔标签筛选（chips 过滤记录行 / 大字条目）
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.ef-chip[data-tag]');
  if (!chip) return;
  const scope = chip.closest('.chips')?.parentElement;
  if (!scope) return;
  chip.parentElement.querySelectorAll('.ef-chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c === chip));
  });
  const tag = chip.dataset.tag;
  scope.querySelectorAll('[data-tags]').forEach((row) => {
    const hider = row.closest('li') ?? row;
    hider.hidden = tag !== '*' && !row.dataset.tags.split(' ').includes(tag);
  });
});

showVariant(currentVariant());
wireTheme();
wireReadouts(document);
wireParallax(document.querySelector('[data-vpane="A"] [data-hero]'));
