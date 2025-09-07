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
        return drive_service
        
    except Exception as e:
        print("ERROR connecting to Google Drive:", str(e))
        return None

def find_or_create_folder(drive_service, folder_name, parent_id=None):
    """Find a folder by name, or create it if it doesn't exist"""
    try:
        # Search for the folder
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        
        results = drive_service.files().list(q=query, fields="files(id, name)").execute()
        folders = results.get('files', [])
        
        if folders:
            print(f"Found existing folder: {folder_name} - ID: {folders[0]['id']}")
            return folders[0]['id']
        else:
            # Create the folder if it doesn't exist
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_id:
                file_metadata['parents'] = [parent_id]
                
            folder = drive_service.files().create(body=file_metadata, fields='id').execute()
            print(f"Created new folder: {folder_name} - ID: {folder.get('id')}")
            return folder.get('id')
            
    except Exception as e:
        print(f"ERROR finding/creating folder {folder_name}:", str(e))
        return None

def upload_to_drive(file_data, filename, last_name, student_id):
    """Upload a file to Google Drive with organized folder structure"""
    try:
        drive_service = get_drive_service()
        if not drive_service:
            return None
        
        # 1. Find or create main folder
        main_folder_name = "BSCS1 - ATTENDANCE QR CODE"
        main_folder_id = find_or_create_folder(drive_service, main_folder_name)
        if not main_folder_id:
            return None
        
        # 2. Find or create student subfolder (using last name)
        student_folder_name = last_name
        student_folder_id = find_or_create_folder(drive_service, student_folder_name, main_folder_id)
        if not student_folder_id:
            return None
        
        # 3. Upload the file to the student's folder
        file_metadata = {
            'name': filename,
            'parents': [student_folder_id]
        }
        
        media = MediaInMemoryUpload(file_data, mimetype='image/png')
        file = drive_service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id'
        ).execute()
        
        file_id = file.get('id')
        print(f"Successfully uploaded {filename} to folder {last_name}")
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
            results = service.files().list(pageSize=5, fields="files(id, name)").execute()
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
        last_name = data.get("lastName", "unknown")
        qr_data = data.get("qr", "")
        photo_data = data.get("photo", "")

        print(f"Processing save request for: {name} {last_name} (ID: {student_id})")

        saved_files = []

        # Save QR code
        if qr_data and qr_data.startswith("data:image"):
            qr_bytes = base64.b64decode(qr_data.split(",")[1])
            qr_filename = f"{last_name}_{student_id}_qr.png"
            print(f"Attempting to save QR code: {qr_filename}")
            
            qr_file_id = upload_to_drive(qr_bytes, qr_filename, last_name, student_id)
            
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
            
            photo_file_id = upload_to_drive(photo_bytes, photo_filename, last_name, student_id)
            
            if photo_file_id:
                saved_files.append({"name": photo_filename, "drive_id": photo_file_id})
                print(f"Successfully saved photo: {photo_file_id}")
            else:
                print("Failed to save photo")
                return jsonify({"error": "Failed to save photo to Google Drive"}), 500

        if saved_files:
            return jsonify({
                "message": "Files saved to Google Drive successfully!", 
                "saved": saved_files,
                "folder_structure": f"BSCS1 - ATTENDANCE QR CODE/{last_name}/"
            })
        else:
            return jsonify({"error": "No files were saved"}), 500
            
    except Exception as e:
        print("ERROR in /save route:", str(e))
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
