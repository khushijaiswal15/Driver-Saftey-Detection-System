from ultralytics import YOLO
import os

TARGET_TO_TRAIN = 'mobile' 

drowsiness_yaml = r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/eyes close open yawn no yawn.v1i.yolov8 (2)/eyes close open yawn no yawn.v1i.yolov8/data.yaml'

seatbelt_yaml   = r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/seatbelt(yaml)/seatbelt(yaml)/data.yaml'

mobile_yaml     = r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/cellphone detector drivers.v2i.yolov7pytorch 2/cellphone detector drivers.v2i.yolov7pytorch/data.yaml'

def main():
    if TARGET_TO_TRAIN == 'drowsiness':
        yaml_file_path = drowsiness_yaml
        project_name = 'drowsiness_training'
    elif TARGET_TO_TRAIN == 'seatbelt':
        yaml_file_path = seatbelt_yaml
        project_name = 'seatbelt_training'
    elif TARGET_TO_TRAIN == 'mobile':
        yaml_file_path = mobile_yaml
        project_name = 'mobile_training'
    else:
        print(f" ERROR: '{TARGET_TO_TRAIN}' is not a valid option.")
        print("Please set TARGET_TO_TRAIN to 'drowsiness', 'seatbelt', or 'mobile'.")
        return


    if not os.path.exists(yaml_file_path):
        print(f"ERROR: Cannot find the YAML file at '{yaml_file_path}'")
        print("Please check the path variable in the script.")
        return

    print(f"🚀 STARTING TRAINING FOR: {TARGET_TO_TRAIN.upper()}")
    print(f"📂 Using Dataset: {yaml_file_path}")


    model = YOLO('yolov8n.pt')

    print("Starting model training...")
    

    results = model.train(
        data=yaml_file_path,
        epochs=15,        
        imgsz=640,        
        batch=8,
        name=project_name   
    )
    
    print("Training finished!")
    print(f"💾 Model saved to: '{results.save_dir}/weights/best.pt'")

if __name__ == '__main__':
    main()