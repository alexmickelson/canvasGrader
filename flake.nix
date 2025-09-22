{
  description = "Dev flake to run frontend (Vite) and backend (Express/tRPC) together";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
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
        
        # Build the production package once
        canvasGraderProd = pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "canvasgrader";
          version = "0.0.0";
          
          src = ./.;
          
          nativeBuildInputs = with pkgs; [
            nodejs_20
            pnpm_9.configHook
          ];
          
          pnpmDeps = pkgs.pnpm_9.fetchDeps {
            inherit (finalAttrs) pname version src;
            fetcherVersion = 2;
            hash = "sha256-P+hwz2N0nqfksJ8cdCwXTmr/fPrKaEyiFAo1nEPjb10=";
          };
          
          buildPhase = ''
            runHook preBuild
            
            # Build the application
            pnpm run build:prod
            
            # Create package.json for server to use CommonJS
            cat > dist-server/package.json << 'EOF'
            {
              "type": "commonjs"
            }
            EOF
            
            runHook postBuild
          '';
          
          installPhase = ''
            runHook preInstall
            
            mkdir -p $out/lib/canvasgrader
            cp -r dist $out/lib/canvasgrader/
            cp -r dist-server $out/lib/canvasgrader/
            cp -r node_modules $out/lib/canvasgrader/
            cp package.json $out/lib/canvasgrader/
            
            # Create wrapper script
            mkdir -p $out/bin
            cat > $out/bin/canvasgrader << EOF
            #!/bin/sh
            export NODE_ENV=production
            export NODE_PATH=$out/lib/canvasgrader/node_modules
            exec ${pkgs.nodejs_20}/bin/node --enable-source-maps $out/lib/canvasgrader/dist-server/server/server.js "\$@"
            EOF
            chmod +x $out/bin/canvasgrader
            
            runHook postInstall
          '';
          
          meta = with pkgs.lib; {
            description = "Canvas grader application";
            homepage = "https://github.com/alexmickelson/canvasGrader";
          };
        });

        startScript = pkgs.writeShellApplication {
          name = "run-canvasgrader";
          runtimeInputs = with pkgs; [ nodejs_20 pnpm gh gh-classroom graphicsmagick ];
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
          packages = [ pkgs.nodejs_20 pkgs.pnpm pkgs.gh pkgs.gh-classroom pkgs.graphicsmagick ];
          shellHook = ''
            echo "Dev shell ready. Start both services with: nix run"
            echo "GitHub CLI available. Install classroom extension with: gh extension install github/gh-classroom"
          '';
        };

        packages.default = canvasGraderProd;

        apps.default = {
          type = "app";
          program = "${startScript}/bin/y";
        };

        # Production app: run the pre-built package
        apps.production = {
          type = "app";
          program = "${canvasGraderProd}/bin/canvasgrader";
        };
      });
}
