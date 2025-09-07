from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os, base64, json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# ===== GOOGLE DRIVE SETUP =====
# Replace this with your actual folder ID from Step 2
FOLDER_ID = "1Dfb0-pe97NWBr6i7F4giBMsshHpO0m7p"

def get_drive_service():
    """Connect to Google Drive"""
    try:
        # Get credentials from environment variable
        credentials_json = os.environ.get('GOOGLE_DRIVE_CREDENTIALS')
        if not credentials_json:
            return None
            
        # Convert JSON string to dictionary
        credentials_info = json.loads(credentials_json)
        
        # Create credentials object
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info, 
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        
        # Create Google Drive service
        drive_service = build('drive', 'v3', credentials=credentials)
        return drive_service
        
    except Exception as e:
        print("Error connecting to Google Drive:", e)
        return None

def upload_to_drive(file_data, filename):
    """Upload a file to Google Drive"""
    try:
        # Get Google Drive connection
        drive_service = get_drive_service()
        if not drive_service:
            return None
            
        # Prepare file information
        file_info = {
            'name': filename,
            'parents': [FOLDER_ID]  # This is your folder ID
        }
        
        # Create file content
        file_content = MediaInMemoryUpload(file_data, mimetype='image/png')
        
        # Upload to Google Drive
        file = drive_service.files().create(
            body=file_info, 
            media_body=file_content, 
            fields='id',
            supportsAllDrives=True
        ).execute()
        
        return file.get('id')
        
    except Exception as e:
        print("Error uploading to Google Drive:", e)
        return None

# ===== YOUR EXISTING ROUTES =====
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

    saved_files = []

    # Save QR code
    if qr_data.startswith("data:image"):
        qr_bytes = base64.b64decode(qr_data.split(",")[1])
        qr_filename = f"{last_name}_{student_id}_qr.png"
        qr_file_id = upload_to_drive(qr_bytes, qr_filename)
        
        if qr_file_id:
            saved_files.append({"name": qr_filename, "drive_id": qr_file_id})
        else:
            return jsonify({"error": "Failed to save QR code"}), 500

    # Save photo
    if photo_data.startswith("data:image"):
        photo_bytes = base64.b64decode(photo_data.split(",")[1])
        photo_filename = f"{last_name}_{student_id}_photo.png"
        photo_file_id = upload_to_drive(photo_bytes, photo_filename)
        
        if photo_file_id:
            saved_files.append({"name": photo_filename, "drive_id": photo_file_id})
        else:
            return jsonify({"error": "Failed to save photo"}), 500

    if saved_files:
        return jsonify({
            "message": "Files saved to Google Drive successfully!", 
            "saved": saved_files
        })
    else:
        return jsonify({"error": "No files were saved"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
