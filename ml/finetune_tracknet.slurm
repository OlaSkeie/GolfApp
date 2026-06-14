#!/bin/bash
#SBATCH --job-name=tracknet-golf
#SBATCH --account=ec403
#SBATCH --partition=accel
#SBATCH --gres=gpu:rtx30:1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --time=08:00:00
#SBATCH --output=slurm/logs/tracknet_%j.log

source ~/.bashrc
set -o errexit
set -o nounset

module purge
module load PyTorch/2.1.2-foss-2023a-CUDA-12.1.1

pip install --quiet tqdm parse tensorboard pycocotools

cd /fp/homes01/u01/ec-ogskeie/ml/TrackNetV3

# ── Steg 1: konverter data (sjekk at 0-indekserte PNG-filer finnes) ──────
FIRST_PNG=$(find data/train -name '0.png' 2>/dev/null | head -1)
if [ -z "$FIRST_PNG" ]; then
    echo "Konverterer YOLO-data (PNG-format)..."
    rm -rf data
    cd ..
    python prepare_tracknet_data.py
    cd TrackNetV3
fi

# ── Steg 2: fine-tune TrackNet fra pretrained badminton-vekter ────────────
# Kopier pretrained checkpoint til save_dir så resume_training finner den
mkdir -p golf_finetune
python3 - <<'EOF'
import torch
ck = torch.load('/fp/homes01/u01/ec-ogskeie/ml/TrackNet_best.pt', map_location='cpu', weights_only=False)
pd = ck['param_dict']
pd.setdefault('mask_ratio', 0.3)
pd.setdefault('frame_alpha', -1)
pd.setdefault('alpha', -1)
pd.setdefault('lr_scheduler', '')
pd.setdefault('verbose', False)
pd.setdefault('debug', False)
pd['save_dir'] = 'golf_finetune'
ck['epoch'] = 0
ck['max_val_acc'] = 0.0
pd['epochs'] = 30
pd['learning_rate'] = 0.0005
pd['resume_training'] = True
torch.save(ck, 'golf_finetune/TrackNet_cur.pt')
print('Checkpoint patchet OK')
EOF

python train.py \
    --model_name    TrackNet \
    --seq_len       8 \
    --bg_mode       concat \
    --epochs        30 \
    --batch_size    8 \
    --learning_rate 0.0005 \
    --lr_scheduler  StepLR \
    --frame_alpha   0.5 \
    --save_dir      golf_finetune \
    --resume_training

# ── Steg 3: fine-tune InpaintNet (valgfritt, kan hoppes over) ────────────
# python train.py \
#     --model_name  InpaintNet \
#     --seq_len     8 \
#     --epochs      15 \
#     --batch_size  8 \
#     --mask_ratio  0.3 \
#     --save_dir    golf_inpaint_finetune
