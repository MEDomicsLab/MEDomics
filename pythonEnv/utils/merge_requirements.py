import os
import sys
import datetime
from packaging import version
from compare_requirements import compare_requirements

def check_merge_compatibility_with_upgrades(file1_path, file2_path, report_path=None):
    """
    Check if two requirements.txt files can be merged by taking the latest version
    when there are conflicts.
    
    Args:
        file1_path: Path to the first requirements.txt file
        file2_path: Path to the second requirements.txt file
        report_path: Path where to save the report (optional)
        
    Returns:
        A tuple containing:
        - Boolean indicating if all conflicts can be resolved by upgrading
        - Dictionary with merged requirements (package name -> version)
        - Dictionary of unresolvable conflicts with reasons
        - Path to the generated report
    """
    # Use the existing comparison functionality
    unique_to_file1, unique_to_file2, version_differences, comparison_report = compare_requirements(
        file1_path, file2_path, report_path=None  # Don't generate a report yet
    )
    
    # Initialize results
    can_be_merged = True
    merged_requirements = {}
    unresolvable_conflicts = {}
    
    # Add all packages unique to each file
    for pkg, ver in unique_to_file1.items():
        merged_requirements[pkg] = ver
    
    for pkg, ver in unique_to_file2.items():
        merged_requirements[pkg] = ver
    
    # Process version differences
    for pkg, (ver1, ver2) in version_differences.items():
        # Case 1: If either version is None (no specific version required)
        if ver1 is None or ver2 is None:
            # Take the specific version if available, otherwise None
            merged_requirements[pkg] = ver1 if ver1 is not None else ver2
            continue
            
        try:
            # Case 2: Compare versions and take the newer one
            v1 = version.parse(ver1)
            v2 = version.parse(ver2)
            
            if v1 > v2:
                merged_requirements[pkg] = ver1
            else:
                merged_requirements[pkg] = ver2
        except Exception as e:
            # Case 3: Can't parse version strings (invalid format)
            can_be_merged = False
            unresolvable_conflicts[pkg] = f"Cannot compare versions: {ver1} vs {ver2}. Error: {str(e)}"
    
    # Generate a merged requirements.txt content
    merged_content = []
    for pkg, ver in sorted(merged_requirements.items()):
        if ver is not None:
            merged_content.append(f"{pkg}=={ver}")
        else:
            merged_content.append(pkg)
    
    # Generate report about mergeability
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    if report_path is None:
        report_path = f"requirements_merge_{timestamp}.txt"
    
    with open(report_path, 'w') as f:
        f.write(f"# Requirements Merge Analysis Report\n")
        f.write(f"# Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# File 1: {file1_path}\n")
        f.write(f"# File 2: {file2_path}\n\n")
        
        f.write(f"## Can all conflicts be resolved by upgrading? {'Yes' if can_be_merged else 'No'}\n\n")
        
        if unresolvable_conflicts:
            f.write("## Unresolvable Conflicts\n")
            for pkg, reason in unresolvable_conflicts.items():
                f.write(f"  - {pkg}: {reason}\n")
            f.write("\n")
        
        f.write("## Version Resolution Details\n")
        if version_differences:
            for pkg, (ver1, ver2) in version_differences.items():
                resolved_version = merged_requirements.get(pkg, "Unknown")
                if pkg in unresolvable_conflicts:
                    resolution = "CONFLICT - Cannot resolve"
                else:
                    resolution = f"Resolved to {resolved_version}"
                f.write(f"  - {pkg}: {ver1} vs {ver2} → {resolution}\n")
        else:
            f.write("  None\n")
        
        f.write("\n## Proposed Merged Requirements\n")
        for line in merged_content:
            f.write(f"  {line}\n")
    
    # Write the merged requirements to a separate file
    merged_file_path = os.path.join(os.path.dirname(report_path), f"merged_requirements_{timestamp}.txt")
    with open(merged_file_path, 'w') as f:
        for line in merged_content:
            f.write(f"{line}\n")
    
    # Print summary to console
    print(f"\nRequirements Merge Analysis:")
    print(f"Can resolve all conflicts by upgrading: {'Yes' if can_be_merged else 'No'}")
    print(f"Packages with version differences: {len(version_differences)}")
    print(f"Unresolvable conflicts: {len(unresolvable_conflicts)}")
    print(f"Analysis report saved to: {report_path}")
    print(f"Merged requirements saved to: {merged_file_path}")
    
    return can_be_merged, merged_requirements, unresolvable_conflicts, report_path

if __name__ == "__main__":
    # Check if correct number of arguments is provided
    if len(sys.argv) < 3:
        print("Usage: python merge_requirements.py <file1_path> <file2_path> [report_path]")
        sys.exit(1)
    
    file1_path = sys.argv[1]
    file2_path = sys.argv[2]
    report_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Check if files exist
    if not os.path.exists(file1_path):
        print(f"Error: File not found: {file1_path}")
        sys.exit(1)
    if not os.path.exists(file2_path):
        print(f"Error: File not found: {file2_path}")
        sys.exit(1)
    
    check_merge_compatibility_with_upgrades(file1_path, file2_path, report_path)