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

**Критерий остановки:** `g ≥ G_max`, либо `fitness_best` не улучшается `K` поколений подряд. В `main.ipynb` (`run_ga`) реализованы оба; `K` по умолчанию выключен (`stall_generations=None`).

**Важное следствие модели (не подавать иначе):** `F(x) = ΣqᵢEᵢ + Σqᵢ·ioᵢ`, второе слагаемое от расписания не зависит, поэтому I/O порядок не меняет, а задача — это классическая `1||ΣwⱼCⱼ`, решаемая **точно** правилом Смита / WSPT (оптимально и среди вытесняющих расписаний). ГА для *этой* модели не нужен; его роль — универсальный метод, не опирающийся на структуру `F` (переносится на усложнённые постановки), плюс валидация по точному эталону. См. `docs/research_notes.md` §0.

## Repository layout

```
main.ipynb            the whole GA in Python, step by step, with plots and self-checks
requirements.txt      notebook deps (matplotlib, notebook)
docs/                 research_notes.md, ga_theory_notes.md — source material
talk/                 presentation_script.md, speech.md — slide outline and full speech
demo/charts/          standalone charts for slides: *_chart.html (data inlined) + *.svg / *.png
```

Requirements: Python 3 with `requirements.txt`; tested on Python 3.14. The project is shared with
teammates who don't use Nix — don't mention Nix in user-facing docs (README, notebook); `flake.nix` is
only the author's local convenience (its devShell has python with the notebook deps; treefmt runs ruff on
the `.ipynb` too). The test is executing the notebook end to end:
`jupyter nbconvert --to notebook --execute --inplace main.ipynb` (~20 s; its last cell asserts everything).
The JS demo (`demo/js/`, `demo/data/`) and the older `demo/py/` scripts were removed — the notebook is
the only implementation.

The presentation itself (the team's pptx and an HTML deck) is maintained by a separate person and is **not
in the repository**: a local `presentation/` directory may exist but is git-ignored (as is `*.pptx`), and
it was purged from history. Don't add deck files back without the user asking.

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

- `talk/speech.md` — full continuous speech (read nearly verbatim) for the team's 30-slide pptx. Includes a
  worked example: 3 processes (`P1: p=8,q=2`; `P2: p=2,q=3`; `P3: p=5,q=1`; `io=0`) with `F(x)` for FCFS
  (61), Round Robin q=2 (55), SJF (43), Priority (41, coincidentally optimal), WSPT/Smith (41, provably
  optimal — brute-forced over all 6 orders).
- `talk/presentation_script.md` — per-slide visual plan of the original 13-slide outline (audience: not
  CS specialists; overview depth, no proofs). Keep it and `speech.md` in sync.

## Notebook (`main.ipynb`)

Illustrative, not production code; backs the results slide with real numbers. Russian markdown for
non-CS readers. Sections: problem → individual → objective/fitness → population → parent selection
(**proportional roulette only**, parents must differ — the user chose to drop the shifted/rank comparison)
→ GOX (Bierwirth 1995; copies a segment of parent A in place, fills the rest from B in order; preserves the
`pᵢ`-count invariant) → swap/insertion/reversal mutation → next generation (elitism 2) +
`StoppingCriterion` → `run_ga` → FCFS/SJF/Priority/Round Robin (quantum 1)/WSPT + brute force over all
`n!` block orders, convergence plot, Gantt charts, 20 seeds → self-checks (model, roulette frequencies,
operator validity, elitism, Smith's rule vs brute force incl. all chromosomes for tiny H, I/O shift).
Committed **with outputs** (GitHub renders them; Colab badge in the first cell) — re-execute before
committing after any change. Plots are matplotlib; tables are markdown via `show_table`.

**Settings:** population 60, 400 generations, `Pc=0.85`, mutation probability 0.2, elitism 2, seed 2.
Test set: `p=(5,2,8,1,4,3)`, `io=(3,5,1,4,2,6)`, `q=(5,1,2,6,3,4)`, H=23 — deliberately decorrelated
so FCFS/SJF/Priority/WSPT give different orders.

**Result:** brute force over `6!=720` orders gives `F=243`; WSPT gives 243 (exact, not a coincidence).
Priority 252, SJF 260, Round Robin 363, FCFS 386. The GA (seed 2) ends at **248** (+2.1 %), found at
generation 332; over seeds 1..20 it reaches 243 in 6 of 20 runs, mean 247.0, worst 258 — the GA gives no
optimum guarantee, say so in the talk. Cause: with `fitness = 1/(1+F)` all individuals get nearly equal
roulette sectors (11–14 % in a population of 8), so selection pressure is weak. With `ioᵢ=0` the optimum
is 167; 243−167=76 = `Σqᵢ·ioᵢ`.

## Open items

- `talk/*.md` and `demo/charts/*` still carry numbers from the removed JS demo (e.g. «GA finds 243 at
  generation 345», «10 of 20 seeds», the shifted/rank selection comparison and the 50-process experiment).
  They are **not** reproducible from `main.ipynb` and must be adapted to it later — the user asked not to
  touch `talk/` yet. The out-of-repo presentation has the same numbers.
- Release times `rᵢ` were tried and abandoned: the model briefly had per-process arrival times (priority-list
  chromosome, non-preemptive `decode()`, idle time, online baselines); everything was reverted to
  chromosome = schedule across the demo, talk and docs. This is why the "why GA" argument is
  framed as universality (see "Важное следствие модели").
