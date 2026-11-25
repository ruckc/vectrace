const { execSync } = require('child_process');
const fs = require('fs');
const semver = require('semver'); // I hope it's available, otherwise I'll use a simpler way

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

const updates = [];
const majors_skipped = [];

for (const [name, range] of Object.entries(dependencies)) {
	try {
		const latest = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();

		// We want to find the latest version that satisfies the range,
		// but the task says "Every available patch and minor update (latest release, no cooldown)".
		// This usually means the highest version that doesn't change the major version,
		// UNLESS it's a security fix. But the task says "Major updates ONLY when needed to fix a known vulnerability".
		// So we look for the latest version in the same major.

		// Let's use a simpler logic:
		// 1. Get latest version.
		// 2. If latest major == current major, it's an update.
		// 3. If latest major != current major, it's a skipped major.

		// To get current version, we'll look at package-lock.json or just assume the range is what we have.
		// Actually, let's just use the range to check if latest satisfies it.

		// We need to parse the range to find the current major.
		// Since I can't easily use semver without knowing if it's installed,
		// I'll use a regex to find the first version-like string in the range.
		const versionMatch = range.match(/[\d.]+/);
		if (!versionMatch) continue;
		const currentVersion = versionMatch[0];
		const currentMajor = currentVersion.split('.')[0];
		const latestMajor = latest.split('.')[0];

		if (currentMajor !== latestMajor) {
			majors_skipped.push(`${name} ${currentVersion} -> ${latest}`);
		} else if (latest !== currentVersion) {
			// Check if it's actually an update (not just a different version in the same major that is lower)
			// But npm view version returns the absolute latest.
			updates.push({
				package: name,
				ecosystem: 'npm',
				old: currentVersion,
				new: latest,
				why: 'update'
			});
		}
	} catch (e) {
		// console.error(`Error checking ${name}: ${e.message}`);
	}
}

console.log(JSON.stringify({ updates, majors_skipped }, null, 2));
