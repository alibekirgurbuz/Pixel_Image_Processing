from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import os
import uuid
import base64

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'static'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return jsonify({'message': 'Fotoğraf İşleme API çalışıyor. /process-image endpoint\'ini kullanarak fotoğraf yükleyebilirsiniz.'}), 200

@app.route('/process-image', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file found'}), 400

    file = request.files['image']
    filename = f"{uuid.uuid4().hex}.jpg"
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    output_path = os.path.join(OUTPUT_FOLDER, filename)

    # Kaydet
    file.save(input_path)

    # OpenCV ile işleme (örnek: gri yap)
    img = cv2.imread(input_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cv2.imwrite(output_path, gray)
    
    # Base64 formatına dönüştür
    with open(output_path, "rb") as img_file:
        img_data = base64.b64encode(img_file.read()).decode('utf-8')

    # Hem URL hem de base64 dönüş yap
    return jsonify({
        'processed_image_url': f'http://127.0.0.1:5000/static/{filename}',
        'processed_image_base64': img_data
    }), 200

# Statik dosya servis
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
