import os
import sys
import datetime

def compare_requirements(file1_path, file2_path, report_path=None):
    """
    Compare two requirements.txt files and show discrepancies.
    Saves the results to a report file.
    
    Args:
        file1_path: Path to the first requirements.txt file
        file2_path: Path to the second requirements.txt file
        report_path: Path where to save the report (optional)
        
    Returns:
        A tuple of dictionaries containing:
        - packages unique to file1
        - packages unique to file2
        - packages with version differences
        - path to the generated report
    """
    # Parse requirements.txt files
    def parse_requirements(filepath):
        requirements = {}
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#') or line.startswith('//'):
                    continue
                # Handle version specifiers
                if '==' in line:
                    package, version = line.split('==', 1)
                    requirements[package] = version
                else:
                    # For packages without version specifiers
                    requirements[line] = None
        return requirements
    
    # Parse both files
    req1 = parse_requirements(file1_path)
    req2 = parse_requirements(file2_path)
    
    # Find differences
    unique_to_file1 = {pkg: ver for pkg, ver in req1.items() if pkg not in req2}
    unique_to_file2 = {pkg: ver for pkg, ver in req2.items() if pkg not in req1}
    
    # Find version differences for common packages
    version_differences = {}
    for pkg in set(req1.keys()) & set(req2.keys()):
        if req1[pkg] != req2[pkg]:
            version_differences[pkg] = (req1[pkg], req2[pkg])
    
    # Create report
    file1_name = os.path.basename(file1_path)
    file2_name = os.path.basename(file2_path)
    
    # Generate report filename if not provided
    if report_path is None:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = f"requirements_comparison_{timestamp}.txt"
    
    with open(report_path, 'w') as f:
        f.write(f"# Requirements Comparison Report\n")
        f.write(f"# Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# File 1: {file1_path}\n")
        f.write(f"# File 2: {file2_path}\n\n")
        
        f.write(f"## Packages unique to {file1_name}\n")
        if unique_to_file1:
            for pkg, ver in unique_to_file1.items():
                f.write(f"  {pkg}{f'=={ver}' if ver else ''}\n")
        else:
            f.write("  None\n")
        
        f.write(f"\n## Packages unique to {file2_name}\n")
        if unique_to_file2:
            for pkg, ver in unique_to_file2.items():
                f.write(f"  {pkg}{f'=={ver}' if ver else ''}\n")
        else:
            f.write("  None\n")
        
        f.write("\n## Version differences\n")
        if version_differences:
            for pkg, (ver1, ver2) in version_differences.items():
                f.write(f"  {pkg}: {ver1} vs {ver2}\n")
        else:
            f.write("  None\n")
    
    # Print summary to console
    print(f"Comparing {file1_path} and {file2_path}")
    print(f"Report saved to: {report_path}")
    print(f"Unique to {file1_name}: {len(unique_to_file1)} packages")
    print(f"Unique to {file2_name}: {len(unique_to_file2)} packages")
    print(f"Version differences: {len(version_differences)} packages")
        
    # Return the differences for potential further processing
    return unique_to_file1, unique_to_file2, version_differences, report_path

if __name__ == "__main__":
    # Check if correct number of arguments is provided
    if len(sys.argv) < 3:
        print("Usage: python compare_requirements.py <file1_path> <file2_path> [report_path]")
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
    
    compare_requirements(file1_path, file2_path, report_path)