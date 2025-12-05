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
        print("json_config", json_config)

        # Map settings
        python_path = json_config["pythonPath"]
        username = json_config["username"]
        firstname = json_config["firstname"]
        lastname = json_config["lastname"]
        email = json_config["email"]
        password = json_config["password"]

        # Set up Superset
        output = self.create_user(python_path, username, firstname, lastname, email, password)

        return output

    def run_command(self, command, env=None, capture_output=True, timeout=None):
        """Run a shell command and print its output."""
        try:
            result = subprocess.run(command, shell=True, env=env, check=True, text=True, capture_output=capture_output, timeout=timeout)
            print(result.stdout)
            if "Error" in result.stdout:
                return {"error": result.stdout}
        except subprocess.CalledProcessError as e:
            print(f"Error while running command: {command}")
            print(e.stderr)
            raise

        return {}

    def create_user(self, python_path: str, username: str, firstname: str, lastname: str, email: str, password: str):
        """
        Creates a new Superset user.

        Args:
            python_path: The path to the Python installation.
            username: The username of the new user.
            firstname: The first name of the new user.
            lastname: The last name of the new user.
            email: The email of the new user.
            password: The password of the new user.
        
        Returns:
            None
        """
        # Prepare environment variables
        env = os.environ.copy()
        manager = SupersetEnvManager(python_path)
        path_superset = manager.get_superset_path()
        env["FLASK_APP"] = "superset"

        # Create an admin user
        print("Creating a Superset admin user...")
        admin_user = {
            "username": username,
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "password": password,
        }
        output = self.run_command(
            f"{path_superset} fab create-admin "
            f"--username {admin_user['username']} "
            f"--firstname {admin_user['firstname']} "
            f"--lastname {admin_user['lastname']} "
            f"--email {admin_user['email']} "
            f"--password {admin_user['password']}",
            env,
        )

        return output

script = GoExecScriptPredict(json_params_dict, id_)
script.start()
