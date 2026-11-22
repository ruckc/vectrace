#!/bin/bash

# Read packages from local package.json
packages=$(jq -r '.dependencies, .devDependencies | to_entries[] | .key' package.json)

echo "package|latest"
for pkg in $packages; do
  # Use python to avoid jq parsing issues with some npm registry responses
  latest=$(curl -s "https://registry.npmjs.org/$pkg" | python3 -c "import sys, json; print(json.load(sys.stdin)['dist-tags']['latest'])" 2>/dev/null)
  if [ -n "$latest" ] && [ "$latest" != "None" ]; then
    echo "$pkg|$latest"
  fi
done
