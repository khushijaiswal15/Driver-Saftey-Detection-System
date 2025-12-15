from ultralytics import YOLO
import os

drowsiness_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/drowsiness_training/weights/best.pt'
seatbelt_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/seatbelt_training/weights/best.pt'
mobile_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/mobile_training/weights/best.pt'

def check_classes(name, path):
    if os.path.exists(path):
        model = YOLO(path)
        print(f"--- {name} Classes ---")
        print(model.names)
    else:
        print(f"--- {name} Model NOT FOUND at {path} ---")

check_classes("Drowsiness", drowsiness_model_path)
check_classes("Seatbelt", seatbelt_model_path)
check_classes("Mobile", mobile_model_path)
