import os
import subprocess
import sys
from pathlib import Path

sys.path.append(str(Path(os.path.dirname(os.path.abspath(__file__))).parent.parent))

from med_libs.GoExecutionScript import GoExecutionScript, parse_arguments
from med_libs.server_utils import go_print
from modules.superset.SupersetEnvManager import SupersetEnvManager

json_params_dict, id_ = parse_arguments()
go_print("running script.py:" + id_)


class GoExecScriptPredict(GoExecutionScript):
    """
        This class is used to execute a process from Go

        Args:
            json_params: The input json params
            _id: The id of the page that made the request if any
    """

    def __init__(self, json_params: dict, _id: str = None):
        super().__init__(json_params, _id)
        self.results = {"data": "nothing to return"}

    def _custom_process(self, json_config: dict) -> dict:
        """
            This function predicts from a model, a dataset, and a new dataset
        """
        # Map settings
        port = json_config["port"]
        python_path = json_config["pythonPath"]

        # Set up Superset
        result = self.setup_superset(port, python_path)

        return result

    def run_command(self, command, env=None, capture_output=True, timeout=None):
        """Run a shell command and print its output."""
        try:
            result = subprocess.run(command, shell=True, env=env, check=True, text=True, capture_output=capture_output, timeout=timeout)
            print(f"error {result.stderr}")
            print(f"output {result.stdout}")
            print(result.stdout)
            return {}
        except subprocess.CalledProcessError as e:
            print(f"Error while running command: {command}")
            print(e.stderr)
            return {"error": f"Error while running command: {command}. Full error log:" + e.stderr}
            

    def setup_superset(self, port, python_path):
        """
        Set up Superset with the provided settings.
        
        Args:
            scripts_path (path): The path to the Python scripts directory.
            port (path): The port on which to run Superset.
            
        Returns:
            A dictionary containing the error message, if any.
        """
        # Init
        progress = 0
        step = 8

        # Check if the virtual environment exists
        self.set_progress(now=progress, label="Checking the Superset virtual environment...")
        manager = SupersetEnvManager(python_path)
        if not manager.check_env_exists(python_path):
            print("Creating Superset virtual environment...")
            self.set_progress(now=self._progress["now"]+step, label="Creating Superset virtual environment...")
            if not manager.create_env():
                return {"error": "Error while creating the Superset virtual environment."}
            print("Installing required packages...")
            self.set_progress(label="Installing required packages...")
            if not manager.install_packages(self.set_progress, self._progress["now"], step):
                return {"error": "Error while installing the required packages."}
        elif not manager.check_requirements():
            self.set_progress(now=self._progress["now"]+step, label="Installing required packages...")
            manager.install_requirements()
            self.set_progress(now=self._progress["now"]+step, label="Installing required packages...")
        else:
            step = 10
        
        # Set paths for Python and Superset
        superset_path = manager.get_superset_path()
        superset_lib_path = manager.get_superset_lib_path()
        if not superset_path or not superset_lib_path:
            return {"error": "Error while finding the Superset installation."}

        # Generate a private key
        print("Generating a private key...")
        self.set_progress(label="Checking the private key...")
        private_key = subprocess.check_output("openssl rand -base64 42", shell=True, text=True).strip()
        if private_key is None:
            print("Error while generating a private key.")
            return {"error": "Error while generating a private key."}
        print(f"Private key generated: {private_key[:10]}...[hidden for security]")

        # update the config file to allow embedding of superset
        self.set_progress(now=self._progress["now"]+step, label="Checking the Superset config file...")
        superset_config_file = Path(superset_lib_path) / "config.py"

        # Update the config file
        with open(superset_config_file, "r") as file:
            lines = file.readlines()
        
        # Modify the target variables
        updated_lines = []
        for line in lines:
            if line.startswith("SECRET_KEY = os."):
                updated_lines.append(f'SECRET_KEY = "{private_key}"\n')
            elif line.startswith("OVERRIDE_HTTP_HEADERS: dict[str, Any]"):
                updated_lines.append('OVERRIDE_HTTP_HEADERS: dict[str, Any] = {"X-Frame-Options": "ALLOWALL"}\n')
            elif line.startswith("TALISMAN_ENABLED ="):
                updated_lines.append("TALISMAN_ENABLED = False\n")
            elif line.startswith("PREVENT_UNSAFE_DB_CONNECTIONS = "):
                updated_lines.append("PREVENT_UNSAFE_DB_CONNECTIONS = False\n")
            elif line.startswith('    "EMBEDDED_SUPERSET": False,'):
                updated_lines.append('    "EMBEDDED_SUPERSET": True,\n')
            elif line.startswith('ENABLE_CORS = False'):
                updated_lines.append('ENABLE_CORS = True\n')
            elif line.startswith('CORS_OPTIONS: dict[Any, Any] = \{\}'):
                updated_lines.append('CORS_OPTIONS = { "supports_credentials": True, "allow_headers": ["*"], "resources":["*"], "origins": ["*"] }\n')
            elif line.startswith('WTF_CSRF_ENABLED = True'):
                updated_lines.append('WTF_CSRF_ENABLED = False\n')
            elif line.startswith('GUEST_ROLE_NAME = "Public"'):
                updated_lines.append('GUEST_ROLE_NAME = "Gamma"\n')
            else:
                updated_lines.append(line)
        
        # Write the changes back to the file
        with open(superset_config_file, "w") as file:
            file.writelines(updated_lines)

        self.set_progress(now=self._progress["now"]+step, label="Checking the Superset environment variables...")

        # Prepare environment variables
        env = os.environ.copy()
        env["FLASK_APP"] = "superset"
        
        # Initialize the database
        print("Initializing the Superset database...")
        self.set_progress(now=self._progress["now"]+step, label="Initializing the Superset database...")
        result = self.run_command(f"{superset_path} db upgrade", env)
        if "error" in result:
            return result

        # Create an admin user
        print("Creating a Superset admin user...")
        self.set_progress(now=self._progress["now"]+step, label="Creating a Superset admin user...")
        admin_user = {
            "username": "admin",
            "firstname": "admin",
            "lastname": "admin",
            "email": "admin@superset.com",
            "password": "admin",
        }
        result = self.run_command(
            f"{superset_path} fab create-admin "
            f"--username {admin_user['username']} "
            f"--firstname {admin_user['firstname']} "
            f"--lastname {admin_user['lastname']} "
            f"--email {admin_user['email']} "
            f"--password {admin_user['password']}",
            env,
        )
        if "error" in result:
            return result

        # Initialize Superset
        print("Initializing Superset...")
        self.set_progress(now=self._progress["now"]+step, label="Initializing Superset...")
        result = self.run_command(f"{superset_path} init", env)
        if "error" in result:
            return result

        # Load examples (optional)
        print("Loading example data...")
        self.set_progress(now=self._progress["now"]+step, label="Loading default example data...")
        result = self.run_command(f"{superset_path} load_examples", env)
        if "error" in result:
            return result

        # Check if port is available
        print(f"Checking if port {port} is available...")
        self.set_progress(now=self._progress["now"]+step, label="Checking if port is available...")
        import socket

        in_use = True
        while in_use:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("localhost", port)) == 0:
                    port += 1
                    self.set_progress(label="Switching to port " + str(port))
                else:
                    in_use = False
        
        # Launch Superset
        print(f"Launching Superset on port {port}...")
        self.set_progress(now=self._progress["now"]+step, label="Launching Superset...")
        try:
            subprocess.Popen(f"{superset_path} run -p {port}", shell=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError as e:
            print(f"Error while running command: {f'{superset_path} run -p {port}'}")
            print(e.stderr)
            return {"error": e.stderr}
        print("Superset is running...")
        self.set_progress(now=100, label="Done")

        return {"port": port}

script = GoExecScriptPredict(json_params_dict, id_)
script.start()
