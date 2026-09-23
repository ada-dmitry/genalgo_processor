"""Давление отбора при разных схемах выбора родителей в зависимости от масштаба pᵢ.

Метрика: M · Pr(лучшая особь) — во сколько раз лучшая особь популяции выбирается
чаще, чем при равномерном (случайном) выборе. 1× — селекции нет.
Схемы: пропорциональный отбор по fitness = 1/(1+F) (как в постановке); тот же
пропорциональный отбор со сдвигом fitness = F_max − F (F_max — худшее F в
популяции); линейный ранговый отбор (s=2). Простое умножение fitness на константу
(например, нормировка на F_WSPT) вероятности не меняет — константа сокращается.

Пишет demo/selection_pressure_data.js (window.SP_DATA) для selection_pressure_chart.html.
Запуск: nix-shell -p python3 --run "python demo/selection_pressure.py"
"""

from __future__ import annotations

import json
import random
import statistics
from pathlib import Path

from ga_model import (
    fitness,
    generate_population,
    objective,
    population_fitness,  # noqa: F401  (для наглядности связи с моделью)
    random_processes,
    rank_probabilities,
    selection_probabilities,
)

N_PROCESSES = 50
POP_SIZE = 60
SEEDS = range(1, 6)
P_MAX_VALUES = [10, 30, 100, 300, 1000, 3000, 10000]


def pressure(probs: list[float]) -> float:
    return len(probs) * max(probs)


def measure(p_max: int, seed: int) -> dict[str, float]:
    rng = random.Random(seed)
    procs = random_processes(N_PROCESSES, rng, p_range=(1, p_max))
    pop = generate_population(procs, POP_SIZE, rng)
    fits = [fitness(x, procs) for x in pop]
    f_vals = [objective(x, procs) for x in pop]
    f_worst = max(f_vals)
    shifted_fits = [f_worst - f for f in f_vals]
    return {
        "proportional": pressure(selection_probabilities(fits)),
        "shifted": pressure(selection_probabilities(shifted_fits)),
        "rank": pressure(rank_probabilities(fits)),
        "h": sum(pr.p for pr in procs),
    }


def main() -> None:
    rows = []
    for p_max in P_MAX_VALUES:
        runs = [measure(p_max, s) for s in SEEDS]
        row = {"p_max": p_max, "H": round(statistics.mean(r["h"] for r in runs))}
        for key in ("proportional", "shifted", "rank"):
            row[key] = round(statistics.mean(r[key] for r in runs), 4)
        rows.append(row)
        print(row, flush=True)
    meta = {"n": N_PROCESSES, "M": POP_SIZE, "seeds": len(SEEDS)}
    out = Path(__file__).with_name("selection_pressure_data.js")
    out.write_text("window.SP_DATA = " + json.dumps({"meta": meta, "rows": rows}, ensure_ascii=False) + ";\n")
    print("записано", out)


if __name__ == "__main__":
    main()
