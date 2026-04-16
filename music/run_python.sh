#!/bin/bash
# Wrapper script to run Python scripts in the 'music' conda environment
# Usage: ./run_python.sh script.py [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONDA_BASE="/Users/malowasvetlana/anaconda3"
CONDA_ENV="music"
PYTHON_PATH="${CONDA_BASE}/envs/${CONDA_ENV}/bin/python3"

# Check if conda env python exists
if [ ! -f "$PYTHON_PATH" ]; then
    echo "⚠️  Conda env 'music' Python not found at: $PYTHON_PATH"
    echo "Trying system python3..."
    PYTHON_PATH="python3"
fi

# Activate conda env
source "${CONDA_BASE}/etc/profile.d/conda.sh" 2>/dev/null || true
conda activate "$CONDA_ENV" 2>/dev/null || true

# Run the script directly with conda env python
if [ $# -gt 0 ]; then
    SCRIPT="$1"
    shift
    "${CONDA_BASE}/envs/${CONDA_ENV}/bin/python3" "${SCRIPT_DIR}/${SCRIPT}" "$@"
else
    echo "Usage: ./run_python.sh <script.py> [args...]"
    exit 1
fi
