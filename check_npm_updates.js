const { execSync } = require('child_process');
const fs = require('fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

const updates = [];
const majors_skipped = [];

for (const [name, range] of Object.entries(dependencies)) {
	try {
		const latest = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();
		// This is a very basic version comparison. In a real scenario, we'd use semver.
		// But for this task, I'll just check if the latest is different from the current range.
		// For simplicity, I'll just check if the latest version satisfies the range.
		// Actually, I'll just check if the latest version is higher than the one in package.json.

		// To be more precise, I'll try to see if the latest version is a new minor/patch.
		// I'll use a simple approach: if latest is not in the range, it's an update.
		// But I don't have the 'semver' package available to run easily in a script without installing it.
		// I'll just check if the latest version is different from what's currently specified.

		// Let's just use a simple check: if the latest version is different from the version in package.json.
		// We'll need to parse the range.

		// For now, let's just report if the latest version is different from the version in package.json.
		// This is not perfect but it's a start.

		// Let's try to find the version in package.json (without the range)
		const currentVersionMatch = range.match(/[\d.]+/);
		const currentVersion = currentVersionMatch ? currentVersionMatch[0] : null;

		if (currentVersion && latest !== currentVersion) {
			// Check if it's a major update
			const currentMajor = currentVersion.split('.')[0];
			const latestMajor = latest.split('.')[0];

			if (currentMajor !== latestMajor) {
				majors_skipped.push(`${name} ${currentVersion} -> ${latest}`);
			} else {
				updates.push({
					package: name,
					ecosystem: 'npm',
					old: currentVersion,
					new: latest,
					why: 'update'
				});
			}
		}
	} catch (e) {
		console.error(`Error checking ${name}: ${e.message}`);
	}
}

console.log(JSON.stringify({ updates, majors_skipped }, null, 2));
