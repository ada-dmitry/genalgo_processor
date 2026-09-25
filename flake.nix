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

      # ruff — для ноутбука main.ipynb, nixfmt — для самого flake.nix.
      # HTML-форматтер не подключён: prettier переформатировал бы demo/charts/*.html.
      treefmtEval = treefmt-nix.lib.evalModule pkgs {
        projectRootFile = "flake.nix";
        programs.ruff-format.enable = true;
        programs.ruff-check.enable = true;
        programs.nixfmt.enable = true;
        # ноутбук тоже форматируем и проверяем (по умолчанию ruff в treefmt — только *.py)
        settings.formatter.ruff-format.includes = [ "*.ipynb" ];
        settings.formatter.ruff-check.includes = [ "*.ipynb" ];
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
        # Jupyter и matplotlib — как в requirements.txt; nbconvert — чтобы выполнить
        # main.ipynb целиком.
        packages = with pkgs; [
          (python3.withPackages (
            ps: with ps; [
              matplotlib
              notebook
              nbconvert
              ipykernel
            ]
          ))
        ];

        shellHook = ''
          ${preCommitCheck.shellHook}
          echo "$(python3 --version), jupyter $(jupyter notebook --version)"
        '';
      };
    };
}
