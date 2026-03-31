#!/usr/bin/env bash
set -euo pipefail

# Build the Rust WASM module for the board overlay renderer.
# Requires: rustup with wasm32-unknown-unknown target, wasm-pack
#
# The --target web output works in both browser and Node.js (with async init).
# The API route uses this server-side on edge runtime.

cd "$(dirname "$0")"

# Ensure rustup's compiler is used (not Homebrew's) for wasm32 target support
if [ -d "$HOME/.rustup/toolchains/stable-$(rustc -vV | grep host | cut -d' ' -f2)/bin" ]; then
  export PATH="$HOME/.rustup/toolchains/stable-$(rustc -vV | grep host | cut -d' ' -f2)/bin:$PATH"
fi

wasm-pack build --target web --out-dir pkg

echo "WASM build complete. Output in pkg/"
