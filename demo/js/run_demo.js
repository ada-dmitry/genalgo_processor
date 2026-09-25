'use strict';

const fs = require('fs');
const path = require('path');
const {
  scheduleObjective, scheduleToString, runGA,
  fcfs, sjf, priorityScheduling, wsptSmith, roundRobin, bruteForceOptimal,
} = require('./scheduler_ga');

// Тестовый набор процессов для демонстрации (см. presentation_script.md, слайд 10).
// p, o, q подобраны так, чтобы FCFS/SJF/Priority/WSPT давали РАЗНЫЙ порядок —
// иначе на скоррелированных данных все эвристики случайно совпадают. H=23.
const PROCESSES = [
  { id: 1, p: 5, o: 3, q: 5 },
  { id: 2, p: 2, o: 5, q: 1 },
  { id: 3, p: 8, o: 1, q: 2 },
  { id: 4, p: 1, o: 4, q: 6 },
  { id: 5, p: 4, o: 2, q: 3 },
  { id: 6, p: 3, o: 6, q: 4 },
];

function printTable(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const r of rows) console.log(line(r));
}

function main() {
  console.log('=== Исходные данные (n=%d процессов) ===', PROCESSES.length);
  printTable(
    PROCESSES.map((pr) => [pr.id, pr.p, pr.o, pr.q]),
    ['id', 'p_i', 'o_i', 'q_i']
  );
  console.log();

  const gaOpts = { populationSize: 60, generations: 400, pCrossover: 0.85, pMutation: 0.2, eliteCount: 2, seed: 2 };
  const ga = runGA(PROCESSES, gaOpts);

  const baselineSchedules = {
    FCFS: fcfs(PROCESSES),
    SJF: sjf(PROCESSES),
    Priority: priorityScheduling(PROCESSES),
    'WSPT (правило Смита)': wsptSmith(PROCESSES),
    'Round Robin (q=1)': roundRobin(PROCESSES),
  };

  console.log('=== Сравнение F(x) = ΣqᵢCᵢ (меньше — лучше) ===');
  const rows = Object.entries(baselineSchedules).map(
    ([name, schedule]) => [name, scheduleObjective(schedule, PROCESSES)]
  );
  rows.push(['ГА (лучшая особь)', ga.bestObjective]);
  rows.sort((a, b) => a[1] - b[1]);
  printTable(rows, ['Алгоритм', 'F(x)']);
  console.log();
  console.log('Лучшая особь ГА (x[t] — процесс в квант t):', scheduleToString(ga.best));
  console.log();

  // Валидация: точный полный перебор всех n! порядков (см. bruteForceOptimal в
  // scheduler_ga.js) — при n=6 это 720 вариантов, мгновенно. Для этой модели
  // точное решение даёт и правило Смита (I/O добавляет константу ΣqᵢOᵢ), так что
  // перебор, WSPT и ГА можно сверять между собой. Перебор годится лишь для
  // маленьких n, а ГА от структуры целевой функции не зависит.
  const brute = bruteForceOptimal(PROCESSES);
  console.log('=== Валидация против точного перебора (n! = %d порядков) ===', factorial(PROCESSES.length));
  console.log('F(x) точного оптимума (перебор):', brute.objective);
  console.log('F(x) лучшей особи ГА:            ', ga.bestObjective);
  console.log(
    ga.bestObjective === brute.objective
      ? '=> ГА нашёл точный оптимум.'
      : `=> ГА отличается от оптимума на ${ga.bestObjective - brute.objective} (${(((ga.bestObjective / brute.objective) - 1) * 100).toFixed(2)}%).`
  );
  console.log();

  // Сверка перебора с правилом Смита: `o_i` добавляет константу ΣqᵢOᵢ, поэтому
  // WSPT должно совпадать с перебором и на исходном наборе, и при o_i=0.
  const smithF = scheduleObjective(wsptSmith(PROCESSES), PROCESSES);
  console.log('=== Правило Смита (WSPT) против перебора ===');
  console.log('Перебор:', brute.objective, ' WSPT/Smith:', smithF,
    brute.objective === smithF ? '=> совпадают.' : '=> РАСХОЖДЕНИЕ, проверить wsptSmith/bruteForceOptimal.');
  const noIo = PROCESSES.map((pr) => ({ ...pr, o: 0 }));
  const noIoBrute = bruteForceOptimal(noIo).objective;
  const noIoSmith = scheduleObjective(wsptSmith(noIo), noIo);
  const noIoGA = runGA(noIo, gaOpts).bestObjective;
  console.log('o_i=0 (классическая 1||ΣqᵢCᵢ): перебор', noIoBrute, ' WSPT', noIoSmith, ' ГА', noIoGA);
  console.log('Разность F с I/O и без I/O:', brute.objective - noIoBrute, '(= Σ qᵢ·oᵢ =',
    PROCESSES.reduce((s, pr) => s + pr.q * pr.o, 0) + ')');
  console.log();

  const outPath = path.join(__dirname, '..', 'data', 'convergence.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { processes: PROCESSES, gaOpts, history: ga.history, bestObjective: ga.bestObjective, bruteForceOptimal: brute.objective },
      null,
      2
    )
  );
  console.log('История сходимости сохранена в', outPath);
}

function factorial(n) {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

main();
