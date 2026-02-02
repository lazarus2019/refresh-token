{
  inputs = {
    # nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    # Support a particular subset of the Nix systems
    # systems.url = "github:nix-systems/default";
  };

  outputs =
    { nixpkgs, ... }:
    let
      eachSystem =
        f:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = eachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            # 22.17.0
            # nodejs
            # corepack
            # pre-commit
            # gitlint
            # dprint
            # hyperfine # benchmarking tool
            # awscli2

            # To install a specific alternative package manager directly,
            # comment out one of these to use an alternative package manager.

            # pkgs.yarn
            # pnpm
            bun

            # Required to enable the language server
            # nodePackages.typescript
            # nodePackages.typescript-language-server
            # typescript-go

            # Python is required on NixOS if the dependencies require node-gyp
            # pkgs.python3
          ];

          # Fix error pnpm use dprint from node_modules/ instead of nix
          # shellHook = ''
          #   export AWS_ACCESS_KEY_ID=test
          #   export AWS_SECRET_ACCESS_KEY=test
          #   export AWS_DEFAULT_REGION=ap-northeast-1
          #   export AWS_ENDPOINT_URL=http://localhost:4566
          #   # Determine the path of the Nix-provided dprint binary
          #   NIX_DPRINT_BIN="$(command -v dprint)"

          #   # Check if dprint was found
          #   if [ -z "$NIX_DPRINT_BIN" ]; then
          #     echo "Error: Nix dprint binary not found."
          #   else
          #     # Replace the local dprint binary with a symlink to the Nix binary
          #     # This ensures that when pnpm looks for dprint in node_modules/.bin,
          #     # it finds the symlink pointing to the correctly-linked Nix version.
          #     LOCAL_DPRINT_BIN="./node_modules/.bin/dprint"

          #     echo "Patching local pnpm dprint link..."
              
          #     # Ensure the node_modules/.bin path exists
          #     mkdir -p "$(dirname "$LOCAL_DPRINT_BIN")"

          #     # Remove the broken pnpm-installed binary/shim if it exists
          #     rm -f "$LOCAL_DPRINT_BIN"

          #     # Create a symlink to the Nix binary
          #     ln -s "$NIX_DPRINT_BIN" "$LOCAL_DPRINT_BIN"
              
          #     echo "✅ Local 'dprint' now links to: $(readlink -f "$LOCAL_DPRINT_BIN")"

          #   fi
          # '';
        };
      });
    };
}
