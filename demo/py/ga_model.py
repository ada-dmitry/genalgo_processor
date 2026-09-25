"""Модель и первая половина ГА для планирования процессов на одном процессоре.

Постановка — см. CLAUDE.md. Здесь реализовано всё до выбора родителей включительно:
математическая модель, представление особи, генерация особи и популяции, проверка
допустимости, приспособленность особи и популяции, критерий остановки и
пропорциональный (рулеточный) выбор родителей. Кроссовер, мутация и отбор особей
в следующее поколение — отдельный следующий шаг.

Демонстрационный код, не production-планировщик. Только стандартная библиотека.
"""

from __future__ import annotations

import argparse
import random
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction

# --- Модель процессов ---------------------------------------------------------


@dataclass(frozen=True)
class Process:
    """Процесс Pᵢ: id — номер 1..n, p>0 — кванты CPU, o>=0 — I/O, q>0 — приоритет (вес)."""

    id: int
    p: int
    o: int
    q: int


def horizon(processes: Sequence[Process]) -> int:
    """H = Σ pᵢ — длина хромосомы (суммарная потребность в квантах CPU)."""
    return sum(pr.p for pr in processes)


# --- Представление особи ------------------------------------------------------
# Особь x = (x₁, …, x_H), xₜ ∈ {1..n}: в квант t выполняется процесс xₜ; номер i
# встречается ровно pᵢ раз. Хромосома и есть расписание. Представляем списком int.

Individual = list[int]


def gene_pool(processes: Sequence[Process]) -> list[int]:
    """
    Мультимножество генов: pᵢ копий каждого i.
    """
    return [pr.id for pr in processes for _ in range(pr.p)]  # [1,1,1,1,2,2,2,3,3,3]


def generate_individual(pool: Sequence[int], rng: random.Random) -> Individual:
    """
    Случайное перемешивание мультимножества генов. Допустима по построению.
    """
    return rng.sample(pool, len(pool))


def generate_population(
    processes: Sequence[Process],
    size: int,
    rng: random.Random,
    max_attempts: int = 100,
) -> list[Individual]:
    """Популяция из `size` особей. Повторы по возможности не добавляются:
    если `max_attempts` подряд попыток дали дубликат, дубликат принимается
    (случай, когда различных особей меньше, чем `size`)."""
    pool = gene_pool(processes)
    population: list[Individual] = []
    seen: set[tuple[int, ...]] = set()
    while len(population) < size:
        x = generate_individual(pool, rng)
        attempts = 1
        while tuple(x) in seen and attempts < max_attempts:
            x = generate_individual(pool, rng)
            attempts += 1
        seen.add(tuple(x))
        population.append(x)
    return population


# --- Проверка допустимости ----------------------------------------------------


def is_valid(x: Sequence[int], processes: Sequence[Process]) -> bool:
    """valid(x) ⇔ |x| = H ∧ ∀i: Σₜ[xₜ = i] = pᵢ (это же гарантирует xₜ ∈ {1..n})."""
    if len(x) != horizon(processes):
        return False
    need = {pr.id: pr.p for pr in processes}
    have = Counter(x)
    return set(have) <= set(need) and all(have[i] == p for i, p in need.items())


# --- Целевая функция и приспособленность особи --------------------------------


def completion_times(
    x: Sequence[int], processes: Sequence[Process]
) -> dict[int, tuple[int, int]]:
    """{id: (Eᵢ, Cᵢ)}: Eᵢ — номер (с 1) последнего кванта Pᵢ, Cᵢ = Eᵢ + oᵢ."""
    last: dict[int, int] = {}
    for t, i in enumerate(x, start=1):
        last[i] = t
    return {pr.id: (last[pr.id], last[pr.id] + pr.o) for pr in processes}


def objective(x: Sequence[int], processes: Sequence[Process]) -> int:
    """F(x) = Σᵢ qᵢ·Cᵢ → min."""
    times = completion_times(x, processes)
    return sum(pr.q * times[pr.id][1] for pr in processes)


def fitness(x: Sequence[int], processes: Sequence[Process]) -> float:
    """fitness(x) = 1 / (1 + F(x)) для допустимых x, 0 для недопустимых."""
    if not is_valid(x, processes):
        return 0.0
    return 1.0 / (1.0 + objective(x, processes))


# --- Приспособленность популяции ----------------------------------------------


def population_fitness(fits: Sequence[float]) -> tuple[float, float]:
    """(fitness_avg, fitness_best) по списку приспособленностей особей."""
    return sum(fits) / len(fits), max(fits)


def selection_probabilities(fits: Sequence[float]) -> list[float]:
    """Pr(xʲ) = fitness(xʲ) / Σₖ fitness(xᵏ); при нулевой сумме — равномерно."""
    total = sum(fits)
    if total <= 0:
        return [1.0 / len(fits)] * len(fits)
    return [f / total for f in fits]


# --- Критерий остановки -------------------------------------------------------


class StoppingCriterion:
    """Остановка, если g ≥ G_max либо fitness_best не улучшается K поколений подряд."""

    def __init__(self, g_max: int, k_stall: int) -> None:
        self.g_max = g_max
        self.k_stall = k_stall
        self._best = float("-inf")
        self._stall = 0

    def should_stop(self, g: int, fitness_best: float) -> bool:
        """Вызывать раз в поколение; g — номер текущего поколения (с 0)."""
        if fitness_best > self._best:
            self._best = fitness_best
            self._stall = 0
        else:
            self._stall += 1
        return g >= self.g_max or self._stall >= self.k_stall


# --- Алгоритм выбора родителей: пропорциональный (рулеточный) отбор -----------


def roulette_pick(
    fits: Sequence[float], rng: random.Random
) -> tuple[int, float, float]:
    """Один запуск рулетки: (индекс выбранной особи, r, Σ fitness).
    r ~ U(0, Σ fitness), затем вычитаем fitness особей по порядку, пока r не станет ≤ 0.
    При нулевой сумме — равновероятный выбор (r = 0)."""
    total = sum(fits)
    if total <= 0:
        return rng.randrange(len(fits)), 0.0, total
    r = rng.random() * total
    left = r
    for j, f in enumerate(fits):
        left -= f
        if left <= 0:
            return j, r, total
    return len(fits) - 1, r, total  # страховка от ошибки округления


def roulette_select(
    population: Sequence[Individual], fits: Sequence[float], rng: random.Random
) -> Individual:
    """Один родитель по рулетке (см. roulette_pick)."""
    return population[roulette_pick(fits, rng)[0]]


def rank_probabilities(fits: Sequence[float], s: float = 2.0) -> list[float]:
    """Линейный ранговый отбор: вероятность зависит только от места особи по
    приспособленности, а не от масштаба F. Лучшая особь имеет вероятность s/M,
    худшая (2−s)/M, 1 < s <= 2 (s=2 — наибольшее давление). Не подключён к
    select_parents — вариант для сравнения с пропорциональным отбором."""
    m = len(fits)
    if m == 1:
        return [1.0]
    order = sorted(range(m), key=lambda j: fits[j], reverse=True)  # order[0] — лучшая
    probs = [0.0] * m
    for rank, j in enumerate(order):
        probs[j] = (s - (2 * s - 2) * rank / (m - 1)) / m
    return probs


Spin = tuple[int, float, float]  # (индекс, r, Σ fitness) одного запуска рулетки


def pick_parent_pair(
    population: Sequence[Individual],
    fits: Sequence[float],
    rng: random.Random,
    max_attempts: int = 100,
) -> tuple[int, int, list[Spin]]:
    """Индексы двух родителей и список всех запусков рулетки.
    Родитель 1 — один запуск. Родитель 2 крутится заново, пока его хромосома не
    отличается от хромосомы родителя 1 (пара из одинаковых особей ничего не даёт
    кроссоверу). Если за `max_attempts` запусков различной особи не нашлось
    (например, популяция из одинаковых особей), принимается последний результат."""
    spins = [roulette_pick(fits, rng)]
    first = spins[0][0]
    for _ in range(max_attempts):
        spin = roulette_pick(fits, rng)
        spins.append(spin)
        if population[spin[0]] != population[first]:
            break
    return first, spins[-1][0], spins


def select_parents(
    population: Sequence[Individual], fits: Sequence[float], rng: random.Random
) -> tuple[Individual, Individual]:
    """Пара родителей: рулетка с возвращением между парами, но внутри пары
    родители различны (см. pick_parent_pair)."""
    i, j, _ = pick_parent_pair(population, fits, rng)
    return population[i], population[j]


# --- Случайные процессы и эталон WSPT -----------------------------------------


def random_processes(
    n: int,
    rng: random.Random,
    p_range: tuple[int, int] = (1, 10),
    o_range: tuple[int, int] = (0, 10),
    q_range: tuple[int, int] = (1, 10),
) -> list[Process]:
    """n процессов с id 1..n и равномерно случайными pᵢ, oᵢ, qᵢ из заданных диапазонов
    (границы включены; диапазоны по умолчанию дают pᵢ>0, qᵢ>0)."""
    return [
        Process(i, rng.randint(*p_range), rng.randint(*o_range), rng.randint(*q_range))
        for i in range(1, n + 1)
    ]


def wspt_individual(processes: Sequence[Process]) -> Individual:
    """Правило Смита (WSPT): блоки процессов по неубыванию pᵢ/qᵢ. Точный оптимум
    1||ΣqᵢCᵢ (I/O добавляет константу Σqᵢoᵢ и порядок не меняет), поэтому F этой
    особи — нижняя граница F для любой допустимой особи. Дробь точная (Fraction),
    ничьи разрешаются по id."""
    order = sorted(processes, key=lambda pr: (Fraction(pr.p, pr.q), pr.id))
    return [pr.id for pr in order for _ in range(pr.p)]


# --- Демонстрация и самопроверка ----------------------------------------------

PROCESSES = [
    Process(1, p=5, o=3, q=5),
    Process(2, p=2, o=5, q=1),
    Process(3, p=9, o=1, q=2),
    Process(4, p=1, o=4, q=6),
    Process(5, p=5, o=2, q=3),
    Process(6, p=3, o=6, q=4),
]


def self_check(n_random: int | None = None, seed: int = 2, p_max: int = 10) -> None:
    """Самопроверки модели (assert). Запуск: python ga_model.py --check."""
    rng = random.Random(seed)
    processes = (
        random_processes(n_random, rng, p_range=(1, p_max)) if n_random else PROCESSES
    )
    kind = "случайные" if n_random else "фиксированные"
    print(f"n={len(processes)} ({kind}, seed={seed}), H={horizon(processes)}")

    # пример из CLAUDE.md: p = (2, 2, 1), x = (1, 1, 2, 3, 2)
    small = [Process(1, 2, 0, 1), Process(2, 2, 0, 1), Process(3, 1, 0, 1)]
    assert is_valid([1, 1, 2, 3, 2], small)
    assert not is_valid([1, 1, 2, 2, 2], small)  # процесс 3 отсутствует
    assert not is_valid([1, 1, 2, 3], small)  # неверная длина
    assert not is_valid([1, 1, 2, 3, 4], small)  # неизвестный номер
    assert fitness([1, 1, 2, 2, 2], small) == 0.0

    # эталон: WSPT — точный оптимум, ни одна особь не может быть лучше него
    smith = wspt_individual(processes)
    assert is_valid(smith, processes)
    f_smith = objective(smith, processes)
    print("F(WSPT) =", f_smith)

    population = generate_population(processes, size=60, rng=rng)
    assert all(is_valid(x, processes) for x in population)
    assert len({tuple(x) for x in population}) == 60  # дубликатов нет
    fits = [fitness(x, processes) for x in population]
    avg, best = population_fitness(fits)
    best_f = round(1 / best - 1)
    print(
        f"популяция: M={len(population)}, fitness_avg={avg:.3e}, fitness_best={best:.3e}, "
        f"лучший F={best_f} (зазор до WSPT: {best_f - f_smith})"
    )
    assert best_f >= f_smith

    # эмпирическая проверка рулетки: частоты выбора ≈ Pr(xʲ)
    probs = selection_probabilities(fits)
    assert abs(sum(probs) - 1.0) < 1e-9
    trials = 200_000
    counts = Counter()
    for _ in range(trials):
        counts[id(roulette_select(population, fits, rng))] += 1
    top = max(range(len(population)), key=lambda j: probs[j])
    freq = counts[id(population[top])] / trials
    print(
        f"лучшая особь: Pr={probs[top]:.4f}, частота выбора={freq:.4f}; Pr_max/Pr_min={max(probs) / min(probs):.3f} (равномерно = 1)"
    )
    assert abs(freq - probs[top]) < 0.005

    p1, p2 = select_parents(population, fits, rng)
    assert p1 != p2
    # пара из разных особей, даже когда одна особь держит половину всей рулетки
    skewed = [1.0 / (len(population) - 1)] * (len(population) - 1) + [1.0]
    for _ in range(2000):
        a, b = select_parents(population, skewed, rng)
        assert a != b
    # вырожденная популяция (все особи одинаковы) — не зависаем, принимаем пару как есть
    same = [population[0][:] for _ in range(4)]
    i, j, spins = pick_parent_pair(same, [1.0] * 4, rng, max_attempts=10)
    assert len(spins) == 11 and same[i] == same[j]
    if len(p1) <= 60:  # длинные хромосомы в консоль не выводим
        print("родитель 1:", *p1)
        print("родитель 2:", *p2)

    stopper = StoppingCriterion(g_max=400, k_stall=3)
    flags = [stopper.should_stop(g, f) for g, f in enumerate([0.1, 0.2, 0.2, 0.2, 0.2])]
    assert flags == [False, False, False, False, True]  # застой K=3 на 5-м вызове
    assert StoppingCriterion(2, 100).should_stop(2, 1.0)
    print("самопроверки пройдены")


# --- Пошаговый вывод: от первой особи до выбора родителей ---------------------


def _chrom(x: Sequence[int], limit: int = 46) -> str:
    """Хромосома в строку; длинные сокращаем, чтобы не забивать консоль."""
    if len(x) <= limit:
        return " ".join(map(str, x))
    return " ".join(map(str, x[:limit])) + f" … (всего {len(x)} генов)"


def _step(n: int, title: str) -> None:
    print(f"\n== {n}. {title} ==")


def _table(headers: list[str], rows: list[list[object]]) -> None:
    widths = [max(len(str(c)) for c in col) for col in zip(headers, *rows)]
    for cells in [headers, *rows]:
        print("  ".join(str(c).rjust(w) for c, w in zip(cells, widths)))


def trace(
    n_random: int | None = None, seed: int = 2, p_max: int = 10, size: int = 8
) -> None:
    """Кратко по шагам: первая особь → популяция → приспособленность → критерий
    остановки → выбор родителей. Дальше (кроссовер и т.д.) — вне этого файла."""
    rng = random.Random(seed)
    processes = (
        random_processes(n_random, rng, p_range=(1, p_max)) if n_random else PROCESSES
    )
    print(f"n = {len(processes)} процессов, H = {horizon(processes)} квантов")

    _step(1, "Первая особь")
    x1 = generate_individual(gene_pool(processes), rng)
    print(_chrom(x1))
    print(
        f"допустима: {is_valid(x1, processes)},  F = {objective(x1, processes)},  "
        f"fitness = {fitness(x1, processes):.6f}"
    )

    _step(2, f"Популяция (M = {size})")
    population = generate_population(processes, size, rng)
    for j, x in enumerate(population, start=1):
        print(f"x{j}: {_chrom(x)}")

    _step(3, "Приспособленность")
    fits = [fitness(x, processes) for x in population]
    probs = selection_probabilities(fits)
    avg, best = population_fitness(fits)
    _table(
        ["j", "F", "fitness", "Pr, %"],
        [
            [j + 1, objective(x, processes), f"{fits[j]:.6f}", f"{probs[j] * 100:.1f}"]
            for j, x in enumerate(population)
        ],
    )
    print(f"fitness_avg = {avg:.6f},  fitness_best = {best:.6f}")

    _step(4, "Критерий остановки (проверка в поколении g = 0)")
    g_max, k_stall = 400, 50
    stop = StoppingCriterion(g_max, k_stall).should_stop(0, best)
    print(
        f"Останов, если g ≥ G_max = {g_max} или fitness_best не растёт K = {k_stall} поколений подряд."
    )
    print(
        f"g = 0 < {g_max}, fitness_best = {best:.6f} — первое значение, счётчик застоя = 0"
    )
    print(f"should_stop = {stop}  → продолжаем")

    _step(5, "Выбор родителей: пропорциональная рулетка")
    print("Секторы рулетки: накопленная сумма fitness, доля от Σ fitness")
    cum, acc = [], 0.0
    for f in fits:
        acc += f
        cum.append(acc)
    _table(
        ["j", "fitness", "интервал r", "накопл., %"],
        [
            [
                j,
                f"{fits[j - 1]:.6f}",
                f"({cum[j - 1] - fits[j - 1]:.6f}; {cum[j - 1]:.6f}]",
                f"{cum[j - 1] / cum[-1] * 100:.2f}",
            ]
            for j in range(1, size + 1)
        ],
    )
    first, second, spins = pick_parent_pair(population, fits, rng)
    for n, (j, r, total) in enumerate(spins):
        who = (
            "Родитель 1"
            if n == 0
            else ("Родитель 2" if n == 1 else f"Родитель 2 (попытка {n})")
        )
        line = f"{who}: r = U(0, {total:.6f}) = {r:.6f}  → попало в интервал особи x{j + 1}"
        if n >= 1 and population[j] == population[first]:
            line += "  — совпал с родителем 1, крутим заново"
        print(line)
    print(f"  родитель 1 = x{first + 1}: {_chrom(population[first])}")
    print(f"  родитель 2 = x{second + 1}: {_chrom(population[second])}")
    if population[first] == population[second]:
        print("  (различного родителя найти не удалось — принята одинаковая пара)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(
        description="Первая половина ГА: пошаговый вывод до выбора родителей"
    )
    ap.add_argument(
        "--random",
        type=int,
        metavar="N",
        help="N случайных процессов вместо фиксированного набора",
    )
    ap.add_argument("--seed", type=int, default=2)
    ap.add_argument(
        "--p-max",
        type=int,
        default=10,
        help="верхняя граница pᵢ для случайных процессов",
    )
    ap.add_argument(
        "--size", type=int, default=8, help="размер популяции M в пошаговом выводе"
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="вместо пошагового вывода запустить самопроверки",
    )
    args = ap.parse_args()
    if args.check:
        self_check(args.random, args.seed, args.p_max)
    else:
        trace(args.random, args.seed, args.p_max, args.size)
