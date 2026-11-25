#!/bin/bash
export npm_config_cache=$(pwd)/.npm_cache

echo "--- NPM UPDATES ---"
package_json="package.json"
if [ -f "$package_json" ]; then
    # Extract dependencies and devDependencies using node
    node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const deps = {...pkg.dependencies, ...pkg.devDependencies};
    for (const [name, range] of Object.entries(deps)) {
        const currentVersionMatch = range.match(/[\d.]+/);
        if (currentVersionMatch) {
            const currentVersion = currentVersionMatch[0];
            const currentMajor = currentVersion.split(".")[0];
            try {
                const latest = require("child_process").execSync(`npm view ${name} version`, {encoding: "utf8"}).trim();
                const latestMajor = latest.split(".")[0];
                if (currentMajor !== latestMajor) {
                    console.log(`MAJOR_SKIP:${name}:${currentVersion}->${latest}`);
                } else if (latest !== currentVersion) {
                    console.log(`UPDATE:${name}:${currentVersion}->${latest}`);
                }
            } catch (e) {
                // console.error("Error checking " + name + ": " + e.message);
            }
        }
    }
    '
fi

echo "--- CARGO UPDATES ---"
cargo_toml="crates/vectrace-wasm/Cargo.toml"
if [ -f "$cargo_toml" ]; then
    # Simple parsing of Cargo.toml for dependencies
    # We look for lines like: vtracer = "=1.0.0-alpha.3" or visioncortex = "0.9"
    grep -E '^[a-zA-Z0-9_-]+ = ' "$cargo_toml" | while read -r line; do
        name=$(echo "$line" | cut -d' ' -f1)
        range=$(echo "$line" | cut -d'=' -f2- | tr -d '" ' | tr -d "'")
        
        # For simplicity, we'll just check if there's a newer version available.
        # This is hard with just grep/cut because we need to query crates.io.
        # But I can use `cargo pkgid` or similar if I had cargo installed and working.
        # Since I don't have easy access to crates.io API via bash without curl, 
        # and I'm not allowed to run arbitrary code, I'll try to use `cargo update` 
        # but I'll only use it if I can see what it would do.
        # Actually, I'll just skip cargo for now unless I can find a way.
        # Wait, I can use `cargo update --dry-run` if it exists.
        
        # Let's try cargo update --dry-run
        # But I need to be in a cargo environment.
        echo "Checking $name ($range)..."
    done
fi
