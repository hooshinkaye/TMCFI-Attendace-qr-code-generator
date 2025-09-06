from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os, base64

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

@app.route("/")
def home():
    return render_template("index.html")  # loads templates/index.html

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

    base_dir = os.path.join("students", "BSCS1", last_name)
    os.makedirs(base_dir, exist_ok=True)

    saved = []

    # Save QR
    if qr_data.startswith("data:image"):
        qr_bytes = base64.b64decode(qr_data.split(",")[1])
        qr_path = os.path.join(base_dir, f"{last_name}_qr.png")
        with open(qr_path, "wb") as f:
            f.write(qr_bytes)
        saved.append(qr_path)

    # Save Photo
    if photo_data.startswith("data:image"):
        photo_bytes = base64.b64decode(photo_data.split(",")[1])
        photo_path = os.path.join(base_dir, f"{last_name}_photo.png")
        with open(photo_path, "wb") as f:
            f.write(photo_bytes)
        saved.append(photo_path)

    return jsonify({"message": "Student files saved", "saved": saved})

if __name__ == "__main__":
    app.run(port=5000, debug=True)