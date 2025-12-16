import json
import subprocess
import sys
import os
import time
from pathlib import Path
import venv

SUPERSET_PACKAGES = [
    "apache-superset==4.1.1",
    "flask-cors==5.0.0",
    "marshmallow==3.26.1",
    "psycopg2-binary==2.9.9",
    "wtforms==2.3.3", # https://github.com/apache/superset/issues/29289#issuecomment-2341321222
]

class SupersetEnvManager:
    def __init__(self, python_path, app_data_path):
        self.python_path = python_path
        self.env_path = None
        
        # Using app_data_path to define environment path (defined by userData https://www.electronjs.org/docs/latest/api/app#appgetapppath)
        # This is a writeable path where we can create our virtual environment (Fix for macOS venv creation issues)
        base_dir = Path(app_data_path)
        if sys.platform == "win32":
            self.env_path = base_dir / "superset_env/Scripts/python.exe"
        else:
            self.env_path = base_dir / "superset_env/bin/python"

    def check_env_exists(self):
        """Check if the virtual environment exists"""
        if sys.platform == "win32":
            return self.env_path.exists()
        else:
            return Path(self.env_path).exists()

    def create_env(self):
        """Create a virtual environment using specific Python"""
        env_name = str(self.env_path).find("superset_env")
        if env_name!=-1:
            env_name = str(self.env_path)[:env_name+len("superset_env")]
        else:
            return False
        
        print(f"Creating virtual environment at: {env_name}")

        try:
            # Create venv without pip first to avoid crash due to missing lib on macOS standalone builds
            venv.create(env_name, with_pip=False, clear=True)
            
            # Fix for macOS standalone python: symlink libpython
            if sys.platform == "darwin":
                base_python_lib = Path(self.python_path).parent.parent / "lib"
                venv_lib = Path(env_name) / "lib"
                
                # Find libpython dylib
                lib_files = list(base_python_lib.glob("libpython*.dylib"))
                if lib_files:
                    target_lib = lib_files[0]
                    link_name = venv_lib / target_lib.name
                    if not link_name.exists():
                        try:
                            link_name.symlink_to(target_lib)
                            print(f"Symlinked {target_lib} to {link_name}")
                        except Exception as e:
                            print(f"Failed to symlink libpython: {e}")

            # Now install pip
            print("Installing pip...")
            subprocess.run([str(self.env_path), "-m", "ensurepip"], check=True)

            print(f"Environment created at: {self.env_path}")
            return True
        except Exception as e:
            print(f"Error creating environment: {e}")
            return False
    
    def check_requirements(self):
        """Check if requirements are installed, return True if all are installed"""
        if not self.env_path:
            raise ValueError("No environment created yet!")
        
        # Get installed packages in the environment
        installed_packages = self.get_installed_packages()

        # Check which requirements are missing
        for requirement in SUPERSET_PACKAGES:
            if not self.is_package_installed(requirement, installed_packages):
                return False

        return True
    
    def get_installed_packages(self):
        """Get list of installed packages in the environment"""        
        try:
            # Ensure pip first
            result = subprocess.run([
                str(self.env_path), "-m", "ensurepip", "--default-pip"
            ], check=True, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Failed to ensure pip: {result.stderr}")
                return []
            result = subprocess.run([
                    str(self.python_path), "-m", "pip", "list", "--format=json"
            ], capture_output=True, text=True, check=True)
            return json.loads(result.stdout)
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            # Fallback: try pip freeze
            result = subprocess.run([
                str(self.python_path), "-m", "pip", "freeze"
            ], capture_output=True, text=True, check=False)
            
            packages = {}
            for line in result.stdout.split('\n'):
                if '==' in line:
                    name, version = line.split('==', 1)
                    packages[name.lower()] = version.strip()
            return packages

    def is_package_installed(self, package_name, installed_packages=None):
        """Check if a specific package with optional version is installed"""
        if installed_packages is None:
            installed_packages = self.get_installed_packages()
            if not installed_packages:
                return False

        package_name_lower, _ = package_name.lower().split("==") if "==" in package_name else (package_name.lower(), None)
        package_installed = [pkg for pkg in installed_packages if pkg['name'].lower() == package_name_lower]
        return bool(package_installed)

    def install_requirements(self):
        """Install packages in the environment"""
        # Upgrade pip, setuptools and wheel first to ensure we can install binary wheels
        try:
            subprocess.run(
                [str(self.env_path), "-m", "pip", "install", "--upgrade", "--prefer-binary", "pip", "setuptools", "wheel"],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to upgrade pip/setuptools/wheel: {e.stderr}")

        # Build install command
        # Use --prefer-binary to avoid compiling from source if possible (fixes issues on machines without build tools)
        install_cmd = [str(self.env_path), "-m", "pip", "install", "--prefer-binary"]

        for requirement in SUPERSET_PACKAGES:
            if isinstance(requirement, dict):
                # Package with version specifier
                pkg_spec = f"{requirement['name']}{requirement.get('version', '')}"
                install_cmd.append(pkg_spec)
            else:
                # Simple package name
                install_cmd.append(requirement)
        
        # Install with retries for robustness
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = subprocess.run(
                    install_cmd,
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                if result.returncode == 0:
                    print("Packages installed successfully!")
                    break
            except subprocess.CalledProcessError as e:
                if attempt < max_retries - 1:
                    print(f"Installation failed, retrying... (Attempt {attempt + 1}/{max_retries})")
                    time.sleep(2)  # Wait before retry
                else:
                    print(f"Failed to install packages after {max_retries} attempts:")
                    print(f"Error: {e.stderr}")
                    raise

        return True

    def install_packages(self, set_progress: callable, current_progress: int, step: int):
        """Install packages in the environment"""
        if not self.env_path or not Path(self.env_path).exists():
            print("No environment created yet!")
            return False

        # Ensure pip first
        result = subprocess.run([
            str(self.env_path), "-m", "ensurepip", "--default-pip"
        ], check=True, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Failed to ensure pip: {result.stderr}")
            return False
        
        # Upgrade pip, setuptools and wheel first
        try:
            subprocess.run(
                [str(self.env_path), "-m", "pip", "install", "--upgrade", "--prefer-binary", "pip", "setuptools", "wheel"],
                check=True,
                capture_output=True,
                text=True
            )
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to upgrade pip/setuptools/wheel: {e.stderr}")
        
        success = True
        for package in SUPERSET_PACKAGES:
            set_progress(label=f"Installing {package.split('==')[0]}...")
            # Use --prefer-binary to avoid compiling from source
            result = subprocess.run([
                str(self.env_path), "-m", "pip", "install", "--prefer-binary", package
            ], check=True, capture_output=True, text=True)

            if result.returncode == 0:
                set_progress(now=current_progress+step//len(SUPERSET_PACKAGES))
                current_progress += step//len(SUPERSET_PACKAGES)
                print(f"Installed: {package}")
            else:
                print(f"Failed to install {package}: {result.stderr}")
                success = False
        return success

    def get_superset_path(self):
        """Get the path to the Superset executable"""
        if sys.platform == "win32":
            return str(self.env_path).split("superset_env")[0] +  "superset_env/Scripts/superset.exe"
        else:
            final_path = str(self.env_path).split("superset_env/")[0] +  "superset_env/bin/superset"
            return final_path

    def get_superset_lib_path(self):
        """Get the path to the Superset library"""
        if sys.platform == "win32":
            return str(self.env_path).split("superset_env")[0] +  "superset_env/Lib/site-packages/superset"
        else:
            final_path = Path(str(self.env_path).split("superset_env/bin")[0] +  "superset_env/lib/" + f"python{sys.version_info.major}.{sys.version_info.minor}") / "site-packages" / "superset"
            return final_path
