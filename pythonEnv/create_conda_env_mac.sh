#!/bin/bash
# Check if .zshrc exists, if not create it
echo "Checking if .zshrc exists..."
if [ ! -f ~/.zshrc ]; then
    echo "Creating .zshrc..."
    touch ~/.zshrc || {
        echo "An error occurred while creating .zshrc."
        exit 1
    }
fi
source ~/.zshrc
eval "$(conda shell.bash hook)"
echo "Checking if Conda is installed..."
command -v conda >/dev/null 2>&1
if [ $? -ne 0 ]; then
    # Conda is not installed, install Miniconda
    echo "Conda is not installed."

    # Check CPU architecture and download the appropriate Miniconda installer
    echo "Checking CPU architecture..."
    if [ $(uname -m) = "arm64" ]; then
        # ARM architecture
        echo "ARM architecture detected."
        # Download Miniconda installer with curl
        echo "Downloading Miniconda installer..."
        curl -o miniconda-installer.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh || {
            echo "An error occurred while downloading the Miniconda installer."
            exit 1
        }
    else
        # Intel architecture
        echo "Intel architecture detected."
        # Download Miniconda installer with curl
        echo "Downloading Miniconda installer..."
        curl -o miniconda-installer.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh || {
            echo "An error occurred while downloading the Miniconda installer."
            exit 1
        }
    fi

    # Install Miniconda
    echo "Installing Miniconda..."
    bash miniconda-installer.sh -u -b -p $HOME/miniconda3 || {
        echo "An error occurred while installing Miniconda."
        exit 1
    }

    # Clean up the installer
    echo "Cleaning up the installer..."
    rm miniconda-installer.sh || {
        echo "An error occurred while cleaning up the installer."
        exit 1
    }

    # Activate the base environment
    echo "Activating the base environment..."
    source $HOME/miniconda3/etc/profile.d/conda.sh || {
        echo "An error occurred while activating the base environment."
        exit 1
    }

    # Initialize Conda
    echo "Initializing Conda..."
    conda init bash

else
    # Conda is already installed, create a new environment and install packages
    # Replace <ENV_NAME> with the desired environment name (e.g., med_conda_env)
    # Replace <PYTHON_VERSION> with the desired Python version (e.g., 3.9)
    # Replace <requirements_FILE> with the path to the requirements.txt file
    echo "Conda is already installed."

    # Check if anaconda or miniconda is installed with homebrew
    if command -v brew &>/dev/null; then
        echo "Homebrew is already installed."
        if brew list --formula | grep -q 'anaconda'; then
            echo "Anaconda is already installed with homebrew."
            # Update Anaconda
            echo "Updating Anaconda..."
            brew upgrade anaconda || {
                echo "An error occurred while updating Anaconda."
                exit 1
            }
        fi
        # Check if miniconda is installed with homebrew
        if brew list --formula | grep -q 'miniconda'; then
            echo "Miniconda is already installed with homebrew."
            # Update Miniconda
            echo "Updating Miniconda..."
            brew upgrade miniconda || {
                echo "An error occurred while updating Miniconda."
                exit 1
            }
        fi
        # Check if miniforge is installed with homebrew
        if brew list --formula | grep -q 'miniforge'; then
            echo "Miniforge is already installed with homebrew."
            # Update Miniforge
            echo "Updating Miniforge..."
            brew upgrade miniforge || {
                echo "An error occurred while updating Miniforge."
                exit 1
            }
        fi
    fi

    # Update Conda
    echo "Updating Conda..."
    conda update -n base -c defaults conda -y || {
        echo "An error occurred while updating Conda."
        exit 1
    }

    # Activate the base environment
    echo "Activating the base environment..."
    conda activate base || {
        echo "An error occurred while activating the base environment."
        exit 1
    }

fi

# Install xcode command line tools
echo "Installing xcode command line tools..."
xcode-select --install || {
    echo "An error occurred while installing xcode command line tools."
}

CONDA_TYPE=$(conda info | grep -i 'package cache' | awk -F'/' '{print $(NF-1)}')
echo "Conda type: $CONDA_TYPE"

# Check if the environment exists
if conda env list | grep -q 'med_conda_env '; then
    echo "The med_conda_env environment already exists."
else
    # Create a new environment
    echo "Creating a new environment..."
    conda create --name med_conda_env python=3.9 -y || {
        echo "An error occurred while creating the new environment."
        exit 1
    }
fi

# Activate the new environment
echo "Activating the environment..."
conda activate med_conda_env || {
    echo "An error occurred while activating the new environment."
    exit 1
}

# Adding conda-forge channel
echo "Adding conda-forge channel..."
conda config --env --add channels conda-forge || {
    echo "An error occurred while adding conda-forge channel."
    exit 1
}

# Install packages
echo "Installing packages..."

# Install PyCaret with conda
echo "Installing PyCaret with conda..."
conda install pycaret -y || {
    echo "An error occurred while installing PyCaret with conda."
    exit 1
}

# Install packages with pip
echo "Installing packages with pip..."
pip install -r requirements_mac.txt || {
    echo "An error occurred while installing packages with pip."
    exit 1
}


# Check if homebrew is installed
if command -v brew &>/dev/null; then
    echo "Homebrew is already installed."
else
    echo "Homebrew is not installed."
    # Install homebrew
    echo "Installing homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
        echo "An error occurred while installing homebrew."
        exit 1
    }
    # Add homebrew to PATH in .zprofile and .bash_profile
    echo "Adding homebrew to PATH..."
    if grep -q "eval \"\$\(\/opt\/homebrew\/bin\/brew shellenv\)\"" ~/.zshrc; then
        # Replace the existing homebrew PATH in ~/.zshrc with the new one
        sed -i '' "s|eval \"\$\(\/opt\/homebrew\/bin\/brew shellenv\)|eval \"\$\(\/opt\/homebrew\/bin\/brew shellenv\)|" ~/.zshrc || {
            echo "An error occurred while replacing the homebrew PATH in ~/.zshrc."
            exit 1
        }
    else
        echo "eval \"\$\(\/opt\/homebrew\/bin\/brew shellenv\)\"" >>~/.zshrc || {
            echo "An error occurred while adding homebrew to PATH."
            exit 1
        }
    fi
    eval "$(/opt/homebrew/bin/brew shellenv)" || {
        echo "An error occurred while adding homebrew to PATH."
        exit 1
    }
fi

# Source .zshrc to update the PATH
echo "Sourcing .zshrc..."
source ~/.zshrc || {
    echo "An error occurred while sourcing .zshrc."
    exit 1
}

# Install libomp
echo "Installing libomp..."
brew install libomp || {
    echo "An error occurred while installing libomp."
    exit 1
}

# Install opencv with homebrew then link it to the environment
echo "Installing opencv with homebrew..."
brew install opencv || {
    echo "An error occurred while installing opencv with homebrew."
    exit 1
}

# Deactivate the new environment
echo "Deactivating the new environment..."
conda deactivate || {
    echo "An error occurred while deactivating the new environment."
    exit 1
}

# Export virtual environment path
echo "Exporting virtual environment path..."
if grep -q "export MED_ENV=" ~/.zshrc; then
    # Replace the existing MED_ENV environment variable in ~/.zshrc with the new one
    sed -i '' "s|export MED_ENV=.*|export MED_ENV=$HOME/opt/$CONDA_TYPE/envs/med_conda_env/bin/python|" ~/.zshrc || {
        echo "An error occurred while replacing the virtual environment path in ~/.zshrc."
        exit 1
    }
else
    echo "export MED_ENV=$HOME/opt/$CONDA_TYPE/envs/med_conda_env/bin/python" >>~/.zshrc || {
        echo "An error occurred while exporting the virtual environment path."
        exit 1
    }
fi
source ~/.zshrc

echo "Done."