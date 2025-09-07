from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os, base64, json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Google Drive API setup
SCOPES = ['https://www.googleapis.com/auth/drive.file']
# REPLACE THIS WITH YOUR ACTUAL FOLDER ID FROM GOOGLE DRIVE
DRIVE_FOLDER_ID = '1JhjzkvHMv46qxLyqNJI15Ul5sW0dpuIk'

def get_drive_service():
    try:
        # Get the service account info from environment variable
        service_account_info = os.environ.get('GOOGLE_DRIVE_CREDENTIALS')
        if not service_account_info:
            raise ValueError("Google Drive credentials not found in environment variables")
        
        # Parse the JSON string from environment variable
        credentials_dict = json.loads(service_account_info)
        
        # Create credentials from service account info
        creds = service_account.Credentials.from_service_account_info(
            credentials_dict, scopes=SCOPES)
        
        # Build the Drive service
        service = build('drive', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"Error creating Drive service: {e}")
        return None

def upload_to_drive(file_data, filename):
    try:
        service = get_drive_service()
        if not service:
            return None
        
        # Upload the file directly to the predefined folder
        file_metadata = {
            'name': filename,
            'parents': [DRIVE_FOLDER_ID]  # Use the global folder ID
        }
        
        media = MediaInMemoryUpload(file_data, mimetype='image/png', resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        
        return file.get('id')
    except Exception as e:
        print(f"Error uploading to Google Drive: {e}")
        return None

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/save", methods=["POST"])
def save():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data received"}), 400

    student_id = data.get("id", "unknown")
    name = data.get("name", "unknown")
    last_name = data.get("lastName", "attendance")
    qr_data = data.get("qr", "")
    photo_data = data.get("photo", "")

    saved = []

    # Save QR to Google Drive
    if qr_data.startswith("data:image"):
        qr_bytes = base64.b64decode(qr_data.split(",")[1])
        qr_filename = f"{last_name}_{student_id}_qr.png"
        qr_file_id = upload_to_drive(qr_bytes, qr_filename)
        if qr_file_id:
            saved.append({"name": qr_filename, "drive_id": qr_file_id})
        else:
            return jsonify({"error": "Failed to save QR code to Google Drive"}), 500

    # Save Photo to Google Drive
    if photo_data.startswith("data:image"):
        photo_bytes = base64.b64decode(photo_data.split(",")[1])
        photo_filename = f"{last_name}_{student_id}_photo.png"
        photo_file_id = upload_to_drive(photo_bytes, photo_filename)
        if photo_file_id:
            saved.append({"name": photo_filename, "drive_id": photo_file_id})
        else:
            return jsonify({"error": "Failed to save photo to Google Drive"}), 500

    if saved:
        return jsonify({"message": "Student files saved to Google Drive", "saved": saved})
    else:
        return jsonify({"error": "No files were saved"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
