{
  description = "Dev flake to run frontend (Vite) and backend (Express/tRPC) together";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { 
    self, 
    nixpkgs, 
    flake-utils 
  }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        startScript = pkgs.writeShellApplication {
          name = "run-canvasgrader";
          runtimeInputs = with pkgs; [ nodejs_20 pnpm ];
          text = ''
            set -euo pipefail

            # Ensure dependencies are installed
            if [ ! -d node_modules ]; then
              echo "Installing dependencies with pnpm..."
            fi
            # Try strict install first, fall back if lockfile drifted
            pnpm install --frozen-lockfile || pnpm install

            # Configure backend port (override with PORT env var)
            BACKEND_PORT="''${PORT:-3001}"
            export PORT="$BACKEND_PORT"
            export TRPC_TARGET="http://localhost:$BACKEND_PORT"

            # Run frontend (Vite) and backend (tRPC/Express) concurrently
            pnpm run dev &
            FRONT_PID=$!
            pnpm run server &
            BACK_PID=$!

            cleanup() {
              echo "Shutting down..."
              kill "$FRONT_PID" "$BACK_PID" 2>/dev/null || true
              wait "$FRONT_PID" "$BACK_PID" 2>/dev/null || true
            }
            trap cleanup INT TERM EXIT

            # Wait for either process to exit, then exit (trap will clean up)
            wait -n
          '';
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_20 pkgs.pnpm ];
          shellHook = ''
            echo "Dev shell ready. Start both services with: nix run"
          '';
        };

        apps.default = {
          type = "app";
          program = "${startScript}/bin/run-canvasgrader";
        };

        # Production app: build client and server, then run compiled server
        apps.production = let
          prodScript = pkgs.writeShellApplication {
            name = "run-canvasgrader-prod";
            runtimeInputs = with pkgs; [ nodejs_20 pnpm ];
            text = ''
              set -euo pipefail

              # install deps and build
              pnpm install --frozen-lockfile || pnpm install
              pnpm run build
              pnpm run build:server

              # run compiled server which also serves static dist
              export NODE_ENV=production
              exec node --enable-source-maps dist-server/server.js
            '';
          };
        in {
          type = "app";
          program = "${prodScript}/bin/run-canvasgrader-prod";
        };
      });
}
