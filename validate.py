from ultralytics import YOLO
import os


TARGET_TO_VALIDATE = 'seatbelt'


drowsiness_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/drowsiness_training/weights/best.pt'

seatbelt_model_path   = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/seatbelt_training/weights/best.pt'

mobile_model_path     = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/mobile_training/weights/best.pt'

def main():
    if TARGET_TO_VALIDATE == 'drowsiness':
        model_path = drowsiness_model_path
    elif TARGET_TO_VALIDATE == 'seatbelt':
        model_path = seatbelt_model_path
    elif TARGET_TO_VALIDATE == 'mobile':
        model_path = mobile_model_path
    else:
        print(f"ERROR: '{TARGET_TO_VALIDATE}' is not a valid option.")
        return

    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found at '{model_path}'")
        print(f"   Have you trained the '{TARGET_TO_VALIDATE}' model yet?")
        return

    print(f"STARTING VALIDATION FOR: {TARGET_TO_VALIDATE.upper()}")
    print(f" Model: {model_path}")

    model = YOLO(model_path)

    print("Starting model validation on the 'test' dataset...")
    metrics = model.val()
    print("Validation complete!")

    print("\n--- Validation Metrics ---")
    print(f"mAP50-95 (Mean Average Precision): {metrics.box.map:.4f}")
    print(f"   mAP50 (Precision at 50% IoU): {metrics.box.map50:.4f}")
    print("--------------------------\n")
    print("mAP50-95 measures the model's accuracy. A higher number is better.")

if __name__ == '__main__':
    main()