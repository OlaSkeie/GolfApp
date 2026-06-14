"""Fine-tune YOLOv8 for golf ball detection."""

from pathlib import Path
import torch
import torchvision.ops

from ultralytics import YOLO

def _pure_nms(boxes, scores, iou_threshold):
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort(descending=True)
    keep = []
    while order.numel() > 0:
        i = order[0].item()
        keep.append(i)
        if order.numel() == 1:
            break
        xx1 = x1[order[1:]].clamp(min=x1[i].item())
        yy1 = y1[order[1:]].clamp(min=y1[i].item())
        xx2 = x2[order[1:]].clamp(max=x2[i].item())
        yy2 = y2[order[1:]].clamp(max=y2[i].item())
        inter = (xx2 - xx1).clamp(min=0) * (yy2 - yy1).clamp(min=0)
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[1:][iou <= iou_threshold]
    return torch.tensor(keep, dtype=torch.long)


torchvision.ops.nms = _pure_nms


DATA_YAML = Path("/cluster/work/projects/ec403/ec-ogskeie/combined.yaml")
OUTPUT_DIR = Path("runs")

_prev = Path("runs/detect/runs/golfball/weights/best.pt")
model = YOLO(str(_prev) if _prev.exists() else "yolov8s.pt")

model.train(
    data=str(DATA_YAML),
    epochs=50,
    imgsz=1280,
    batch=4,          # reduce to 2 if OOM
    workers=4,
    project=str(OUTPUT_DIR),
    name="golfball_v2",
    # Augmentation
    fliplr=0.5,
    scale=0.5,
    mosaic=1.0,
    degrees=0.0,      # ball is round, rotation adds no value
    mixup=0.0,
    # Optimisation
    optimizer="AdamW",
    lr0=0.001,
    cos_lr=True,
    # Logging
    amp=False,
    val=True,
    save_period=10,
)

print(f"\nBeste modell: {OUTPUT_DIR}/golfball/weights/best.pt")
