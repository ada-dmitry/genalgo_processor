'use strict';

// Сравнение схем выбора родителей по поколениям: как лучшее F приближается к
// точному оптимуму (правило Смита) при selection = proportional | shifted | rank.
// Два набора: 6 процессов из run_demo.js и 50 случайных процессов с p до 100.
// Метрика — отрыв лучшего F от оптимума в %, среднее по нескольким seed.
// Пишет demo/data/selection_compare_data.js (window.SC_DATA) для selection_generations_chart.html.
// Запуск: node demo/js/compare_selection.js  (около 1.5 минут)

const fs = require('fs');
const path = require('path');
const g = require('./scheduler_ga');

const GA = { populationSize: 60, generations: 400, pCrossover: 0.85, pMutation: 0.2, eliteCount: 2 };
const SEEDS = [1, 2, 3, 4, 5];
const SCHEMES = ['proportional', 'shifted', 'rank'];

// копия тестового набора из run_demo.js
const SMALL = [
  { id: 1, p: 5, io: 3, q: 5 },
  { id: 2, p: 2, io: 5, q: 1 },
  { id: 3, p: 8, io: 1, q: 2 },
  { id: 4, p: 1, io: 4, q: 6 },
  { id: 5, p: 4, io: 2, q: 3 },
  { id: 6, p: 3, io: 6, q: 4 },
];

function randomProcesses(n, pMax, seed) {
  const rng = g.makeRng(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    p: 1 + g.randInt(rng, pMax),
    io: g.randInt(rng, 11),
    q: 1 + g.randInt(rng, 10),
  }));
}

function run(name, processes) {
  const optF = g.scheduleObjective(g.wsptSmith(processes), processes); // точный оптимум
  const series = {};
  for (const scheme of SCHEMES) {
    const sum = new Array(GA.generations).fill(0);
    for (const seed of SEEDS) {
      const { history } = g.runGA(processes, { ...GA, seed, selection: scheme });
      history.forEach((h, k) => { sum[k] += (1 / h.best - 1) / optF - 1; });
    }
    series[scheme] = sum.map((v) => Math.round((v / SEEDS.length) * 10000) / 100); // %
    console.log(name, scheme, 'финальный отрыв, %:', series[scheme][GA.generations - 1]);
  }
  return { name, n: processes.length, H: g.horizon(processes), optF, series };
}

const data = {
  ga: { ...GA, seeds: SEEDS.length },
  instances: [
    run('6 процессов (демо)', SMALL),
    run('50 процессов, p ≤ 100', randomProcesses(50, 100, 11)),
  ],
};
const out = path.join(__dirname, '..', 'data', 'selection_compare_data.js');
fs.writeFileSync(out, 'window.SC_DATA = ' + JSON.stringify(data) + ';\n');
console.log('записано', out);
