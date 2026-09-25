# Материалы по теме: генетический алгоритм для планирования процессов на одном процессоре

Собрано 2026-09-12 по запросу пользователя, привязано к постановке задачи из `CLAUDE.md`
(`n` процессов, `pᵢ`/`ioᵢ`/`qᵢ`, особь — вектор длины `H=Σpᵢ` типа "перестановка с повторениями",
`F(x)=ΣᵢqᵢCᵢ→min`, `fitness=1/(1+F(x))`, пропорциональный отбор).

## 0. Главный тезис для презентации: зачем вообще нужен ГА

Целевая функция `F(x)=ΣqᵢCᵢ→min` — это **классическая задача теории расписаний
`1||ΣwⱼCⱼ`** (минимизация взвешенной суммы моментов завершения на одном станке). I/O её не усложняет:
`Cᵢ = Eᵢ + ioᵢ`, значит `F(x) = ΣqᵢEᵢ + Σqᵢ·ioᵢ`, а второе слагаемое — константа, от расписания не зависящая
(I/O разных процессов идёт параллельно и не конкурирует за CPU). Поэтому задача решается **точно за
O(n log n)** сортировкой процессов по неубыванию `pᵢ/qᵢ` (эквивалентно — по невозрастанию `qᵢ/pᵢ`) — это
**правило Смита (Smith's rule, 1956)**, также известное как **WSPT (Weighted Shortest Processing Time)**.
Доказывается стандартным аргументом обмена соседних элементов (exchange argument); правило оптимально и
среди вытесняющих расписаний, поэтому хромосома, допускающая несмежные кванты, преимуществ не даёт.

**Почему это важно для проекта (честная формулировка):** для *этой* модели ГА не нужен — точное решение
известно и вычисляется быстрее сортировки. Роль ГА в проекте другая: (1) это метод, не опирающийся на
структуру целевой функции — ему достаточно уметь вычислять `F(x)`, поэтому кодировка и операторы
переносятся на постановки, где точного правила нет; (2) правило Смита и полный перебор (`n!`) дают точный
эталон, по которому можно проверить корректность реализации ГА. Не стоит подавать ГА как «решение, без
которого не обойтись» именно для этой задачи.

**Рекомендация для презентации:** показать, что найденное ГА расписание совпадает с WSPT и с перебором
(готовый sanity-check для демо), что `ioᵢ` сдвигает `F` на константу `Σqᵢ·ioᵢ` и порядок не меняет, и явно
сказать, что ценность ГА здесь — универсальность метода, а не выигрыш над точным правилом.

Источники: общее подтверждение правила Смита в нескольких источниках по теории расписаний:
- https://statmath.wu.ac.at/~boehm/book/chapter2.pdf
- https://marcuetz.personalweb.utwente.nl/Preprints/WSEPT-Final.pdf (анализ WSEPT/правила Смита
  в стохастическом планировании, подтверждает название и классический статус правила)

## 1. ГА применительно к планированию процессов/CPU

- **"Genetic Algorithm approach to Operating system process scheduling problem"** (ResearchGate)
  https://www.researchgate.net/publication/50346313_Genetic_Algorithm_approach_to_Operating_system_process_scheduling_problem
  Напрямую по теме: строит ГА-планировщик ОС. Хорошо для вводного/мотивационного слайда — та же
  оптика, что и в этом проекте (планирование как задача оптимизации, решаемая метаэвристикой).

- **"Efficient CPU Scheduling: A Genetic Algorithm based Approach"** (IEEE Xplore)
  https://ieeexplore.ieee.org/abstract/document/4290681/
  (тж. на ResearchGate: https://www.researchgate.net/publication/4269215_Efficient_CPU_Scheduling_A_Genetic_Algorithm_based_Approach)
  Сравнивает ГА-планировщик с детерминированными алгоритмами через симуляцию — шаблон для раздела
  "ГА против классики" в этом проекте.

- **"A New Method for CPU Time Scheduling Using Genetic Algorithm"** (ResearchGate)
  https://www.researchgate.net/publication/277305229_A_New_Method_for_CPU_Time_Scheduling_Using_Genetic_Algorithm
  Ещё одна формулировка ГА для CPU-планирования; полезно сравнить их кодирование хромосомы и fitness
  со своими решениями.

- **"Genetic Algorithm Based Adaptive Scheduling"** (AIRCC IJESA, PDF)
  https://airccse.org/journal/ijesa/papers/2312ijesa10.pdf
  Комбинация Earliest Deadline First (real-time планирование) с ГА — пример гибрида классика+ГА,
  полезно если упоминать real-time расширения.

- **"A Performance Study of GA and LSH in Multiprocessor Job Scheduling"** (arXiv, свободный PDF)
  https://arxiv.org/pdf/1002.1149
  Многопроцессорное планирование, ГА против list scheduling heuristic — полезная методология
  сравнения, хотя у нас один процессор.

- **"Multiprocessor Scheduling Using Parallel Genetic Algorithm"** (arXiv)
  https://arxiv.org/pdf/1209.5319
  Параллелизация ГА для планирования; низкий приоритет для текущего проекта, но пригодится, если
  расширять демо на несколько процессоров как future work.

## 2. Операторы кроссовера/мутации для "перестановки с повторениями"

Самая важная категория: хромосома проекта (id процесса повторяется `pᵢ` раз среди `H` слотов) —
**не обычная перестановка**, поэтому классические PMX/OX/cycle crossover нужно адаптировать (это уже
отмечено как открытый вопрос в `CLAUDE.md`).

- **Bierwirth, C. — "A generalized permutation approach to job shop scheduling with genetic
  algorithms"**, OR Spectrum, 1995.
  https://link.springer.com/article/10.1007/BF01719250
  (тж. https://www.researchgate.net/publication/240263036_A_generalized_permutation_approach_to_job_shop_scheduling_Mth_genetic_algorithms)
  **Ключевое совпадение.** Вводит представление "перестановка с повторением" для job-shop
  scheduling — ровно то же семейство кодирования, что и в этом проекте (id работы/процесса
  повторяется столько раз, сколько у неё операций/квантов). Определяет **оператор GOX**
  (Generalized Order Crossover) — обобщение Order Crossover (OX), сконструированное так, что оно
  **не может произвести недопустимое потомство** (сохраняет инвариант "id встречается ровно нужное
  число раз"). Это прямая теоретическая основа для цитирования, каким бы ни был выбранный оператор.

- **"On Permutation Representations for Scheduling Problems"** — Bierwirth, Mattfeld, Kopfer
  (Springer, PPSN). https://link.springer.com/chapter/10.1007/3-540-61723-X_995
  (PDF: https://www.researchgate.net/publication/2753293_On_Permutation_Representations_for_Scheduling_Problems)
  Обзор/сравнение разных перестановочных представлений хромосом для ГА в планировании, включая
  представление с повторением выше — хорошо для слайда "почему выбрано именно такое кодирование".

- **"A New Genetic Representation and Common Cluster Crossover for Job Shop Scheduling Problems"**
  (Springer, PPSN). https://link.springer.com/chapter/10.1007/3-540-45561-2_29
  Предлагает Common Cluster Crossover (CCX) — ещё один оператор, сохраняющий допустимые
  подпоследовательности при кодировании с повторением; второй вариант для сравнения наряду с GOX.

- **Yamada, T. & Nakano, R. — "Genetic Algorithms and Job Shop Scheduling"**, глава 7 книги
  (свободный PDF). https://www.kecl.ntt.co.jp/as/members/yamada/galbk.pdf
  Полная глава про кодирование хромосом JSSP и выбор кроссовера/мутации — хороший фон для чтения,
  свободно доступна (в отличие от большинства ссылок ResearchGate/Springer выше).

**Практический вывод:** наивный одно-/двухточечный кроссовер над вектором id процессов ломает
инвариант "`i` встречается ровно `pᵢ` раз" (уже отмечено в `CLAUDE.md`). Два стандартных решения
из источников выше: (a) GOX/OX-подобный оператор "скопировать сегмент, затем достроить остальное по
порядку", либо (b) кроссовер над случайной перестановкой с последующим "ремонтом" потомка. При
выборе оператора для демо-программы — сослаться на Bierwirth (1995).

## 3. Классические алгоритмы планирования CPU (для сравнения)

- Обзоры сравнения FCFS/SJF/Round Robin/Priority:
  - "Comparison Analysis of CPU Scheduling: FCFS, SJF and Round Robin" (Academia.edu)
    https://www.academia.edu/59725844/Comparison_Analysis_of_CPU_Scheduling_FCFS_SJF_and_Round_Robin
  - "Comparison of CPU Scheduling Algorithms: FCFS, SJF, SRTF, Round Robin, Priority Based, and
    Multilevel Queuing" (ResearchGate)
    https://www.researchgate.net/publication/365100564_Comparison_of_CPU_Scheduling_Algorithms_FCFS_SJF_SRTF_Round_Robin_Priority_Based_and_Multilevel_Queuing

  Стандартные компромиссы: FCFS — эффект конвоя; SJF — оптимально среднее время ожидания, но
  голодание длинных задач; RR — справедливость, но чувствительность к размеру кванта; Priority —
  риск голодания низкоприоритетных. Это готовые базовые политики для сценариев "ГА против классики".

- **Silberschatz, Galvin, Gagne — "Operating System Concepts", гл. 5/6 "CPU Scheduling"**
  (свободные слайды-конспекты по учебнику, напр.:
  https://www.os-book.com/OS8/os8e/slide-dir/PDF-dir/ch5.pdf и
  https://www.cs.fsu.edu/~lacher/courses/COP4610/lectures_9e/ch06.pdf)
  Канонический учебник для определений FCFS/SJF/RR/Priority и модели CPU-burst/I/O-burst (см. §4).
  В отчёте цитировать сам учебник, эти PDF — просто удобный доступ к содержимому для сбора материала.

## 4. Модель цикла CPU-burst / I/O-burst

- Silberschatz, Galvin, Gagne — там же, гл. 5/6. Каноническая модель: процесс циклически чередует
  CPU burst и I/O burst; многозадачность и планирование существуют именно для того, чтобы процессор
  не простаивал, пока один процесс ждёт I/O. Это прямо соответствует упрощённой модели проекта
  (один CPU burst длиной `pᵢ`, затем один I/O burst длиной `ioᵢ`, I/O разных процессов может
  перекрываться) — цитировать как обоснование того, что упрощение реалистично (в реальных ОС бывает
  много чередований CPU/I/O на процесс; здесь — ровно одно каждого для управляемости модели).

## 4a. Как планируют реальные ОС (для слайда-контраста)

Проверено 2026-09-13. Цель — один слайд-контраст: реальные планировщики устроены гораздо сложнее и
преследуют разные цели (справедливость, отзывчивость, энергоэффективность), тогда как проект намеренно
изучает упрощённую, анализируемую модель с единственным критерием — именно поэтому для неё можно
рассуждать о метаэвристике и сверяться с точным базовым решением (правило Смита, см. §0). Ни один из
реальных планировщиков не сводится к одной замкнутой формуле — в отличие от модели проекта.

**Linux:**
- O(1)-планировщик (до ядра 2.6.23) → **CFS** (Completely Fair Scheduler, с 2.6.23, 2007 г.) →
  **EEVDF** (Earliest Eligible Virtual Deadline First), сменивший CFS по умолчанию в ядре **6.6** (2023).
  https://www.linux-magazine.com/Issues/2025/301/EEVDF ,
  https://en.wikipedia.org/wiki/Completely_Fair_Scheduler
- CFS отслеживает virtual runtime/"lag"; EEVDF вместо этого считает virtual deadline для каждой
  готовой задачи и всегда запускает задачу с ближайшим дедлайном — лучше гарантии задержки для
  интерактивных задач, меньше эвристической подстройки.
  https://docs.kernel.org/scheduler/sched-eevdf.html

**Windows:**
- Вытесняющий, приоритетный: 32 уровня приоритета (0–31); 0–15 — "динамические" (обычные приложения),
  16–31 — real-time. https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities
- Динамический буст приоритета работает только в диапазоне 0–15 (например, после завершения ожидания
  I/O), затухая на один уровень за каждый использованный квант до возврата к базовому; потоки 16–31
  никогда не бустятся. https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts
- MMCSS (Multimedia Class Scheduler Service) позволяет непривилегированным мультимедиа-приложениям
  получать повышенный приоритет (16+) без прав real-time.
  https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/ProcThread/multimedia-class-scheduler-service.md

**macOS/Darwin (XNU):**
- Разработчики целятся в классы QoS (Quality of Service: User Interactive / User Initiated / Utility /
  Background), а не в сырые приоритеты; Grand Central Dispatch транслирует QoS в приоритет планировщика
  ядра.
  https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/PrioritizeWorkAtTheTaskLevel.html
- На Apple Silicon потоки с низким QoS запираются на энергоэффективные (E) ядра; потоки с более высоким
  QoS могут выполняться и на E-, и на производительных (P) ядрах.
  https://github.com/apple-oss-distributions/xnu/blob/main/doc/scheduler/sched_clutch_edge.md

**Android (бонус, к тезису "разные ограничения → разный дизайн"):**
- Основан на Linux, наследует CFS/EEVDF, но добавляет **EAS** (Energy Aware Scheduling, в mainline с
  ядра 5.0) — размещает задачи на наиболее энергоэффективном ядре кластеров big.LITTLE/DynamIQ по
  модели энергопотребления на ядро, оптимизируя не справедливость/задержку, а автономность.
  https://docs.kernel.org/scheduler/sched-energy.html ,
  https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/energy-aware-scheduling-in-linux

## 5. Теория ГА: отбор, элитизм, exploration/exploitation

- **"A Review of Selection Strategies in Genetic Algorithm"** (Academia.edu)
  https://www.academia.edu/35039122/A_Review_of_Selection_strategies_in_Genetic_Algorithm
  Обзор roulette-wheel (пропорциональный отбор), ранговый, турнирный отбор с компромиссами —
  напрямую подтверждает выбор "пропорционального отбора", зафиксированный в модели проекта, и даёт
  материал для слайда-сравнения с альтернативами.

- **"Comparative Analysis of Rank and Roulette Wheel Selection"** (thesai.org, PDF)
  https://thesai.org/Downloads/Volume16No6/Paper_56-Comparative_Analysis_of_Rank_and_Roulette_Wheel_Selection.pdf
  В их экспериментах ранговый отбор сходится за меньшее число поколений и стабильнее, чем
  roulette-wheel — полезная оговорка: пропорциональный/roulette отбор (выбор этого проекта) прост и
  классичен, но подвержен преждевременной сходимости, если одна особь рано доминирует по fitness;
  стоит одной фразой упомянуть ранговый/турнирный отбор как альтернативы.

- **"Selection Methods in Genetic Algorithms and Their Impact on Real-World Optimization Problems"**
  (Medium, популярное изложение)
  https://medium.com/@suyanthapa07/selection-methods-in-genetic-algorithms-and-their-impact-on-real-world-optimization-problems-5d245f4d1f8d
  Понятное изложение roulette/tournament/rank/элитизма и exploration-vs-exploitation — удобно для
  черновика тезисов слайдов; в самом отчёте лучше ссылаться на академические источники выше.
