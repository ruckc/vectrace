#!/bin/bash
export npm_config_cache=$(pwd)/.npm_cache

echo "--- NPM UPDATES ---"
package_json="package.json"
if [ -f "$package_json" ]; then
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
