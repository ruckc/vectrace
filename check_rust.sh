#!/bin/bash
echo "package|latest"
packages=(
  "visioncortex"
  "wasm-bindgen"
  "js-sys"
  "serde-wasm-bindgen"
  "console_error_panic_hook"
)

for pkg in "${packages[@]}"; do
  latest=$(curl -s "https://crates.io/api/v1/crates/$pkg" | python3 -c "import sys, json; print(json.load(sys.stdin)['crate']['max_version'])" 2>/dev/null)
  if [ -n "$latest" ] && [ "$latest" != "None" ]; then
    echo "$pkg|$latest"
  fi
done
