import os
import subprocess
import sys
from pathlib import Path

SUPERSET_PACKAGES = [
    "apache-superset==4.1.1",
    "flask-cors==5.0.0",
    "marshmallow==3.26.1",
]

class SupersetEnvManager:
    def __init__(self, python_path):
        self.python_path = python_path
        self.env_path = None
    
    def check_env_exists(self, python_path, env_name="superset_env"):
        """Check if the virtual environment exists"""
        if sys.platform == "win32":
            env_path = Path(python_path).parent / "superset_env/Scripts/python.exe"
            return env_path.exists()
        else:
            env_path = python_path.replace("bin", "bin/superset_env/bin")
            return Path(env_path).exists()
    
    def create_env(self, env_name="superset_env"):
        """Create a virtual environment using specific Python"""
        self.env_path = Path(env_name)
        
        # Create virtual environment
        result = subprocess.run([
            self.python_path, "-m", "venv", env_name
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"Environment created at: {self.env_path}")
            return True
        else:
            print(f"Error creating environment: {result.stderr}")
            return False
    
    def install_packages(self):
        """Install packages in the environment"""
        if not self.env_path:
            print("No environment created yet!")
            return False
        
        for package in SUPERSET_PACKAGES:
            result = subprocess.run([
                str(self.python_path), "-m", "pip", "install", package
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"Installed: {package}")
            else:
                print(f"Failed to install {package}: {result.stderr}")
