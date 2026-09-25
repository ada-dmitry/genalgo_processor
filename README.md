# Генетические алгоритмы в планировании процессов

Курсовой проект по дисциплине «Интеллектуальный анализ данных» (МИФИ): применение генетического алгоритма
к планированию процессов на одном процессоре. Критерий — взвешенная сумма моментов завершения
`F(x) = Σ qᵢCᵢ → min`; хромосома — само расписание по квантам CPU. Для этой модели точный ответ даёт
правило Смита (WSPT), поэтому оно служит эталоном для проверки ГА. Основной результат — презентация и
доклад; программа в `demo/` лишь иллюстрирует теорию реальными числами. Формальная постановка — в `CLAUDE.md`.

## Структура

```
docs/
  research_notes.md        источники: ГА в планировании, операторы (GOX), классические алгоритмы, ОС
  ga_theory_notes.md       теория ГА по конспекту лекций курса
talk/
  presentation_script.md   план слайдов
  speech.md                полный текст выступления
presentation/
  Prez_IAD_-RED1.pptx      итоговая презентация (30 слайдов) — основная
  web/                     HTML-версия презентации (deck.html, ga_history.js, README.md)
demo/
  js/                      ГА, базовые алгоритмы, запуск демо, сравнение отборов, рендер графиков
  py/                      пошаговый разбор первой половины ГА, проверки правила Смита, давление отбора
  data/                    результаты запусков (convergence.json, *_data.js)
  charts/                  HTML-графики и отрендеренные SVG/PNG для слайдов
flake.nix, .envrc          devShell с nodejs и python3
```

## Запуск

Глобальных `node` и `python3` нет — войдите в devShell: `nix develop` (или автоматически через direnv).
Команды выполняются из корня репозитория.

```sh
node demo/js/run_demo.js            # ГА на 6 процессах, сравнение с FCFS/SJF/Priority/RR/WSPT → demo/data/convergence.json
node demo/js/compare_selection.js   # три схемы отбора, ~1.5 мин → demo/data/selection_compare_data.js
node demo/js/render_charts.js       # графики отбора → demo/charts/*.svg, *.png

python demo/py/ga_model.py          # пошаговая трассировка; --check — самопроверки
python demo/py/check_wspt.py        # проверки правила Смита на случайных примерах
python demo/py/selection_pressure.py  # → demo/data/selection_pressure_data.js
```

Без devShell Python-скрипты можно запустить через `nix-shell -p python3 --run "python demo/py/ga_model.py"`.

HTML-презентация: откройте `presentation/web/deck.html` в браузере (стрелки/пробел, `F` — полный экран).
Как пересобрать `ga_history.js` из `demo/data/convergence.json` — в `presentation/web/README.md`.

## Захардкоженные числа

Результаты демо вписаны вручную в `presentation/web/deck.html`, `demo/charts/convergence_chart.html`,
`talk/presentation_script.md`, `talk/speech.md` и в pptx. При смене тестового набора или параметров ГА их
нужно обновить руками во всех этих местах.
