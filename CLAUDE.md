# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a coursework project for the MEPHI course **"Интеллектуальный анализ данных"** (Data Mining), in a unit currently covering genetic algorithms. The project studies applying genetic algorithms to the **process scheduler of a processor** (CPU scheduling).

This is primarily a **research/presentation project**, not a software product:
- The main deliverables are theoretical explanation and a presentation (slides/report) covering how genetic algorithms can be applied to process scheduling.
- A demonstrative program may be built later, but it is meant to illustrate the theory (e.g. show GA convergence, compare against classical scheduling policies), not to be a production scheduler or general-purpose GA library.

## Problem statement (fixed model — do not redefine without user confirmation)

**Задача:** оптимизация расписания процессов в многозадачной ОС с одним процессором; все процессы доступны планировщику с самого начала (момента прибытия нет — см. историю в Open items).

Дано `n` процессов, каждый `Pᵢ` характеризуется `pᵢ > 0` (длительность выполнения на CPU), `ioᵢ ≥ 0` (длительность I/O), `qᵢ > 0` (приоритет). Процессор выполняет один процесс за раз; во время I/O процесс не занимает CPU (I/O разных процессов может идти параллельно).

Упрощённая модель: каждый процесс получает свои `pᵢ` квантов CPU (не обязательно подряд), затем ровно одну операцию I/O длительностью `ioᵢ`.

**Хромосома (генотип):** вектор `x = (x₁, …, x_H)`, `xₜ ∈ {1, …, n}`, `H = Σᵢ pᵢ`; `xₜ = i` означает, что в `t`-й квант выполняется `Pᵢ`; номер процесса `i` встречается ровно `pᵢ` раз (напр. при `p₁=2, p₂=2, p₃=1`: `x=(1,1,2,3,2)`). Хромосома **и есть расписание** — отдельного шага декодирования нет. Процесс не обязан идти сплошным блоком: кванты одного процесса могут занимать несмежные позиции.

**Математическая модель:**
- Момент завершения вычислений: `Eᵢ = max{ t | xₜ = i }` (последний квант `Pᵢ`); полное завершение с учётом I/O: `Cᵢ = Eᵢ + ioᵢ`.
- Ограничение на хромосому: `Σₜ [xₜ = i] = pᵢ` для всех `i`.
- Критерий: `F(x) = Σᵢ qᵢCᵢ → min` (взвешенная сумма моментов завершения).

**Генерация допустимого решения/популяции:** список из `pᵢ` копий каждого `i` → случайное перемешивание → это и есть `x`. Популяция размера `M` — повтор `M` раз; повторяющиеся особи по возможности не добавляются. Способ гарантирует допустимость по построению — ремонт/отбраковка не нужны.

**Допустимость:** `valid(x) ⇔ |x|=H ∧ ∀i: Σₜ[xₜ=i]=pᵢ`.

**Fitness особи:** `fitness(x) = 1 / (1 + F(x))` для допустимых `x`; `fitness(x) = 0` для недопустимых.

**Fitness популяции** (`M` особей `X = {x¹,…,xᴹ}`):
- средняя: `fitness_avg = (1/M) Σⱼ fitness(xʲ)`;
- лучшая: `fitness_best = maxⱼ fitness(xʲ)`;
- пропорциональный отбор: `Pr(xʲ) = fitness(xʲ) / Σₖ fitness(xᵏ)`.

Лучшая особь популяции — найденное расписание.

**Критерий остановки:** `g ≥ G_max`, либо `fitness_best` не улучшается `K` поколений подряд. В демо (`runGA`) реализован только первый пункт.

**Важное следствие модели (не подавать иначе):** `F(x) = ΣqᵢEᵢ + Σqᵢ·ioᵢ`, второе слагаемое от расписания не зависит, поэтому I/O порядок не меняет, а задача — это классическая `1||ΣwⱼCⱼ`, решаемая **точно** правилом Смита / WSPT (оптимально и среди вытесняющих расписаний). ГА для *этой* модели не нужен; его роль — универсальный метод, не опирающийся на структуру `F` (переносится на усложнённые постановки), плюс валидация по точному эталону. См. `docs/research_notes.md` §0.

## Repository layout

```
docs/                 research_notes.md, ga_theory_notes.md — source material
talk/                 presentation_script.md, speech.md — slide outline and full speech
presentation/
  Prez_IAD_-RED1.pptx the team's final PowerPoint (30 slides) — the primary deck
  web/                deck.html, ga_history.js, README.md — HTML version of the deck
demo/
  js/                 scheduler_ga.js, run_demo.js, compare_selection.js, render_charts.js
  py/                 ga_model.py, check_wspt.py, selection_pressure.py
  data/               convergence.json, selection_compare_data.js, selection_pressure_data.js
  charts/             *_chart.html + rendered *.svg / *.png
flake.nix, .envrc     devShell with nodejs + python3 (`nix develop` or direnv)
```

No global `node`/`python3` on this machine: use the flake devShell (`nix develop` / direnv), or
`nix-shell -p python3 --run "..."` for the Python scripts. All commands below run from the repo root.
No build/lint/test tooling beyond the demo scripts themselves.

The old `slides/deck.pptx`, `slides/deck_editable.pptx` and `slides/build_*.py` were removed (stale,
predated the `rᵢ` removal; still available in the first commit).

## Research materials

`docs/research_notes.md` — vetted sources: GA for CPU/process scheduling, crossover/mutation operators for
permutation-with-repetition chromosomes (Bierwirth's GOX), classical algorithms (FCFS/SJF/RR/Priority), the
CPU-burst/I/O-burst model, real OS schedulers for contrast (Linux CFS/EEVDF, Windows priority+MMCSS, macOS
QoS, Android EAS — §4a), GA selection theory, and the framing point that the objective is `1||ΣwⱼCⱼ`
solved exactly by Smith's rule / WSPT (§0) — the honest "why GA" narrative is universality of the method,
not that the exact rule fails.

`docs/ga_theory_notes.md` — general GA theory from the user's own course-lecture notes
(`Лекции_по_Ген_Алго.pdf`), reframed for this model: encoding classification, parent vs. survivor
selection, evolution models (Darwin/Lamarck/de Vries/Popper), modifications (Genitor/CHC/hybrid/GAVaPS),
island-model GA, tuning values (`Pc` ≈ 80–95%, `Pm` ≈ 0.5–1%, `N` ≈ 20–30, up to 50–100 for harder
problems). **Resolved design decision:** swap/insertion/reversal mutation trivially preserves the
"`i` appears exactly `pᵢ` times" invariant — only crossover needs a specialized operator.

Read both before writing report/presentation content or changing GA operators.

## Presentation

- `presentation/Prez_IAD_-RED1.pptx` — the team's final deck (30 slides), the primary presentation.
- `talk/speech.md` — full continuous speech (read nearly verbatim) for `Prez_IAD_-RED1.pptx`. Includes a
  worked example: 3 processes (`P1: p=8,q=2`; `P2: p=2,q=3`; `P3: p=5,q=1`; `io=0`) with `F(x)` for FCFS
  (61), Round Robin q=2 (55), SJF (43), Priority (41, coincidentally optimal), WSPT/Smith (41, provably
  optimal — brute-forced over all 6 orders).
- `talk/presentation_script.md` — per-slide visual plan of the original 13-slide outline (audience: not
  CS specialists; overview depth, no proofs). Keep it and `speech.md` in sync.
- `presentation/web/deck.html` — HTML version of the deck: 12 slides of the outline (no "Итоги"), Russian,
  plain HTML/CSS/JS, Google Fonts only external dependency. Navigation: arrows/space/Home/End, click halves,
  swipe, `F` fullscreen, `#slide-N`; bottom rail is a chromosome, one quantum per slide. Diagrams are built
  in page JS from `data-*` attributes and `presentation/web/ga_history.js`. Print to PDF = one slide per
  landscape page. See `presentation/web/README.md` for regenerating `ga_history.js` from
  `demo/data/convergence.json`.

## Demo program

Illustrative, not production code; backs the results slide with real numbers.

- `demo/js/scheduler_ga.js` — the model (chromosome = schedule, no decoding), `objective`/`fitness`,
  **GOX crossover** (Bierwirth 1995; preserves the `pᵢ`-count invariant), swap/insertion/reversal
  mutation, selection with elitism, baselines (FCFS by id, SJF, Priority, WSPT/Smith, Round Robin
  quantum 1), `bruteForceOptimal` (all `n!` process orders — exact for small `n`). `runGA` takes
  `selection: 'proportional' | 'shifted' | 'rank'` (default `proportional`).
- `demo/js/run_demo.js` (`node demo/js/run_demo.js`) — GA on the fixed 6-process set, comparison table and
  validation checks (brute force; WSPT vs brute force; `ioᵢ=0` case where brute force, WSPT and GA agree;
  I/O shift of `F` = `Σqᵢ·ioᵢ`). Writes `demo/data/convergence.json`.
- `demo/js/compare_selection.js` (`node demo/js/compare_selection.js`, ~1.5 min) — the three selection
  schemes on the 6-process set and on 50 random processes with `p≤100` (H=2713), 5 seeds →
  `demo/data/selection_compare_data.js`, plotted by `demo/charts/selection_generations_chart.html`.
- `demo/js/render_charts.js` (`node demo/js/render_charts.js`) — renders both selection charts as static
  light-theme `demo/charts/*.svg` and 2× `*.png` (headless chromium if in PATH) for slides; rerun after
  regenerating data files.
- `demo/py/ga_model.py` — stdlib Python port of the first half of the GA (model, population, validity,
  fitness, stopping criterion, roulette parent selection); prints a step-by-step trace (`--size M`,
  `--random N --p-max P`, `--seed S`), `--check` runs self-checks. Crossover/mutation/survivor selection
  not ported. `rank_probabilities` is not wired into `select_parents` — fitness/selection choice is the
  user's call.
- `demo/py/check_wspt.py` — batch checks of Smith's rule on random instances (block-order brute force,
  exhaustive chromosome enumeration for tiny H, random individuals ≥ WSPT, I/O shift = Σqᵢ·ioᵢ).
- `demo/py/selection_pressure.py` — selection pressure `M·Pr(best)` of proportional (`1/(1+F)`), shifted
  (`F_max−F`) and linear-rank selection vs the scale of `pᵢ` (50 processes, `p≤10…10000`) →
  `demo/data/selection_pressure_data.js`, plotted by `demo/charts/selection_pressure_chart.html`.
- `demo/charts/convergence_chart.html` — convergence + baseline bars for the results slide (published as a
  Claude Artifact); its history array is **inlined**, regenerate after changing the test set or GA params.

Python: `python demo/py/ga_model.py [--check]` inside the devShell, or
`nix-shell -p python3 --run "python demo/py/ga_model.py"`.

**Tuned settings** (`run_demo.js`): population 60, 400 generations, `Pc=0.85`, mutation probability 0.2,
elitism 2, seed 2. The test set's `p`/`io`/`q` are deliberately decorrelated so FCFS/SJF/Priority/WSPT give
different orders (an earlier `q_i = 7 - p_i` made SJF/Priority/WSPT coincide).

**Validated result:** brute force over all `6!=720` orders gives `F=243`; WSPT gives 243 (exact, not a
coincidence); the GA (seed 2) finds 243 only at generation 345 of 400. Seeds 1..20: 10 of 20 reach 243,
the rest end at 244–248 — the GA gives no optimum guarantee, say so in the talk. Priority 252, SJF 260,
Round Robin 363, FCFS 386. With `ioᵢ=0` brute force, WSPT and GA all give `F=167`; 243−167=76 = `Σqᵢ·ioᵢ`.

**Selection findings:** proportional selection on `1/(1+F)` degenerates to random choice as `p` grows
(pressure 1.06× → 1.003×); scaling fitness by a constant cancels out; rank selection stays at 2×. On
6 processes shifted/rank reach the optimum on all seeds, proportional ends at +0.66 % on average; on 50
processes after 400 generations the gap to WSPT is still 145 % (proportional) / 138 % (shifted) / 125 %
(rank) — the GA is far from Smith's rule at this chromosome length.

## Open items

- Numbers are hardcoded in several places: `presentation/web/deck.html`,
  `demo/charts/convergence_chart.html`, `talk/presentation_script.md`, `talk/speech.md` (and the pptx).
  Changing the test set or GA parameters means updating all of them by hand.
- Release times `rᵢ` were tried and abandoned: the model briefly had per-process arrival times (priority-list
  chromosome, non-preemptive `decode()`, idle time, online baselines); everything was reverted to
  chromosome = schedule across `demo/`, the deck, talk and docs. This is why the "why GA" argument is
  framed as universality (see "Важное следствие модели").
- `presentation/web/deck.html` has no "Итоги" (conclusions) slide — it never existed there; the author
  decides whether to add one.
