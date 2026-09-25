'use strict';

// Статичные графики (SVG + PNG) по данным compare_selection.js и selection_pressure.py.
//   demo/charts/selection_generations.svg|png — отрыв лучшего F от оптимума по поколениям
//   demo/charts/selection_pressure.svg|png    — давление отбора M·Pr(лучшая) против масштаба p
// Светлая схема, цвета зашиты в SVG (файл самодостаточен, годится для слайдов и печати).
// PNG строится тем же chromium в headless-режиме, если он есть в PATH; иначе остаётся только SVG.
// Запуск: node demo/js/render_charts.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'charts');
const C = {
  surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
  grid: '#e1e0d9', axis: '#c3c2b7', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a',
};
const FONT = "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif";
const SERIES = [
  { key: 'proportional', color: C.s1, label: 'пропорциональный, fitness = 1/(1+F)', tip: 'пропорциональный' },
  { key: 'shifted', color: C.s2, label: 'пропорциональный со сдвигом F_max − F', tip: 'со сдвигом' },
  { key: 'rank', color: C.s3, label: 'ранговый отбор (s = 2)', tip: 'ранговый' },
];

const load = (f) => new Function('window', fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8') + '; return window;')({});
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (v) => Math.round(v * 10) / 10;
const ru = (v, d) => v.toFixed(d).replace('.', ',');

function text(x, y, s, o = {}) {
  const { size = 12, fill = C.muted, anchor = 'start', weight = 400 } = o;
  return `<text x="${num(x)}" y="${num(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`;
}
const line = (x1, y1, x2, y2, stroke, extra = '') =>
  `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="1" ${extra}/>`;
const dot = (x, y, color, r = 4.5) =>
  `<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${color}" stroke="${C.surface}" stroke-width="2"/>`;
const path2 = (pts, color) =>
  `<path d="${pts.map(([x, y], i) => (i ? 'L' : 'M') + num(x) + ',' + num(y)).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

function legend(x, y) {
  let out = '', cx = x;
  for (const s of SERIES) {
    out += `<line x1="${cx}" y1="${y - 4}" x2="${cx + 18}" y2="${y - 4}" stroke="${s.color}" stroke-width="2" stroke-linecap="round"/>`;
    out += text(cx + 26, y, s.label, { size: 13, fill: C.ink2 });
    cx += 26 + s.label.length * 6.9 + 22;
  }
  return out;
}

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">\n` +
    `<rect width="${w}" height="${h}" fill="${C.surface}"/>\n${body}\n</svg>\n`;
}

function niceStep(max) {
  const raw = max / 5, pow = 10 ** Math.floor(Math.log10(raw)), f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

// раздвигаем прямые подписи, чтобы не налезали друг на друга
function spread(labels, gap) {
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < gap) labels[i].y = labels[i - 1].y + gap;
  return labels;
}

// --- график по поколениям ---
function generationsChart(D) {
  const W = 1000, PH = 300, G = D.ga.generations;
  const m = { l: 68, r: 210, t: 14, b: 46 };
  const pw = W - m.l - m.r;
  let y0 = 108, body = '';
  body += text(m.l - 8, 38, 'Сходимость ГА по поколениям при разных схемах выбора родителей', { size: 21, fill: C.ink, weight: 600 });
  body += text(m.l - 8, 60, `Популяция M = ${D.ga.populationSize}, ${G} поколений, Pc = ${ru(D.ga.pCrossover, 2)}, Pm = ${ru(D.ga.pMutation, 1)}, элитизм = ${D.ga.eliteCount}; среднее по ${D.ga.seeds} запускам с разными seed`, { size: 13, fill: C.ink2 });
  body += legend(m.l - 8, 88);

  for (const inst of D.instances) {
    body += text(m.l - 8, y0 + 4, `${inst.name} — n = ${inst.n}, H = ${inst.H}, точный оптимум F = ${inst.optF}`, { size: 14, fill: C.ink, weight: 600 });
    const top = y0 + 14, ph = PH - m.t - m.b;
    const all = SERIES.flatMap((s) => inst.series[s.key]);
    const step = niceStep(Math.max(...all) * 1.02);
    const yMax = Math.ceil(Math.max(...all) * 1.02 / step) * step;
    const sx = (g) => m.l + (g / (G - 1)) * pw;
    const sy = (v) => top + m.t + (1 - v / yMax) * ph;

    for (let v = 0; v <= yMax + 1e-9; v += step) {
      body += line(m.l, sy(v), m.l + pw, sy(v), v === 0 ? C.muted : C.grid, v === 0 ? 'stroke-dasharray="4 4"' : '');
      body += text(m.l - 10, sy(v) + 4, `${Math.round(v * 100) / 100} %`, { anchor: 'end' });
    }
    for (const g of [0, 100, 200, 300, G - 1]) {
      body += line(sx(g), sy(0), sx(g), sy(0) + 5, C.axis);
      body += text(sx(g), sy(0) + 20, String(g), { anchor: 'middle' });
    }
    body += text(m.l + pw / 2, sy(0) + 38, 'поколение (0 % — точный оптимум)', { size: 12, fill: C.ink2, anchor: 'middle' });
    for (const s of SERIES) body += path2(inst.series[s.key].map((v, g) => [sx(g), sy(v)]), s.color);

    const labels = spread(SERIES.map((s) => ({ s, v: inst.series[s.key][G - 1], y: sy(inst.series[s.key][G - 1]) + 4 })), 15);
    for (const l of labels) {
      body += dot(sx(G - 1), sy(l.v), l.s.color);
      body += text(sx(G - 1) + 14, l.y, `${ru(l.v, l.v >= 10 ? 1 : 2)} %  ${l.s.tip}`, { size: 12.5, fill: C.ink2 });
    }
    y0 += PH + 34;
  }
  body += text(m.l - 8, y0 - 6, 'Отрыв лучшего найденного F от точного оптимума (правило Смита), %; 0 % — оптимум найден.', { size: 12, fill: C.ink2 });
  return svgDoc(W, y0 + 14, body);
}

// --- график давления отбора ---
function pressureChart(D) {
  const W = 1000, H = 520, rows = D.rows;
  const m = { l: 68, r: 300, t: 116, b: 92 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xMin = Math.log10(rows[0].p_max), xMax = Math.log10(rows[rows.length - 1].p_max);
  const yMin = 0.5, yMax = 4.5;
  const sx = (p) => m.l + ((Math.log10(p) - xMin) / (xMax - xMin)) * pw;
  const sy = (v) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
  let body = '';
  body += text(m.l - 8, 38, 'Давление отбора: во сколько раз лучшая особь выбирается чаще случайного', { size: 21, fill: C.ink, weight: 600 });
  body += text(m.l - 8, 60, `${D.meta.n} процессов, популяция M = ${D.meta.M}, pᵢ ~ U[1, p_max]; среднее по ${D.meta.seeds} независимым популяциям на точку`, { size: 13, fill: C.ink2 });
  body += legend(m.l - 8, 88);
  for (const v of [1, 2, 3, 4]) {
    body += line(m.l, sy(v), m.l + pw, sy(v), C.grid);
    body += text(m.l - 10, sy(v) + 4, `${v}×`, { anchor: 'end' });
  }
  for (const p of [10, 100, 1000, 10000]) {
    body += line(sx(p), sy(yMin), sx(p), sy(yMin) + 5, C.axis);
    body += text(sx(p), sy(yMin) + 20, String(p), { anchor: 'middle' });
  }
  body += line(m.l, sy(yMin), m.l + pw, sy(yMin), C.axis);
  body += text(m.l + pw / 2, sy(yMin) + 40, 'p_max — верхняя граница pᵢ (логарифмическая шкала)', { size: 12, fill: C.ink2, anchor: 'middle' });
  body += line(m.l, sy(1), m.l + pw, sy(1), C.muted, 'stroke-dasharray="4 4"');
  body += text(m.l + 6, sy(1) + 16, 'случайный выбор (1×)', { size: 12.5, fill: C.ink2 });
  for (const s of SERIES) body += path2(rows.map((r) => [sx(r.p_max), sy(r[s.key])]), s.color);
  for (const s of SERIES) for (const r of rows) body += dot(sx(r.p_max), sy(r[s.key]), s.color);
  const last = rows[rows.length - 1];
  for (const l of spread(SERIES.map((s) => ({ s, v: last[s.key], y: sy(last[s.key]) + 4 })), 15)) {
    body += text(sx(last.p_max) + 14, l.y, `${ru(l.v, 2)}×  ${l.s.tip}`, { size: 12.5, fill: C.ink2 });
  }
  body += text(m.l - 8, H - 16, 'M·Pr(лучшая особь): 1× — рулетка не отличает лучшую особь от случайной. Умножение fitness на константу вероятности не меняет.', { size: 12, fill: C.ink2 });
  return svgDoc(W, H, body);
}

function toPng(svgPath, w, h) {
  const png = svgPath.replace(/\.svg$/, '.png');
  for (const bin of ['chromium', 'google-chrome-stable', 'chromium-browser']) {
    try {
      execFileSync(bin, ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--force-device-scale-factor=2', `--window-size=${w},${h}`, `--screenshot=${png}`, 'file://' + svgPath],
        { stdio: 'ignore', timeout: 60000 });
      return png;
    } catch (e) { /* пробуем следующий бинарник */ }
  }
  return null;
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['selection_generations', generationsChart(load('selection_compare_data.js').SC_DATA)],
  ['selection_pressure', pressureChart(load('selection_pressure_data.js').SP_DATA)],
];
for (const [name, svg] of jobs) {
  const p = path.join(OUT, name + '.svg');
  fs.writeFileSync(p, svg);
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  const png = toPng(p, +w, +h);
  console.log(path.relative(process.cwd(), p), png ? '+ png' : '(png не построен: нет chromium)');
}
