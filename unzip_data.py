import zipfile
import os


zip_files_to_extract = [

    r'/Users/pankajchandra/Downloads/driver-safety-ai/eyes close open yawn no yawn.v1i.yolov8 (2).zip',

    r'/Users/pankajchandra/Downloads/driver-safety-ai/seatbelt(yaml).zip',

    r'/Users/pankajchandra/Downloads/driver-safety-ai/cellphone detector drivers.v2i.yolov7pytorch 2.zip'
]

destination_folder = './dataset' 

def unzip_file(source_path, dest_path):
    """Extracts a ZIP file to a destination folder."""
    if "YOUR_" in source_path or not source_path:
        print(f"SKIPPING: Please update the path for '{os.path.basename(source_path)}'")
        return

    if not os.path.exists(source_path):
        print(f"ERROR: The source file was not found at '{source_path}'")
        return

    if not os.path.exists(dest_path):
        os.makedirs(dest_path)
        print(f"Created destination directory: '{dest_path}'")

    try:
        with zipfile.ZipFile(source_path, 'r') as zip_ref:
            print(f"Processing '{os.path.basename(source_path)}'...")
            
     
            folder_name = os.path.splitext(os.path.basename(source_path))[0]
            final_path = os.path.join(dest_path, folder_name)
            
            if not os.path.exists(final_path):
                os.makedirs(final_path)
            
            print(f"   ↳ Extracting to: {final_path}")
            zip_ref.extractall(final_path)
            print(f"Success!")
            
    except zipfile.BadZipFile:
        print(f"ERROR: '{source_path}' is not a valid ZIP file.")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred: {e}")

if __name__ == '__main__':
    print("--- Starting Extraction Process ---")
    for zip_path in zip_files_to_extract:
        unzip_file(zip_path, destination_folder)
    print("\n--- All operations complete ---")