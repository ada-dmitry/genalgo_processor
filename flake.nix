{
  # ЗАМЕНИТЕ на описание своего проекта.
  description = "Python (uv) dev shell template";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # Форматирование кода (ruff, nixfmt) единой командой `nix fmt`.
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";

    # git pre-commit хук: при входе в `nix develop` ставит хук, который
    # перед каждым коммитом гоняет treefmt (см. ниже) и блокирует коммит,
    # если тот что-то поправил.
    git-hooks.url = "github:cachix/git-hooks.nix";
    git-hooks.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      treefmt-nix,
      git-hooks,
    }:
    let
      # ── ПЛАТФОРМА ────────────────────────────────────────────────
      # Один system вместо flake-utils/forAllSystems — проще читать,
      # но шаблон соберётся только под неё. Если нужен ещё
      # aarch64-darwin (Mac) или aarch64-linux — смотри пример с
      # forAllSystems в DZR/nto_2026/flake.nix и адаптируй по образцу.
      system = "x86_64-linux";

      pkgs = nixpkgs.legacyPackages.${system};

      # ── ФОРМАТТЕР ────────────────────────────────────────────────────
      # `ruff-format` форматирует код, `ruff-check` (с `--fix`) чинит
      # lint-замечания, которые можно исправить автоматически (неиспользуемые
      # импорты, сортировка и т.п.). `nixfmt` заодно форматирует сам flake.nix.
      # Запуск: `nix fmt`. Другие форматтеры — из
      # https://github.com/numtide/treefmt-nix/tree/main/programs, добавляются
      # как `programs.<имя>.enable = true;` в этот же блок.
      treefmtEval = treefmt-nix.lib.evalModule pkgs {
        projectRootFile = "flake.nix";
        programs.ruff-format.enable = true;
        programs.ruff-check.enable = true;
        programs.nixfmt.enable = true;
      };

      # ── PRE-COMMIT ХУК ────────────────────────────────────────────────
      # Устанавливается shellHook'ом ниже при входе в devShell. Требует
      # git-репозиторий (`git init`) — вне git просто ничего не делает.
      # Чтобы добавить lint как отдельный (не автофиксящий) хук — смотри
      # builtin-хуки в https://github.com/cachix/git-hooks.nix (например
      # `hooks.mypy.enable = true;`).
      preCommitCheck = git-hooks.lib.${system}.run {
        src = ./.;
        hooks.treefmt = {
          enable = true;
          package = treefmtEval.config.build.wrapper;
        };
      };

      # ── ПОЧЕМУ nix-ld, А НЕ buildFHSEnv ──────────────────────────────
      # `uv` качает бинарные wheels прямо с PyPI (numpy, pandas,
      # psycopg2-binary, torch, lxml и т.п.), слинкованные под
      # стандартные пути обычного Linux (/lib64/ld-linux…, /usr/lib/…).
      # На NixOS/чистом Nix этих путей нет — такие wheels падают с
      # "cannot open shared object file: No such file or directory".
      #
      # buildFHSEnv чинит это через bwrap-песочницу, но она устроена
      # вокруг `exec` в отдельный bash-процесс — это несовместимо с
      # direnv: nix-direnv вычисляет окружение, прогоняя shellHook и
      # снимая diff переменных, а `exec` внутри shellHook его процесс
      # заменяет и не возвращает управление. На практике это выглядит
      # как вложенная интерактивная bash-сессия, вылезающая поверх
      # текущего шелла с портянкой вывода при каждом `direnv allow`/
      # входе в директорию — вместо тихой инъекции переменных.
      #
      # nix-ld (включён системно — modules/nixos/base.nix,
      # programs.nix-ld) решает ту же задачу без sandbox и без exec:
      # подсовывает бинарям совместимый динамический линкер через
      # NIX_LD/NIX_LD_LIBRARY_PATH. Обычный mkShell, обычный direnv,
      # шелл не переключается.
      #
      # Минус по сравнению с FHS: библиотеки под конкретные бинарные
      # wheels нужно перечислять явно (см. nixLdLibs ниже) — FHS делал
      # это неявно, просто выдавая все targetPkgs как единую ФС.
      nixLdLibs = with pkgs; [
        zlib
        openssl
        libffi
        stdenv.cc.cc.lib # нужен многим бинарным wheels (numpy/pandas/scipy/torch — тянут libstdc++)

        # ── ОПЦИОНАЛЬНЫЕ БЛОКИ — раскомментируйте нужное ─────────────

        # Работа с Postgres (psycopg2/asyncpg) без готовых бинарных wheels:
        # postgresql

        # Детект типов файлов через python-magic (как в trilium-tg):
        # file

        # Обработка медиа (ffmpeg-python, pydub, moviepy):
        # ffmpeg
      ];
    in
    {
      formatter.${system} = treefmtEval.config.build.wrapper;

      # `nix flake check` проверит, что хуки/форматтер валидны и что
      # дерево уже отформатировано (best-effort).
      checks.${system}.pre-commit-check = preCommitCheck;

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          # uv сам ставит и пинит нужный Python (по файлу .python-version
          # в корне проекта) и управляет venv через `uv sync` / `uv run`.
          # Если .python-version в проекте ещё нет — создайте:
          #   uv python pin 3.13
          uv

          # ── ОПЦИОНАЛЬНЫЕ БЛОКИ — раскомментируйте нужное ─────────────

          # Проект дёргает git/ssh изнутри кода (например синк с приватным
          # репозиторием, как в memoir_bot):
          # git
          # openssh
        ];

        shellHook = ''
          ${preCommitCheck.shellHook}

          # Дополняем (не перезаписываем!) системный NIX_LD_LIBRARY_PATH
          # из programs.nix-ld — иначе слетят библиотеки, нужные другим
          # инструментам, запущенным из этого же шелла (например Zed).
          export NIX_LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath nixLdLibs}:$NIX_LD_LIBRARY_PATH"

          echo "uv: $(uv --version)"
        '';
      };
    };
}
