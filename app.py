from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os, base64, json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
from google.auth.transport.requests import Request

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

def get_drive_service():
    """Connect to Google Drive using OAuth credentials"""
    try:
        # Get token data from environment variable
        token_json = os.environ.get('GOOGLE_OAUTH_TOKEN')
        if not token_json:
            print("ERROR: GOOGLE_OAUTH_TOKEN environment variable not found")
            return None
            
        # Parse the JSON token data
        token_data = json.loads(token_json)
        
        # Create credentials from the token data
        creds = Credentials(
            token=None,  # Will be obtained via refresh
            refresh_token=token_data['refresh_token'],
            token_uri='https://oauth2.googleapis.com/token',
            client_id=token_data['client_id'],
            client_secret=token_data['client_secret'],
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        
        # Refresh to get an access token
        creds.refresh(Request())
        
        # Create Google Drive service
        drive_service = build('drive', 'v3', credentials=creds)
        print("Successfully connected to Google Drive")
        return drive_service
        
    except Exception as e:
        print("ERROR connecting to Google Drive:", str(e))
        return None

def upload_to_drive(file_data, filename, folder_name="Student QR Codes"):
    """Upload a file to Google Drive"""
    try:
        drive_service = get_drive_service()
        if not drive_service:
            return None
            
        # Check if folder exists, create if not
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = drive_service.files().list(q=query, fields="files(id, name)").execute()
        folders = results.get('files', [])
        
        if folders:
            folder_id = folders[0]['id']
            print(f"Found existing folder: {folder_id}")
        else:
            # Create the folder if it doesn't exist
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = drive_service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            print(f"Created new folder: {folder_id}")
        
        # Upload the file
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        media = MediaInMemoryUpload(file_data, mimetype='image/png')
        file = drive_service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id'
        ).execute()
        
        file_id = file.get('id')
        print(f"Successfully uploaded file: {filename} with ID: {file_id}")
        return file_id
        
    except Exception as e:
        print("ERROR uploading to Google Drive:", str(e))
        return None

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/test-drive")
def test_drive():
    """Test endpoint to check Google Drive connection"""
    try:
        service = get_drive_service()
        if service:
            # Try to list some files to verify connection works
            results = service.files().list(pageSize=10, fields="files(id, name)").execute()
            files = results.get('files', [])
            return jsonify({
                "status": "success", 
                "message": "Google Drive connection successful",
                "file_count": len(files)
            })
        else:
            return jsonify({"status": "error", "message": "Failed to connect to Google Drive"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/save", methods=["POST"])
def save():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data received"}), 400

        student_id = data.get("id", "unknown")
        name = data.get("name", "unknown")
        last_name = data.get("lastName", "attendance")
        qr_data = data.get("qr", "")
        photo_data = data.get("photo", "")

        print(f"Processing save request for: {name} {last_name} (ID: {student_id})")

        saved_files = []

        # Save QR code
        if qr_data and qr_data.startswith("data:image"):
            qr_bytes = base64.b64decode(qr_data.split(",")[1])
            qr_filename = f"{last_name}_{student_id}_qr.png"
            print(f"Attempting to save QR code: {qr_filename}")
            
            qr_file_id = upload_to_drive(qr_bytes, qr_filename, f"Student QR Codes/BSCS1/{last_name}")
            
            if qr_file_id:
                saved_files.append({"name": qr_filename, "drive_id": qr_file_id})
                print(f"Successfully saved QR code: {qr_file_id}")
            else:
                print("Failed to save QR code")
                return jsonify({"error": "Failed to save QR code to Google Drive"}), 500

        # Save photo
        if photo_data and photo_data.startswith("data:image"):
            photo_bytes = base64.b64decode(photo_data.split(",")[1])
            photo_filename = f"{last_name}_{student_id}_photo.png"
            print(f"Attempting to save photo: {photo_filename}")
            
            photo_file_id = upload_to_drive(photo_bytes, photo_filename, f"Student QR Codes/BSCS1/{last_name}")
            
            if photo_file_id:
                saved_files.append({"name": photo_filename, "drive_id": photo_file_id})
                print(f"Successfully saved photo: {photo_file_id}")
            else:
                print("Failed to save photo")
                return jsonify({"error": "Failed to save photo to Google Drive"}), 500

        if saved_files:
            return jsonify({
                "message": "Files saved to Google Drive successfully!", 
                "saved": saved_files
            })
        else:
            return jsonify({"error": "No files were saved"}), 500
            
    except Exception as e:
        print("ERROR in /save route:", str(e))
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
