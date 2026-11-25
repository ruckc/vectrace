
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

function isCompatible(range, latest) {
    // Very basic compatibility check for the purpose of this task
    // We'll assume ^ and ~ are used.
    const cleanRange = range.replace(/[\^~]/, '');
    const [rMajor, rMinor, rPatch] = parseVersion(cleanRange);
    const [lMajor, lMinor, lPatch] = parseVersion(latest);

    if (range.startsWith('~')) {
        return rMajor === lMajor && rMinor === lMinor;
    } else {
        return rMajor === lMajor;
    }
}

for (const [name, range] of Object.entries(deps)) {
    const latest = getLatestVersion(name);
    if (!latest) continue;

    const cleanRange = range.replace(/[\^~]/, '');
    const [rMajor, rMinor, rPatch] = parseVersion(cleanRange);
    const [lMajor, lMinor, lPatch] = parseVersion(latest);

    if (lMajor > rMajor) {
        majors_skipped.push(`${name} ${cleanRange} -> ${latest}`);
    } else if (lMajor === rMajor && (lMinor > rMinor || (lMinor === rMinor && lPatch > rPatch))) {
        updates.push({
            package: name,
            ecosystem: 'npm',
            old: cleanRange,
            new: latest,
            type: 'direct',
            why: 'update'
        });
    }
}

console.log('--- UPDATES ---');
updates.forEach(u => console.log(`${u.package}: ${u.old} -> ${u.new}`));
console.log('--- MAJORS SKIPPED ---');
majors_skipped.forEach(m => console.log(m));

const result = JSON.stringify({ updates, majors_skipped }, null, 2);
fs.writeFileSync('updates_result.json', result);
