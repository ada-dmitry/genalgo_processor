"""Массовая проверка правила Смита (WSPT) на случайных наборах процессов.

Что проверяется (WSPT — точный оптимум 1||ΣqᵢCᵢ, I/O добавляет константу Σqᵢoᵢ):
  1. Перебор всех порядков блоков (n <= 7): min F совпадает с F(WSPT).
  2. Полный перебор всех различных хромосом на крошечных наборах: прерывистые
     расписания (несмежные кванты) не лучше блочного WSPT.
  3. Случайные особи на больших наборах: F(x) >= F(WSPT) (нижняя граница).
  4. Сдвиг из-за I/O: F(x) - F(x при oᵢ=0) = Σ qᵢoᵢ для любой особи.

Запуск: nix-shell -p python3 --run "python demo/check_wspt.py [--seed S] [--instances K]"
"""

from __future__ import annotations

import argparse
import itertools
import random
from dataclasses import replace

from ga_model import (
    Process,
    gene_pool,
    generate_individual,
    is_valid,
    objective,
    random_processes,
    wspt_individual,
)


def block_individual(order: list[Process]) -> list[int]:
    return [pr.id for pr in order for _ in range(pr.p)]


def check_block_orders(rng: random.Random, instances: int) -> None:
    """Перебор n! порядков блоков: минимум равен F(WSPT)."""
    for _ in range(instances):
        procs = random_processes(rng.randint(2, 7), rng)
        f_wspt = objective(wspt_individual(procs), procs)
        f_min = min(
            objective(block_individual(list(order)), procs)
            for order in itertools.permutations(procs)
        )
        assert f_min == f_wspt, (procs, f_min, f_wspt)


def check_all_chromosomes(rng: random.Random, instances: int) -> None:
    """Все различные хромосомы (H <= 8): прерывания оптимума не улучшают."""
    for _ in range(instances):
        procs = random_processes(rng.randint(2, 3), rng, p_range=(1, 3))
        if sum(pr.p for pr in procs) > 8:
            continue
        f_wspt = objective(wspt_individual(procs), procs)
        f_min = min(
            objective(list(x), procs)
            for x in set(itertools.permutations(gene_pool(procs)))
        )
        assert f_min == f_wspt, (procs, f_min, f_wspt)


def check_random_individuals(rng: random.Random, instances: int) -> None:
    """Большие наборы: случайные особи допустимы и не лучше WSPT."""
    for _ in range(instances):
        procs = random_processes(rng.randint(8, 30), rng, p_range=(1, 20))
        pool = gene_pool(procs)
        f_wspt = objective(wspt_individual(procs), procs)
        for _ in range(200):
            x = generate_individual(pool, rng)
            assert is_valid(x, procs)
            assert objective(x, procs) >= f_wspt, (procs, x)


def check_io_shift(rng: random.Random, instances: int) -> None:
    """F с I/O = F без I/O + Σqᵢoᵢ для любой особи."""
    for _ in range(instances):
        procs = random_processes(rng.randint(2, 15), rng)
        no_io = [replace(pr, o=0) for pr in procs]
        shift = sum(pr.q * pr.o for pr in procs)
        x = generate_individual(gene_pool(procs), rng)
        assert objective(x, procs) == objective(x, no_io) + shift


def main() -> None:
    ap = argparse.ArgumentParser(description="Проверки по WSPT на случайных процессах")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument(
        "--instances", type=int, default=100, help="наборов на каждую проверку"
    )
    args = ap.parse_args()
    rng = random.Random(args.seed)
    k = args.instances
    for name, fn in [
        ("перебор порядков блоков == WSPT", check_block_orders),
        ("перебор всех хромосом == WSPT", check_all_chromosomes),
        ("случайные особи >= WSPT", check_random_individuals),
        ("сдвиг F из-за I/O == Σqᵢoᵢ", check_io_shift),
    ]:
        fn(rng, k)
        print(f"OK  {name} ({k} наборов, seed={args.seed})")


if __name__ == "__main__":
    main()
