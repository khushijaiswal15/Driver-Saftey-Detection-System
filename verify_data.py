import yaml
import os


yaml_files_to_verify = [

    r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/eyes close open yawn no yawn.v1i.yolov8 (2)/eyes close open yawn no yawn.v1i.yolov8/data.yaml',

    r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/seatbelt(yaml)/seatbelt(yaml)/data.yaml',

    r'/Users/pankajchandra/Downloads/driver-safety-ai/dataset/cellphone detector drivers.v2i.yolov7pytorch 2/cellphone detector drivers.v2i.yolov7pytorch/data.yaml'
]

def verify_dataset(file_path):
    """Loads and verifies a single data.yaml file."""
    print(f"\n CHECKING: {file_path}")

    if "YOUR_" in file_path:
        print(f"SKIPPING: Please update the path placeholder.")
        return

    if not os.path.exists(file_path):
        print(f"ERROR: The file was not found.")
        print(f"   Expected location: {os.path.abspath(file_path)}")
        return

    try:
        with open(file_path, 'r') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        print(f"ERROR: Could not read the YAML file. Reason: {e}")
        return

    # Basic Checks 
    print(f"   File loaded successfully.")
    print(f"   • Classes: {data.get('nc')}")
    print(f"   • Names: {data.get('names')}")


    is_valid = True
    

    if len(data.get('names', [])) == data.get('nc'):
        print("   OK: Class count matches names.")
    else:
        print("   WARNING: Mismatch between 'nc' and class names.")
        is_valid = False
    

    base_dir = os.path.dirname(file_path)
    

    train_path = os.path.join(base_dir, data.get('train', ''))
    if os.path.exists(train_path):
        print(f"   OK: Training folder found.")
    else:
        print(f"   ERROR: Training folder NOT found at '{train_path}'")
        is_valid = False
        

    val_path = os.path.join(base_dir, data.get('val', ''))
    if os.path.exists(val_path):
        print(f"   OK: Validation folder found.")
    else:
        print(f"   ERROR: Validation folder NOT found at '{val_path}'")
        is_valid = False

    if is_valid:
        print("   STATUS: DATASET READY!")
    else:
        print("   STATUS: ISSUES FOUND (See above)")
    print("-" * 40)

if __name__ == '__main__':
    print("--- Starting Verification Process ---")
    for yaml_path in yaml_files_to_verify:
        verify_dataset(yaml_path)
    print("\n--- All checks complete ---")