import cv2
from ultralytics import YOLO 
import os
import time
import threading
import subprocess 
import numpy as np 

drowsiness_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/drowsiness_training/weights/best.pt'

import cv2
from ultralytics import YOLO 
import os
import time
import threading
import subprocess 
from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


drowsiness_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/drowsiness_training/weights/best.pt'
seatbelt_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/seatbelt_training/weights/best.pt'
mobile_model_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/runs/detect/mobile_training/weights/best.pt'
sound_path = r'/Users/pankajchandra/Downloads/driver-safety-ai/mixkit-electric-fence-alert-2969.wav'


EYES_CLOSED_SECONDS_THRESHOLD = 2.0
YAWN_EVENT_THRESHOLD = 3
YAWN_TIME_WINDOW_SECONDS = 30
YAWN_COOLDOWN_SECONDS = 3.0
SEATBELT_ALERT_COOLDOWN = 20.0
MOBILE_CONFIDENCE_THRESHOLD = 0.5 
ALERT_DISPLAY_DURATION = 3.0 
MOBILE_ALERT_COOLDOWN = 5.0 


eyes_closed_counter = 0
yawn_event_counter = 0
yawn_window_start_time = None
last_yawn_time = 0
last_seatbelt_alert_time = 0
seatbelt_on = False
mobile_detected = False
last_mobile_alert_time = 0


drowsy_alert_start_time = 0
seatbelt_alert_start_time = 0
mobile_alert_start_time = 0
current_drowsy_message = ""


current_status = {
    "drowsy": False,
    "seatbelt": True, 
    "mobile": False,
    "timestamp": 0
}


def play_alert_sound_macos(file_path):
    """Plays a sound file using the native 'afplay' command on macOS."""
    if os.path.exists(file_path):
        try:
            subprocess.run(["afplay", file_path])
        except Exception as e:
            print(f"Error playing sound: {e}")


drowsiness_model = None
seatbelt_model = None
mobile_model = None
cap = None
eyes_closed_frame_threshold = 0

def load_models():

    global drowsiness_model, seatbelt_model, mobile_model, cap, eyes_closed_frame_threshold
    
    print("⏳ Loading models... this may take a moment.")
    

    if os.path.exists(drowsiness_model_path):
        drowsiness_model = YOLO(drowsiness_model_path)
    else:
        print(f" ERROR: Drowsiness model missing at {drowsiness_model_path}")


    if os.path.exists(seatbelt_model_path):
        seatbelt_model = YOLO(seatbelt_model_path)
    else:
        fallback_seatbelt = r'/Users/pankajchandra/Downloads/driver-safety-ai/seatbelt_model.pt'
        if os.path.exists(fallback_seatbelt):
             print(f"    Found fallback model at {fallback_seatbelt}")
             seatbelt_model = YOLO(fallback_seatbelt)
        else:
             print(f" ERROR: Seatbelt model missing at {seatbelt_model_path} and no fallback found.")


    if os.path.exists(mobile_model_path):
        mobile_model = YOLO(mobile_model_path)
    else:
        fallback_mobile = r'/Users/pankajchandra/Downloads/driver-safety-ai/mobile_model.pt'
        if os.path.exists(fallback_mobile):
             print(f"    Found fallback model at {fallback_mobile}")
             mobile_model = YOLO(fallback_mobile)
        else:
             print(f" ERROR: Mobile model missing at {mobile_model_path} and no fallback found.")


    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print(" ERROR: Could not open webcam.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0: fps = 30
    eyes_closed_frame_threshold = int(EYES_CLOSED_SECONDS_THRESHOLD * fps)
    
    print(f" System Active at {fps:.2f} FPS.")
    print("Detecting: Drowsiness, Seatbelts, and Mobile Phones.")
    print("Press 'q' to quit.")

def generate_frames():
    global eyes_closed_counter, yawn_event_counter, yawn_window_start_time, last_yawn_time
    global seatbelt_on, mobile_detected, last_seatbelt_alert_time, last_mobile_alert_time, cap
    global drowsy_alert_start_time, seatbelt_alert_start_time, mobile_alert_start_time, current_drowsy_message
    global current_status
    
    while True:
        if cap is None or not cap.isOpened():
            blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(blank_frame, "Webcam not available", (100, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            ret, buffer = cv2.imencode('.jpg', blank_frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(1)
            continue
            
        success, frame = cap.read()
        if not success:
            print("⚠️ Warning: Failed to read frame from webcam. Retrying...")
            try:
                cap.release()
                cap = cv2.VideoCapture(0)
            except:
                pass
            

            blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(blank_frame, "Camera Disconnected - Retrying...", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            ret, buffer = cv2.imencode('.jpg', blank_frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.5)
            continue

        if not drowsiness_model or not seatbelt_model or not mobile_model:
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            continue

        drowsiness_results = drowsiness_model(frame, verbose=False)
        annotated_frame = drowsiness_results[0].plot()

        seatbelt_results = seatbelt_model(frame, verbose=False)
        annotated_frame = seatbelt_results[0].plot(img=annotated_frame)

        mobile_results = mobile_model(frame, verbose=False, conf=MOBILE_CONFIDENCE_THRESHOLD)
        annotated_frame = mobile_results[0].plot(img=annotated_frame)

        play_sound = False 
        eyes_are_closed_in_frame = False
        seatbelt_on = False 
        mobile_detected = False
        current_time = time.time()

        if yawn_window_start_time and (current_time - yawn_window_start_time > YAWN_TIME_WINDOW_SECONDS):
            yawn_event_counter = 0
            yawn_window_start_time = None

        for detection in drowsiness_results[0].boxes.data.tolist():
            class_name = drowsiness_model.names[int(detection[5])]
            if class_name in ['Eyeclosed', 'close', 'Drowsy eye']:
                eyes_are_closed_in_frame = True
                eyes_closed_counter += 1
                if eyes_closed_counter > eyes_closed_frame_threshold:
                    current_drowsy_message = "ALERT: DROWSY (Eyes Closed)"
                    drowsy_alert_start_time = current_time
                    play_sound = True
                    eyes_closed_counter = 0

            if class_name == 'Yawn':
                if current_time - last_yawn_time > YAWN_COOLDOWN_SECONDS:
                    last_yawn_time = current_time
                    yawn_event_counter += 1
                    if yawn_event_counter == 1: yawn_window_start_time = current_time
                    if yawn_event_counter >= YAWN_EVENT_THRESHOLD:
                        current_drowsy_message = "ALERT: DROWSY (Yawning)"
                        drowsy_alert_start_time = current_time
                        play_sound = True
                        yawn_event_counter = 0
                        yawn_window_start_time = None

        if not eyes_are_closed_in_frame:
            eyes_closed_counter = 0

        for detection in seatbelt_results[0].boxes.data.tolist():
            class_name = seatbelt_model.names[int(detection[5])]
            if class_name in ['seatbelt', 'belt']: 
                seatbelt_on = True
        
        if not seatbelt_on:
            if current_time - last_seatbelt_alert_time > SEATBELT_ALERT_COOLDOWN:
                play_sound = True
                last_seatbelt_alert_time = current_time
                seatbelt_alert_start_time = current_time 
            
        for detection in mobile_results[0].boxes.data.tolist():
            class_name = mobile_model.names[int(detection[5])]
            if class_name in ['mobile_phone', 'cell_phone', 'phone', 'texting', 'usage']: 
                mobile_detected = True
                break
        
        if mobile_detected:
            if current_time - last_mobile_alert_time > MOBILE_ALERT_COOLDOWN:
                mobile_alert_start_time = current_time
                play_sound = True
                last_mobile_alert_time = current_time

        if play_sound:
             threading.Thread(target=play_alert_sound_macos, args=(sound_path,)).start()


        current_status = {
            "drowsy": (current_time - drowsy_alert_start_time < ALERT_DISPLAY_DURATION),
            "seatbelt": seatbelt_on,
            "mobile": (current_time - mobile_alert_start_time < ALERT_DISPLAY_DURATION),
            "timestamp": current_time
        }


        if current_time - drowsy_alert_start_time < ALERT_DISPLAY_DURATION:
            cv2.rectangle(annotated_frame, (50, 20), (600, 70), (0, 0, 255), -1)
            cv2.putText(annotated_frame, current_drowsy_message, (60, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 3)
        
        if current_time - seatbelt_alert_start_time < ALERT_DISPLAY_DURATION:
            cv2.rectangle(annotated_frame, (50, 90), (450, 140), (0, 165, 255), -1) 
            cv2.putText(annotated_frame, "ALERT: NO SEATBELT", (60, 130), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 3)
            
        if current_time - mobile_alert_start_time < ALERT_DISPLAY_DURATION:
            cv2.rectangle(annotated_frame, (50, 160), (500, 210), (255, 0, 255), -1) 
            cv2.putText(annotated_frame, "ALERT: PHONE DETECTED", (60, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 3)

        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/status')
def get_status():
    global current_status
    return jsonify(current_status)


if __name__ == '__main__':
    load_models()
    app.run(host='0.0.0.0', port=5001, debug=False)
