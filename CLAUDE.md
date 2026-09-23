# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a coursework project for the MEPHI course **"Интеллектуальный анализ данных"** (Data Mining), in a unit currently covering genetic algorithms. The project studies applying genetic algorithms to the **process scheduler of a processor** (CPU scheduling).

This is primarily a **research/presentation project**, not a software product:
- The main deliverables are theoretical explanation and a presentation (slides/report) covering how genetic algorithms can be applied to process scheduling.
- A demonstrative program may be built later, but it is meant to illustrate the theory (e.g. show GA convergence, compare against classical scheduling policies), not to be a production scheduler or general-purpose GA library.

## Problem statement (fixed model — do not redefine without user confirmation)

**Задача:** оптимизация расписания процессов в многозадачной ОС с одним процессором; все процессы доступны планировщику с самого начала (момента прибытия нет — см. историю в Open items).

Дано `n` процессов, каждый `Pᵢ` характеризуется `pᵢ > 0` (длительность выполнения на CPU), `oᵢ ≥ 0` (длительность I/O), `qᵢ > 0` (приоритет). Процессор выполняет один процесс за раз; во время I/O процесс не занимает CPU (I/O разных процессов может идти параллельно).

Упрощённая модель: каждый процесс получает свои `pᵢ` квантов CPU (не обязательно подряд), затем ровно одну операцию I/O длительностью `oᵢ`.

**Хромосома (генотип):** вектор `x = (x₁, …, x_H)`, `xₜ ∈ {1, …, n}`, `H = Σᵢ pᵢ`; `xₜ = i` означает, что в `t`-й квант выполняется `Pᵢ`; номер процесса `i` встречается ровно `pᵢ` раз (напр. при `p₁=2, p₂=2, p₃=1`: `x=(1,1,2,3,2)`). Хромосома **и есть расписание** — отдельного шага декодирования нет. Процесс не обязан идти сплошным блоком: кванты одного процесса могут занимать несмежные позиции.

**Математическая модель:**
- Момент завершения вычислений: `Eᵢ = max{ t | xₜ = i }` (последний квант `Pᵢ`); полное завершение с учётом I/O: `Cᵢ = Eᵢ + oᵢ`.
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

**Важное следствие модели (не подавать иначе):** `F(x) = ΣqᵢEᵢ + Σqᵢoᵢ`, второе слагаемое от расписания не зависит, поэтому I/O порядок не меняет, а задача — это классическая `1||ΣwⱼCⱼ`, решаемая **точно** правилом Смита / WSPT (оптимально и среди вытесняющих расписаний). ГА для *этой* модели не нужен; его роль — универсальный метод, не опирающийся на структуру `F` (переносится на усложнённые постановки), плюс валидация по точному эталону. См. `research_notes.md` §0.

## Research materials

`research_notes.md` collects vetted sources on: GA applied to CPU/process scheduling, crossover/mutation
operators for permutation-with-repetition chromosomes (the key open design question — see Bierwirth's GOX
operator), classical scheduling algorithms for comparison (FCFS/SJF/RR/Priority), the CPU-burst/I/O-burst
OS model, real-world OS scheduler design for contrast (Linux CFS/EEVDF, Windows priority+MMCSS, macOS QoS,
Android EAS — §4a), and GA selection-scheme theory. It also documents an important framing point: this
project's objective is the classical `1||ΣwⱼCⱼ` problem (I/O only adds the constant `Σqᵢoᵢ`), solved exactly by **Smith's rule / WSPT**
— useful as a validation baseline for the demo; the honest "why GA" narrative is universality of the method, not that the exact rule fails. Read it before writing the report/presentation content or picking a
crossover operator.

`ga_theory_notes.md` collects general GA theory from the user's own course-lecture notes (same course,
`Лекции_по_Ген_Алго.pdf`), reframed against this project's specific model: encoding classification, parent
selection vs. survivor selection terminology, evolution models (Darwin/Lamarck/de Vries/Popper) for the
theory slide, GA modifications (Genitor/CHC/hybrid/GAVaPS) and island-model parallel GA for a "future work"
slide, and concrete tuning reference values (`Pc` ≈ 80–95%, `Pm` ≈ 0.5–1%, `N` ≈ 20–30, up to 50–100 for
harder problems). **Key resolved design decision:** for this project's permutation-with-repetition
chromosome, swap/insertion/reversal mutation (picking two positions and rearranging them) trivially
preserves the "`i` appears exactly `pᵢ` times" invariant with no repair needed — unlike crossover, mutation
does *not* need a specialized operator here. Read it alongside `research_notes.md` before writing the
report/presentation or implementing the GA.

## Presentation script

`presentation_script.md` is the per-slide draft narration for the 13-slide outline (audience: not
CS-specialists, but normal technical terms are fine — overview depth, no derivations/proofs). Covers: the
scheduling problem, classical algorithms, a real-OS scheduler comparison slide, this project's formal
model, the "why GA" Smith's-rule argument, GA lifecycle, how the model maps onto a GA, the crossover/
mutation operator specifics, results (slide 10, filled in with real demo numbers), conclusions, and future
work.

`speech.md` is the full continuous speech built from that same outline — not slide-by-slide notes but
connected spoken prose meant to be read/rehearsed nearly verbatim (~18-22 min). It elaborates the classical
algorithms (§3) and Smith's-rule (§6) sections with a worked numeric example: 3 processes (`P1: p=8,q=2`;
`P2: p=2,q=3`; `P3: p=5,q=1`; `o=0`), showing the actual resulting order and `F(x)` for FCFS (61), Round
Robin q=2 (55), SJF (43), Priority Scheduling (41, coincidentally optimal here), and WSPT/Smith's rule (41,
provably optimal — confirmed by brute-forcing all 6 orderings). Keep `speech.md` and `presentation_script.md`
in sync if either changes — `speech.md` is strictly more detailed, built on top of the same slide structure.

## Demo program

`demo/` is a small illustrative implementation in **plain Node.js** (no npm dependencies — this machine has
no Python interpreter installed, only Node). Not production code; exists to back slide 10 with real numbers.

- `demo/scheduler_ga.js` — the model: chromosome generation, `objective`/`fitness` per the formulas above
  (the chromosome is the schedule itself, no decoding step), **GOX crossover**
  (Bierwirth 1995, generalized order crossover — copies a segment from one parent, fills the rest from the
  other in order, guaranteed to preserve the "`i` appears exactly `pᵢ` times" invariant), **mutation** via
  swap/insertion/reversal (trivially valid, see `ga_theory_notes.md` §4), roulette selection with elitism,
  the classical baselines (FCFS by process id, SJF, Priority, WSPT/Smith's rule, Round Robin with quantum 1),
  and `bruteForceOptimal` (exhaustive search over all `n!` process orders — exact ground truth for small
  `n`; intractable once `n` grows).
- `demo/run_demo.js` — runs the GA on a fixed 6-process test set and prints a comparison table plus
  validation checks (`bruteForceOptimal` on the full test set; WSPT vs brute force; the same with `oᵢ=0`,
  where brute force, WSPT and the GA must agree, and the check that the I/O shift of `F` equals `Σqᵢoᵢ`); run
  with `node demo/run_demo.js` from the repo root (or from inside `demo/`). Writes `demo/convergence.json`
  (per-generation best/avg fitness history plus the brute-force optimum).
- `demo/ga_model.py` — Python port of the first half of the GA (stdlib only): model, individual, population generation, validity, fitness of individual/population, stopping criterion, roulette parent selection; by default prints a step-by-step trace (data → first individual → population → fitness/probabilities → stopping criterion → roulette parent selection; flags `--size M`, `--random N --p-max P`, `--seed S`), `--check` runs the asserting self-checks (`nix-shell -p python3 --run "python demo/ga_model.py [--check]"` — no global Python). Crossover/mutation/survivor selection are not ported yet. `demo/check_wspt.py` — batch checks of Smith's rule on random instances (block-order brute force, exhaustive chromosome enumeration for tiny H, random individuals ≥ WSPT, I/O shift = Σqᵢoᵢ); `ga_model.py --random N --seed S` uses random processes. `demo/selection_pressure.py` computes selection pressure `M·Pr(best)` of proportional (`1/(1+F)`), shifted (`F_max−F`) and linear-rank selection vs the scale of `pᵢ` (50 processes, `p≤10…10000`) into `demo/selection_pressure_data.js`; `demo/selection_pressure_chart.html` plots it. Finding: proportional selection on `1/(1+F)` degenerates to random choice (1.06× → 1.003×) as `p` grows; scaling fitness by a constant does nothing (it cancels), rank selection stays at 2×. `runGA` in `scheduler_ga.js` takes `selection: 'proportional' | 'shifted' | 'rank'` (default `proportional` — results unchanged); `demo/compare_selection.js` (`node demo/compare_selection.js`, ~1.5 min) runs all three on the 6-process demo set and on 50 random processes with `p≤100` (H=2713), 5 seeds, and writes `selection_compare_data.js`, plotted by `demo/selection_generations_chart.html` (gap of best F to the WSPT optimum per generation). Result: on 6 processes shifted/rank reach the optimum on all seeds, proportional ends at +0.66 % on average; on 50 processes after 400 generations the gap is still 145 % (proportional) / 138 % (shifted) / 125 % (rank) — the GA is far from Smith's rule at this chromosome length. `node demo/render_charts.js` renders both selection charts as static light-theme `demo/charts/*.svg` (self-contained, colors inlined) and 2× `*.png` (via headless chromium if in PATH) — use these for slides; rerun it after regenerating the data files. `rank_probabilities` in `ga_model.py` is not wired into `select_parents` — the fitness formula/selection choice is the user's call.
- `demo/convergence_chart.html` — standalone chart (convergence line chart + baseline comparison bars)
  built from that history; published as a Claude Artifact for slide 10. Regenerate its embedded data after
  changing the test set or GA parameters in `run_demo.js` (the history array is inlined in the script, not
  loaded at runtime).

**Current tuned settings** (in `run_demo.js`): population 60, 400 generations, `Pc=0.85`, mutation
probability 0.2, elitism 2, seed 2. The test set's `p`/`o`/`q` were deliberately decorrelated
so FCFS/SJF/Priority/WSPT each give a different order (an earlier draft accidentally had `q_i = 7 - p_i`,
making SJF/Priority/WSPT coincide — not a useful comparison).

**Validated result:** exact optimum via full permutation search over all `6!=720` orders is `F=243`; WSPT
gives 243 too (exact for this model, not a coincidence); the GA (seed 2) finds 243, but only at generation
345 of 400. Other seeds (1..20, same settings): 10 of 20 reach 243, the rest end at 244–248 — the GA gives
no optimum guarantee, say so in the talk. Priority 252, SJF 260, Round Robin 363, FCFS 386. With `oᵢ=0`
brute force, WSPT and GA all give `F=167`; the difference 243−167=76 equals `Σqᵢoᵢ`, confirming that I/O
only shifts `F` by a constant.

## Current state

The repository has: `CLAUDE.md` (problem statement), `research_notes.md` and `ga_theory_notes.md` (source
material), `presentation_script.md` + `speech.md` (script and full speech with real demo results), `demo/`
(working Node.js GA + baselines + chart, see above), and `slides/` (the actual slide deck — see below).
No build/lint/test tooling beyond `node demo/run_demo.js`.

## Slide deck

`slides/deck.html` is the presentation itself: a single self-contained HTML deck implementing 12 of the 13
slides of `presentation_script.md` (no "Итоги" — see Open items), in Russian. Plain HTML/CSS/JS, no
framework; Google Fonts (Unbounded display + IBM Plex Sans/Mono) are the only external dependency.
Navigation: arrows/space/Home/End, click halves, swipe, `F` for fullscreen, `#slide-N` hash; the bottom nav
rail is styled as a chromosome with one quantum per slide (built dynamically from the slide count).
Diagrams (Gantt rows, chromosome strips, GA lifecycle ring, roulette, branch tree, convergence chart) are
built in the page's own JS from `data-*` attributes and from `slides/ga_history.js`. Print to PDF gives one
slide per landscape page. See `slides/README.md` for regenerating `ga_history.js` from
`demo/convergence.json`.

Open items:
- Hardcoded numbers live in several places — `slides/deck.html`, `demo/convergence_chart.html`, and the
  two script/speech files. Changing the test set or GA parameters means updating all of them by hand.
- **Release times `rᵢ` abandoned (this session).** The model had briefly been extended with a per-process
  arrival time `rᵢ` (chromosome = priority list, a non-preemptive `decode()` step, idle time, online baselines);
  that concept was removed entirely and the model returned to the original one: chromosome = schedule,
  `xₜ=i`, no decode. Cascaded through `demo/` (code, test set, `convergence.json`, `convergence_chart.html`),
  `slides/deck.html` (slides "Модель", "Зачем ГА", "Особь", "Операторы", "Демонстрация"), `slides/ga_history.js`,
  `slides/README.md`, `presentation_script.md`, `speech.md`, `research_notes.md`, `ga_theory_notes.md`.
  Consequence: the "why GA" argument had to be reframed (see "Важное следствие модели" in the Problem
  statement). `slides/deck.pptx`, `slides/deck_editable.pptx` and `slides/build_*.py` were **not** touched —
  they predate the `rᵢ` cascade (old numbers, and the old, mathematically wrong claim on slide 7 that I/O
  breaks Smith's rule); regenerating them needs python-pptx (no Python on this machine) and rewriting
  `build_deck_slides.py` slide 7 / results by hand.
- **Pre-existing `slides/deck.html` gap (found and partly fixed earlier).** The deck actually had
  only 11 `<section>`s, not the 13 `slides/README.md` claimed: a "Демонстрация и результаты" slide (results
  chart + comparison bars) was missing from the HTML entirely even though its full JS renderer already
  existed, pointing at non-existent element ids (`#chart`/`#chartWrap`/`#bars`) — silently dead code. That
  slide has been restored with the current numbers. An "Итоги" (conclusions) slide that
  `slides/README.md` also claimed exists was **not** found or fabricated — there is no trace it was ever in
  `deck.html`, and inventing closing-slide content wasn't this task's job. Author should decide whether to
  add one or fix `slides/README.md`'s slide count expectation further (currently corrected to 12).
