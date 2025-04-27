from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import os
import uuid
import base64
import json
import time
import io
import numpy as np
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
SETTINGS_FILE = 'settings.json'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Varsayılan ayarlar
default_settings = {
    'save_original': True,
    'cleanup_days': 7  # 7 günden eski görseller temizlenecek
}

# Ayarları yükle
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                return json.load(f)
        except:
            return default_settings
    else:
        # İlk kez varsayılan ayarları kaydet
        save_settings(default_settings)
        return default_settings

# Ayarları kaydet
def save_settings(settings):
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f)

# Mevcut ayarlar
settings = load_settings()

# Filtre fonksiyonları
def apply_filter(image, filter_type, brightness=1.0, contrast=1.0):
    # Önce parlaklık ayarını uygula
    if brightness != 1.0:
        # BGR resim için parlaklık ayarını hesapla
        adjusted = image.astype('float32')
        adjusted = adjusted * float(brightness)
        # Değerleri 0-255 aralığında sınırla
        adjusted = np.clip(adjusted, 0, 255)
        # Tekrar uint8 formatına çevir
        image = adjusted.astype('uint8')
    
    # Kontrast ayarını uygula
    if contrast != 1.0:
        # Kontrast formülü: pixel = (pixel - 128) * contrast + 128
        adjusted = image.astype('float32')
        adjusted = (adjusted - 128) * float(contrast) + 128
        # Değerleri 0-255 aralığında sınırla
        adjusted = np.clip(adjusted, 0, 255)
        # Tekrar uint8 formatına çevir
        image = adjusted.astype('uint8')
    
    if filter_type == 'gray':
        # Gri tonlama filtresi
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    elif filter_type == 'negative':
        # Negatif filtresi
        return 255 - image
    elif filter_type == 'brightness_up':
        # Parlaklık artırma
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.add(v, 30)  # Parlaklığı 30 birim artır
        final_hsv = cv2.merge((h, s, v))
        return cv2.cvtColor(final_hsv, cv2.COLOR_HSV2BGR)
    elif filter_type == 'brightness_down':
        # Parlaklık azaltma
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.subtract(v, 30)  # Parlaklığı 30 birim azalt
        final_hsv = cv2.merge((h, s, v))
        return cv2.cvtColor(final_hsv, cv2.COLOR_HSV2BGR)
    elif filter_type == 'contrast_up':
        # Kontrast artırma
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced_lab = cv2.merge((cl, a, b))
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    elif filter_type == 'threshold':
        # Eşikleme filtresi
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
        return thresh
    elif filter_type == 'histogram':
        # Histogram eşitleme
        img_yuv = cv2.cvtColor(image, cv2.COLOR_BGR2YUV)
        img_yuv[:,:,0] = cv2.equalizeHist(img_yuv[:,:,0])
        return cv2.cvtColor(img_yuv, cv2.COLOR_YUV2BGR)
    elif filter_type == 'rgb_split':
        # RGB kanallarına ayırma ve yan yana gösterme
        b, g, r = cv2.split(image)
        zeros = np.zeros(b.shape, dtype=np.uint8)
        
        # Her bir kanalı kendi rengiyle göster
        blue_channel = cv2.merge([b, zeros, zeros])
        green_channel = cv2.merge([zeros, g, zeros])
        red_channel = cv2.merge([zeros, zeros, r])
        
        # Kanalları yan yana birleştir
        row1 = np.hstack([image, blue_channel])
        row2 = np.hstack([green_channel, red_channel])
        result = np.vstack([row1, row2])
        
        return result
    elif filter_type == 'warm':
        # Sıcak renk filtresi
        warmth_filter = np.array([
            [1.1, 0.0, 0.0, 0], 
            [0.0, 1.0, 0.0, 0], 
            [0.0, 0.0, 0.9, 0], 
            [0, 0, 0, 1.0]
        ])
        
        # Görüntüyü float formatına dönüştür
        img_float = image.astype(float) / 255.0
        
        # Filtreyi uygula
        h, w, c = img_float.shape
        for i in range(h):
            for j in range(w):
                b, g, r = img_float[i, j]
                new_b = min(1.0, b * warmth_filter[0][0])
                new_g = min(1.0, g * warmth_filter[1][1])
                new_r = min(1.0, r * warmth_filter[2][2] + 0.2)  # Biraz daha kırmızı ekle
                img_float[i, j] = [new_b, new_g, new_r]
        
        # 0-255 aralığına dönüştür
        filtered_img = (img_float * 255).astype(np.uint8)
        return filtered_img
    elif filter_type == 'cold':
        # Soğuk renk filtresi
        cold_filter = np.array([
            [0.9, 0.0, 0.0, 0], 
            [0.0, 1.0, 0.0, 0], 
            [0.0, 0.0, 1.2, 0], 
            [0, 0, 0, 1.0]
        ])
        
        # Görüntüyü float formatına dönüştür
        img_float = image.astype(float) / 255.0
        
        # Filtreyi uygula
        h, w, c = img_float.shape
        for i in range(h):
            for j in range(w):
                b, g, r = img_float[i, j]
                new_b = min(1.0, b * cold_filter[0][0] + 0.1)  # Biraz daha mavi ekle
                new_g = min(1.0, g * cold_filter[1][1])
                new_r = min(1.0, r * cold_filter[2][2])
                img_float[i, j] = [new_b, new_g, new_r]
        
        # 0-255 aralığına dönüştür
        filtered_img = (img_float * 255).astype(np.uint8)
        return filtered_img
    else:
        # Varsayılan olarak orijinal görüntüyü döndür
        return image

@app.route('/')
def index():
    return jsonify({'message': 'Fotoğraf İşleme API çalışıyor. /process-image endpoint\'ini kullanarak fotoğraf yükleyebilirsiniz.'}), 200

@app.route('/process-image', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file found'}), 400

    file = request.files['image']
    image_id = uuid.uuid4().hex
    
    # Form verisinden ayar bilgisini al
    save_original = request.form.get('saveOriginal', 'true').lower() == 'true'
    filter_type = request.form.get('filter', 'gray')  # Varsayılan filtre: gri
    brightness = float(request.form.get('brightness', '1.0'))  # Varsayılan parlaklık: 1.0
    contrast = float(request.form.get('contrast', '1.0'))  # Varsayılan kontrast: 1.0
    
    # Dosyayı belleğe oku
    file_bytes = file.read()
    
    # OpenCV ile bellek üzerinde işle
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Seçilen filtreyi ve parlaklık/kontrast ayarlarını uygula
    filtered_img = apply_filter(img, filter_type, brightness, contrast)
    
    # Tek kanallıysa (gri tonlama) 3 kanala çevir
    if len(filtered_img.shape) == 2:
        filtered_img = cv2.cvtColor(filtered_img, cv2.COLOR_GRAY2BGR)
    
    # İşlenmiş görseli base64'e dönüştür
    _, buffer = cv2.imencode('.jpg', filtered_img)
    img_data = base64.b64encode(buffer).decode('utf-8')
    
    # Orijinal görsel saklanacaksa kaydet, değilse kaydetme
    if save_original:
        input_path = os.path.join(UPLOAD_FOLDER, f"{image_id}.jpg")
        with open(input_path, 'wb') as f:
            f.write(file_bytes)
        print(f"Orijinal görsel kaydedildi: {input_path}")
    
    # Sadece base64 formatında dön
    return jsonify({
        'processed_image_base64': img_data,
        'image_id': image_id,
        'filter_applied': filter_type,
        'brightness': brightness,
        'contrast': contrast
    }), 200

# Ayarları güncelle
@app.route('/update-settings', methods=['POST'])
def update_settings():
    data = request.json
    current_settings = load_settings()
    
    # Gelen ayarları güncelle
    if 'saveOriginal' in data:
        current_settings['save_original'] = data['saveOriginal']
    
    if 'cleanupDays' in data:
        current_settings['cleanup_days'] = data['cleanupDays']
    
    # Ayarları kaydet
    save_settings(current_settings)
    
    return jsonify({'status': 'success', 'settings': current_settings}), 200

# Eski görselleri temizle
@app.route('/cleanup-images', methods=['POST'])
def cleanup_images():
    data = request.json
    keep_originals = data.get('keepOriginals', True)
    
    removed_count = 0
    now = datetime.now()
    cutoff_date = now - timedelta(days=settings['cleanup_days'])
    cutoff_timestamp = cutoff_date.timestamp()
    
    # Uploads klasöründeki eski orijinal görselleri temizle
    if not keep_originals:
        for filename in os.listdir(UPLOAD_FOLDER):
            if not filename.endswith('.jpg'):
                continue
                
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file_modified = os.path.getmtime(file_path)
            
            if file_modified < cutoff_timestamp:
                try:
                    os.remove(file_path)
                    removed_count += 1
                    print(f"Eski orijinal görsel silindi: {file_path}")
                except Exception as e:
                    print(f"Orijinal görsel silinemedi: {str(e)}")
    
    return jsonify({
        'status': 'success',
        'removedCount': removed_count,
        'cleanupDays': settings['cleanup_days']
    }), 200

# Sunucu durumunu getir
@app.route('/status', methods=['GET'])
def get_status():
    original_count = len([f for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.jpg')])
    
    uploads_size = sum(os.path.getsize(os.path.join(UPLOAD_FOLDER, f)) for f in os.listdir(UPLOAD_FOLDER) if os.path.isfile(os.path.join(UPLOAD_FOLDER, f)))
    
    return jsonify({
        'original_images': original_count,
        'uploads_size_mb': round(uploads_size / (1024 * 1024), 2),
        'save_original_enabled': settings['save_original'],
        'cleanup_days': settings['cleanup_days']
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
