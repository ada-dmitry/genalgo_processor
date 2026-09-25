'use strict';

// Модель и генетический алгоритм для задачи планирования процессов на одном
// процессоре — см. постановку в CLAUDE.md. Демонстрационный код, не
// production-планировщик.

// --- Seeded PRNG (mulberry32), чтобы прогоны были воспроизводимы ---
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

// --- Модель процессов ---
// processes: массив {id, p, io, q} (id — 1..n, p>0, io>=0, q>0), см. CLAUDE.md.

function horizon(processes) {
  return processes.reduce((s, pr) => s + pr.p, 0);
}

// Хромосома x — это само расписание: x[t] = i означает, что в квант t
// выполняется процесс i (см. CLAUDE.md, "Хромосома"). Любая перестановка
// мультимножества (i встречается p_i раз) — допустимая особь.
function generateIndividual(processes, rng) {
  const genes = [];
  for (const pr of processes) {
    for (let k = 0; k < pr.p; k++) genes.push(pr.id);
  }
  // Fisher-Yates
  for (let i = genes.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [genes[i], genes[j]] = [genes[j], genes[i]];
  }
  return genes;
}

function isValid(x, processes) {
  const H = horizon(processes);
  if (x.length !== H) return false;
  const need = new Map(processes.map((pr) => [pr.id, pr.p]));
  const seen = new Map();
  for (const g of x) {
    if (!need.has(g)) return false;
    seen.set(g, (seen.get(g) || 0) + 1);
  }
  for (const [id, p] of need) {
    if (seen.get(id) !== p) return false;
  }
  return true;
}

function scheduleToString(schedule) {
  return schedule.join(' ');
}

// E_i, C_i, F(x) по расписанию (schedule[t] = id). Общий помощник для
// ГА-хромосом (хромосома и есть расписание) и классических алгоритмов.
function scheduleCompletionTimes(schedule, processes) {
  const lastIndex = new Map();
  schedule.forEach((id, t) => lastIndex.set(id, t));
  const result = new Map();
  for (const pr of processes) {
    const E = (lastIndex.get(pr.id) ?? -1) + 1; // переводим в 1-индексацию квантов
    const C = E + pr.io;
    result.set(pr.id, { E, C });
  }
  return result;
}

function scheduleObjective(schedule, processes) {
  const C = scheduleCompletionTimes(schedule, processes);
  let F = 0;
  for (const pr of processes) F += pr.q * C.get(pr.id).C;
  return F;
}

function completionTimes(x, processes) {
  return scheduleCompletionTimes(x, processes);
}

function objective(x, processes) {
  return scheduleObjective(x, processes);
}

function fitness(x, processes) {
  if (!isValid(x, processes)) return 0;
  return 1 / (1 + objective(x, processes));
}

// --- GOX (Generalized Order Crossover), см. Bierwirth (1995) и research_notes.md ---
// Копируем сегмент хромосомы родителя A как есть, оставшиеся позиции
// достраиваем элементами родителя B в порядке появления, пока не наберём
// нужное число вхождений каждого id (p_i). Гарантированно допустимый потомок.
function gox(parentA, parentB, rng) {
  const H = parentA.length;
  let i = randInt(rng, H);
  let j = randInt(rng, H);
  if (i > j) [i, j] = [j, i];

  const segment = parentA.slice(i, j);
  const segCount = new Map();
  for (const g of segment) segCount.set(g, (segCount.get(g) || 0) + 1);

  const totalCount = new Map();
  for (const g of parentA) totalCount.set(g, (totalCount.get(g) || 0) + 1);

  const remaining = new Map();
  for (const [id, total] of totalCount) {
    remaining.set(id, total - (segCount.get(id) || 0));
  }

  const fill = [];
  for (const g of parentB) {
    if ((remaining.get(g) || 0) > 0) {
      fill.push(g);
      remaining.set(g, remaining.get(g) - 1);
    }
  }

  const child = new Array(H);
  for (let t = i; t < j; t++) child[t] = parentA[t];
  let fillIdx = 0;
  for (let t = 0; t < H; t++) {
    if (t >= i && t < j) continue;
    child[t] = fill[fillIdx++];
  }
  return child;
}

// --- Мутация: обмен / вставка / разворот — все тривиально допустимы,
// т.к. лишь переставляют позиции существующих генов (см. ga_theory_notes.md §4). ---
function mutate(x, rng) {
  const y = x.slice();
  const H = y.length;
  if (H < 2) return y;
  const kind = randInt(rng, 3);
  const i = randInt(rng, H);
  let j = randInt(rng, H);
  while (j === i) j = randInt(rng, H);
  const [lo, hi] = i < j ? [i, j] : [j, i];

  if (kind === 0) {
    // swap
    [y[i], y[j]] = [y[j], y[i]];
  } else if (kind === 1) {
    // insertion: вынуть ген с позиции hi, вставить перед lo
    const gene = y.splice(hi, 1)[0];
    y.splice(lo, 0, gene);
  } else {
    // reversal
    let a = lo, b = hi;
    while (a < b) { [y[a], y[b]] = [y[b], y[a]]; a++; b--; }
  }
  return y;
}

// --- Пропорциональный (рулеточный) отбор ---
function rouletteSelect(population, fits, rng) {
  const total = fits.reduce((s, f) => s + f, 0);
  if (total <= 0) return population[randInt(rng, population.length)];
  let r = rng() * total;
  for (let i = 0; i < population.length; i++) {
    r -= fits[i];
    if (r <= 0) return population[i];
  }
  return population[population.length - 1];
}

// Схемы выбора родителей (параметр selection в runGA):
//  'proportional' — рулетка по fitness = 1/(1+F), как в постановке (по умолчанию);
//  'shifted'      — рулетка по F_max − F (F_max — худшее F популяции);
//  'rank'         — линейный ранговый отбор, лучшая особь имеет вероятность s/M, s=2.
// Умножение fitness на константу пропорциональные вероятности не меняет, поэтому
// «нормировка» отдельной схемой не является.
function makeSelector(scheme, population, fits, rng) {
  if (scheme === 'proportional') return () => rouletteSelect(population, fits, rng);
  if (scheme === 'shifted') {
    const F = fits.map((f) => (f > 0 ? 1 / f - 1 : Infinity));
    const worst = Math.max(...F.filter(Number.isFinite));
    const shifted = F.map((v) => (Number.isFinite(v) ? worst - v : 0));
    return () => rouletteSelect(population, shifted, rng);
  }
  if (scheme === 'rank') {
    const M = population.length, S = 2;
    const order = population.map((x, i) => i).sort((a, b) => fits[b] - fits[a]); // order[0] — лучшая
    const cum = [];
    let acc = 0;
    order.forEach((idx, rank) => {
      acc += M === 1 ? 1 : (S - (2 * S - 2) * rank / (M - 1)) / M;
      cum.push(acc);
    });
    return () => {
      const r = rng() * acc;
      let k = cum.findIndex((c) => r <= c);
      if (k < 0) k = M - 1;
      return population[order[k]];
    };
  }
  throw new Error('unknown selection scheme: ' + scheme);
}

// --- Генетический алгоритм ---
// Параметры по умолчанию — ориентиры из ga_theory_notes.md §6 (лекционный конспект).
function runGA(processes, opts = {}) {
  const {
    populationSize = 30,
    generations = 200,
    pCrossover = 0.85,
    pMutation = 0.15, // вероятность мутации потомка (не побитовая — оператор один на всю особь)
    eliteCount = 1,
    seed = 42,
    selection = 'proportional',
  } = opts;

  const rng = makeRng(seed);
  let population = Array.from({ length: populationSize }, () =>
    generateIndividual(processes, rng)
  );

  const history = [];
  let best = null;
  let bestFitness = -Infinity;

  for (let gen = 0; gen < generations; gen++) {
    const fits = population.map((x) => fitness(x, processes));

    let genBest = -Infinity, genBestX = null, sum = 0;
    for (let i = 0; i < population.length; i++) {
      sum += fits[i];
      if (fits[i] > genBest) { genBest = fits[i]; genBestX = population[i]; }
    }
    if (genBest > bestFitness) { bestFitness = genBest; best = genBestX.slice(); }
    history.push({ generation: gen, best: genBest, avg: sum / population.length });

    // элитизм: сортируем по приспособленности, переносим лучших без изменений
    const order = population
      .map((x, i) => i)
      .sort((a, b) => fits[b] - fits[a]);
    const nextPopulation = order.slice(0, eliteCount).map((i) => population[i]);

    const select = makeSelector(selection, population, fits, rng);
    while (nextPopulation.length < populationSize) {
      const p1 = select();
      const p2 = select();
      let child = rng() < pCrossover ? gox(p1, p2, rng) : p1.slice();
      if (rng() < pMutation) child = mutate(child, rng);
      nextPopulation.push(child);
    }
    population = nextPopulation;
  }

  return { best, bestFitness, bestObjective: objective(best, processes), history };
}

// --- Классические алгоритмы для сравнения ---
// Все процессы доступны с самого начала, поэтому невытесняющие политики —
// это статическая сортировка: выполняем процессы блоками в порядке,
// заданном компаратором.
function greedyNonPreemptive(processes, compare) {
  const order = processes.slice().sort((a, b) => compare(a, b) || a.id - b.id);
  return scheduleFromFixedOrder(order);
}

// FCFS: все процессы «пришли» одновременно, порядок прибытия — по номеру.
function fcfs(processes) {
  return greedyNonPreemptive(processes, (a, b) => a.id - b.id);
}

function sjf(processes) {
  return greedyNonPreemptive(processes, (a, b) => a.p - b.p);
}

function priorityScheduling(processes) {
  return greedyNonPreemptive(processes, (a, b) => b.q - a.q);
}

// Правило Смита / WSPT: по неубыванию p_i/q_i. Точный оптимум задачи
// 1||ΣqᵢCᵢ (research_notes.md §0); слагаемое Σqᵢ·ioᵢ от порядка не зависит,
// поэтому правило точно и при io_i>0.
function wsptSmith(processes) {
  return greedyNonPreemptive(processes, (a, b) => a.p / a.q - b.p / b.q);
}

// Round Robin с квантом 1: по кругу, по одному кванту на процесс.
function roundRobin(processes) {
  const remaining = new Map(processes.map((pr) => [pr.id, pr.p]));
  const queue = processes.map((pr) => pr.id);
  const schedule = [];
  while (queue.length > 0) {
    const id = queue.shift();
    schedule.push(id);
    remaining.set(id, remaining.get(id) - 1);
    if (remaining.get(id) > 0) queue.push(id);
  }
  return schedule;
}

// --- Точный перебор (только для маленьких n — демонстрация "почему нужен ГА") ---
// Перебираем все n! порядков запуска процессов (полные блоки) и берём минимальный
// F(x). Прерывания оптимума не улучшают (правило Смита оптимально и среди
// вытесняющих расписаний, 1|pmtn|ΣwⱼCⱼ при равных r), поэтому это точный оптимум
// и среди произвольных расписаний, которые кодирует хромосома. Для валидации ГА: при n=6 это 720 перестановок,
// мгновенно; уже при n~12-15 перебор практически неприменим.
function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const tail of permutations(rest)) result.push([arr[i], ...tail]);
  }
  return result;
}

function scheduleFromFixedOrder(order) {
  const schedule = [];
  for (const pr of order) {
    for (let k = 0; k < pr.p; k++) schedule.push(pr.id);
  }
  return schedule;
}

function bruteForceOptimal(processes) {
  let bestF = Infinity, bestOrder = null, bestSchedule = null;
  for (const order of permutations(processes)) {
    const schedule = scheduleFromFixedOrder(order);
    const F = scheduleObjective(schedule, processes);
    if (F < bestF) {
      bestF = F;
      bestOrder = order.map((pr) => pr.id);
      bestSchedule = schedule;
    }
  }
  return { order: bestOrder, schedule: bestSchedule, objective: bestF };
}

module.exports = {
  makeRng, randInt,
  horizon, generateIndividual, isValid,
  scheduleToString, scheduleCompletionTimes, scheduleObjective,
  completionTimes, objective, fitness,
  gox, mutate, rouletteSelect, makeSelector, runGA,
  scheduleFromFixedOrder, fcfs, sjf, priorityScheduling, wsptSmith, roundRobin,
  bruteForceOptimal,
};
