
const { execSync } = require('child_process');
const fs = require('fs');
const semver = require('semver');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const updates = [];
const majors_skipped = [];

for (const [name, range] of Object.entries(deps)) {
    try {
        const latest = execSync(`npm_config_cache=/tmp/npm-cache npm view ${name} version`, { encoding: 'utf8' }).trim();
        
        // Clean range (remove ^, ~, etc.)
        const currentVersion = semver.minVersion(range).version;
        
        if (semver.gt(latest, currentVersion)) {
            if (semver.diff(currentVersion, latest) === 'major') {
                majors_skipped.push(`${name} ${currentVersion} -> ${latest}`);
            } else {
                updates.push({
                    package: name,
                    ecosystem: 'npm',
                    old: currentVersion,
                    new: latest,
                    type: 'direct',
                    why: 'update'
                });
            }
        }
    } catch (e) {
        // Ignore errors for packages that might not be found or other issues
    }
}

console.log('--- UPDATES ---');
updates.forEach(u => console.log(`${u.package}: ${u.old} -> ${u.new}`));
console.log('--- MAJORS SKIPPED ---');
majors_skipped.forEach(m => console.log(m));

// Write to a temporary file for the agent to read
const result = JSON.stringify({ updates, majors_skipped }, null, 2);
fs.writeFileSync('updates_result.json', result);
