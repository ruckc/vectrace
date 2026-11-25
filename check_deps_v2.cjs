
const { execSync } = require('child_process');
const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const updates = [];
const majors_skipped = [];

function getLatestVersion(name) {
    try {
        return execSync(`npm_config_cache=/tmp/npm-cache npm view ${name} version`, { encoding: 'utf8' }).trim();
    } catch (e) {
        return null;
    }
}

function parseVersion(v) {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

for (const [name, range] of Object.entries(deps)) {
    const latest = getLatestVersion(name);
    if (!latest) continue;

    const cleanRange = range.replace(/[\^~]/, '');
    const [rMajor, rMinor, rPatch] = parseVersion(cleanRange);
    const [lMajor, lMinor, lPatch] = parseVersion(latest);

    if (lMajor > rMajor) {
        majors_skipped.push(`${name} ${cleanRange} -> ${latest}`);
    } else if (lMajor === rMajor && (lMinor > rMinor || (lRel = (lMinor === rMinor && lPatch > rPatch)))) {
        // Wait, I made a typo in the logic above. Let's fix it.
    }
}
// ...
