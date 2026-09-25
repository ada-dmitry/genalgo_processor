{
  description = "Генетический алгоритм для планирования процессов — курсовая МИФИ, ИАД";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # Форматирование единой командой `nix fmt`.
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";

    # pre-commit хук: перед коммитом гоняет treefmt и блокирует коммит,
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
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      # ruff — для demo/py, nixfmt — для самого flake.nix.
      # JS/HTML-форматтер не подключён: prettier и biome переформатировали бы
      # весь demo/js и presentation/web/deck.html.
      treefmtEval = treefmt-nix.lib.evalModule pkgs {
        projectRootFile = "flake.nix";
        programs.ruff-format.enable = true;
        programs.ruff-check.enable = true;
        programs.nixfmt.enable = true;
      };

      # Ставится shellHook'ом при входе в devShell.
      preCommitCheck = git-hooks.lib.${system}.run {
        src = ./.;
        hooks.treefmt = {
          enable = true;
          package = treefmtEval.config.build.wrapper;
        };
      };
    in
    {
      formatter.${system} = treefmtEval.config.build.wrapper;

      checks.${system}.pre-commit-check = preCommitCheck;

      devShells.${system}.default = pkgs.mkShell {
        # demo/js — чистый Node без npm-зависимостей, demo/py — только stdlib.
        # Для PNG в demo/js/render_charts.js нужен chromium на PATH — берётся
        # системный, сюда не добавлен ради размера closure.
        packages = with pkgs; [
          nodejs
          python3
        ];

        shellHook = ''
          ${preCommitCheck.shellHook}
          echo "node $(node --version), $(python3 --version)"
        '';
      };
    };
}
