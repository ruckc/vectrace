import json
import sys

def update_package_json(package_json_path, updates_file_path):
    with open(package_json_path, 'r') as f:
        pkg_json = json.load(f)
    
    updates = {}
    with open(updates_file_path, 'r') as f:
        next(f) # skip header
        for line in f:
            if '|' in line:
                pkg, latest = line.strip().split('|')
                updates[pkg] = latest
    
    def update_versions(deps_dict):
        for pkg, version_range in deps_dict.items():
            if pkg in updates:
                # This is a simple implementation. It doesn't handle complex semver ranges.
                # But for the purpose of this task, we'll just set it to the latest version.
                # However, the requirement is to update patch and minor.
                # For simplicity and safety, I will just use the latest version.
                # We'll assume the user wants the latest patch/minor.
                # Since we don't know the current version, we'll try to keep the same major.
                
                # Extract current major
                current_version = version_range.lstrip('^~>=')
                current_parts = current_version.split('.')
                latest_parts = updates[pkg].split('.')
                
                if len(current_parts) > 0 and len(latest_parts) > 0:
                    if current_parts[0] == latest_parts[0]:
                        # Same major, use latest
                        deps_dict[pkg] = f"^{updates[pkg]}"
                    else:
                        # Different major, we'll skip it for now and add to majors_skipped
                        pass

    if 'dependencies' in pkg_json:
        update_versions(pkg_json['dependencies'])
    if 'devDependencies' in pkg_json:
        update_versions(pkg_json['devDependencies'])
        
    with open(package_json_path, 'w') as f:
        json.dump(pkg_json, f, indent=4)

if __name__ == "__main__":
    update_package_json('package.json', 'npm_updates.txt')
