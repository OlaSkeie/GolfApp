#!/bin/bash
#SBATCH --account=ec403
#SBATCH --time=24:00:00
#SBATCH --nodes=1
#SBATCH --partition=accel
#SBATCH --gres=gpu:a100:1
#SBATCH --mem=16G
#SBATCH --cpus-per-task=4
#SBATCH --output=/fp/homes01/u01/ec-ogskeie/ml/logs/train_golfball_%j.out

source ~/.bashrc
set -o errexit
set -o nounset

module purge
module load PyTorch-bundle/2.1.2-foss-2023a-CUDA-12.1.1

cd /fp/homes01/u01/ec-ogskeie/ml

python3 train_golfball.py
