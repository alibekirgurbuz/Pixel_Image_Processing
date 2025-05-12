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
    
    # Eğer orijinal görsel seçildiyse, sadece parlaklık ve kontrast ayarlarını uygula
    if filter_type == 'original':
        return image
    
    if filter_type == 'mean':
        # Ortalama filtreleme
        kernel_size = int(request.form.get('kernel_size', '3'))
        return cv2.blur(image, (kernel_size, kernel_size))
    
    elif filter_type == 'median':
        # Medyan filtreleme
        kernel_size = int(request.form.get('kernel_size', '3'))
        return cv2.medianBlur(image, kernel_size)
    
    elif filter_type == 'gaussian':
        # Gauss filtresi
        kernel_size = int(request.form.get('kernel_size', '3'))
        sigma = float(request.form.get('sigma', '1.0'))
        return cv2.GaussianBlur(image, (kernel_size, kernel_size), sigma)
    
    elif filter_type == 'conservative':
        # Konservatif filtreleme
        kernel_size = int(request.form.get('kernel_size', '3'))
        height, width = image.shape[:2]
        result = image.copy()
        
        for i in range(kernel_size//2, height-kernel_size//2):
            for j in range(kernel_size//2, width-kernel_size//2):
                # Komşu pikselleri al
                neighbors = image[i-kernel_size//2:i+kernel_size//2+1, 
                                j-kernel_size//2:j+kernel_size//2+1]
                # Merkez piksel değerini al
                center = image[i, j]
                # Minimum ve maksimum değerleri bul
                min_val = np.min(neighbors)
                max_val = np.max(neighbors)
                # Eğer merkez piksel min-max aralığında değilse, en yakın değerle değiştir
                if np.any(center < min_val):
                    result[i, j] = min_val
                elif np.any(center > max_val):
                    result[i, j] = max_val
        
        return result
    
    elif filter_type == 'crimmins':
        # Crimmins speckle azaltma
        try:
            print("Crimmins filtresi uygulanıyor...")
            # Gri tonlamaya çevir
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            print(f"Gri tonlama başarılı. Boyut: {gray.shape}")
            
            height, width = gray.shape
            result = gray.copy()
            
            # 8 yönlü komşuluk için döngü
            for i in range(1, height-1):
                for j in range(1, width-1):
                    # 8 yönlü komşuluk değerleri
                    neighbors = [
                        gray[i-1, j-1], gray[i-1, j], gray[i-1, j+1],
                        gray[i, j-1], gray[i, j+1],
                        gray[i+1, j-1], gray[i+1, j], gray[i+1, j+1]
                    ]
                    # Merkez piksel değeri
                    center = gray[i, j]
                    # Minimum ve maksimum komşu değerleri
                    min_neighbor = min(neighbors)
                    max_neighbor = max(neighbors)
                    # Crimmins algoritması
                    if center < min_neighbor:
                        result[i, j] = min_neighbor
                    elif center > max_neighbor:
                        result[i, j] = max_neighbor
            
            print("Crimmins işlemi tamamlandı")
            
            # 3 kanala çevir
            result = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
            print("3 kanala çevirme tamamlandı")
            
            return result
            
        except Exception as e:
            print(f"Crimmins filtresi hatası: {str(e)}")
            raise
    
    elif filter_type == 'fourier_lpf':
        # Fourier dönüşümü ile alçak geçiren filtre
        d0 = float(request.form.get('cutoff', '30'))  # Kesim frekansı
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.zeros((rows, cols, 2), np.uint8)
        mask[crow-int(d0):crow+int(d0), ccol-int(d0):ccol+int(d0)] = 1
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'fourier_hpf':
        # Fourier dönüşümü ile yüksek geçiren filtre
        d0 = float(request.form.get('cutoff', '30'))  # Kesim frekansı
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.ones((rows, cols, 2), np.uint8)
        mask[crow-int(d0):crow+int(d0), ccol-int(d0):ccol+int(d0)] = 0
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'bandpass':
        # Band geçiren filtre
        d0 = float(request.form.get('d0', '30'))  # Merkez frekans
        w = float(request.form.get('w', '20'))    # Bant genişliği
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.zeros((rows, cols, 2), np.uint8)
        
        for i in range(rows):
            for j in range(cols):
                d = np.sqrt((i-crow)**2 + (j-ccol)**2)
                if d0-w/2 <= d <= d0+w/2:
                    mask[i,j] = 1
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'bandstop':
        # Band durduran filtre
        d0 = float(request.form.get('d0', '30'))  # Merkez frekans
        w = float(request.form.get('w', '20'))    # Bant genişliği
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.ones((rows, cols, 2), np.uint8)
        
        for i in range(rows):
            for j in range(cols):
                d = np.sqrt((i-crow)**2 + (j-ccol)**2)
                if d0-w/2 <= d <= d0+w/2:
                    mask[i,j] = 0
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'butterworth_lpf':
        # Butterworth alçak geçiren filtre
        d0 = float(request.form.get('d0', '30'))  # Kesim frekansı
        n = int(request.form.get('n', '2'))       # Filtre derecesi
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.zeros((rows, cols, 2), np.float32)
        
        for i in range(rows):
            for j in range(cols):
                d = np.sqrt((i-crow)**2 + (j-ccol)**2)
                mask[i,j] = 1 / (1 + (d/d0)**(2*n))
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'butterworth_hpf':
        # Butterworth yüksek geçiren filtre
        d0 = float(request.form.get('d0', '30'))  # Kesim frekansı
        n = int(request.form.get('n', '2'))       # Filtre derecesi
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Fourier dönüşümü
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Maske oluştur
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.zeros((rows, cols, 2), np.float32)
        
        for i in range(rows):
            for j in range(cols):
                d = np.sqrt((i-crow)**2 + (j-ccol)**2)
                mask[i,j] = 1 / (1 + (d0/d)**(2*n))
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'homomorphic':
        # Homomorfik filtre
        gamma_l = float(request.form.get('gamma_l', '0.5'))  # Alçak frekans kazancı
        gamma_h = float(request.form.get('gamma_h', '2.0'))  # Yüksek frekans kazancı
        d0 = float(request.form.get('d0', '30'))            # Kesim frekansı
        c = float(request.form.get('c', '1.0'))             # Sabit
        
        # Gri tonlamaya çevir
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Log dönüşümü
        img_log = np.log1p(np.float32(gray))
        
        # Fourier dönüşümü
        dft = cv2.dft(img_log, flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Homomorfik filtre maskesi
        rows, cols = gray.shape
        crow, ccol = rows//2, cols//2
        mask = np.zeros((rows, cols, 2), np.float32)
        
        for i in range(rows):
            for j in range(cols):
                d = np.sqrt((i-crow)**2 + (j-ccol)**2)
                mask[i,j] = (gamma_h - gamma_l) * (1 - np.exp(-c * (d**2 / d0**2))) + gamma_l
        
        # Filtreleme
        fshift = dft_shift * mask
        f_ishift = np.fft.ifftshift(fshift)
        img_back = cv2.idft(f_ishift)
        img_back = cv2.magnitude(img_back[:,:,0], img_back[:,:,1])
        
        # Üstel dönüşüm
        img_back = np.expm1(img_back)
        
        # Normalize
        img_back = cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX)
        return img_back.astype(np.uint8)
    
    elif filter_type == 'gray':
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
    elif filter_type == 'translate':
        # Taşıma işlemi
        tx = float(request.form.get('tx', '0'))  # x ekseni taşıma miktarı
        ty = float(request.form.get('ty', '0'))  # y ekseni taşıma miktarı
        rows, cols = image.shape[:2]
        M = np.float32([[1, 0, tx], [0, 1, ty]])
        return cv2.warpAffine(image, M, (cols, rows))
    elif filter_type == 'mirror':
        # Aynalama işlemi
        axis = request.form.get('axis', 'horizontal')  # horizontal veya vertical
        if axis == 'horizontal':
            return cv2.flip(image, 1)
        else:
            return cv2.flip(image, 0)
    elif filter_type == 'shear':
        # Eğme işlemi
        shear_x = float(request.form.get('shear_x', '0'))  # x ekseni eğme miktarı
        shear_y = float(request.form.get('shear_y', '0'))  # y ekseni eğme miktarı
        rows, cols = image.shape[:2]
        M = np.float32([[1, shear_x, 0], [shear_y, 1, 0]])
        return cv2.warpAffine(image, M, (cols, rows))
    elif filter_type == 'scale':
        # Ölçekleme işlemi
        scale_x = float(request.form.get('scale_x', '1'))  # x ekseni ölçekleme
        scale_y = float(request.form.get('scale_y', '1'))  # y ekseni ölçekleme
        return cv2.resize(image, None, fx=scale_x, fy=scale_y)
    elif filter_type == 'rotate':
        # Döndürme işlemi
        angle = float(request.form.get('angle', '10'))  # döndürme açısı
        rows, cols = image.shape[:2]
        M = cv2.getRotationMatrix2D((cols/2, rows/2), angle, 1)
        return cv2.warpAffine(image, M, (cols, rows))
    elif filter_type == 'crop':
        # Kırpma işlemi
        x = int(request.form.get('x', '0'))
        y = int(request.form.get('y', '0'))
        width = int(request.form.get('width', str(image.shape[1])))
        height = int(request.form.get('height', str(image.shape[0])))
        return image[y:y+height, x:x+width]
    elif filter_type == 'sobel':
        # Sobel kenar tespiti
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(sobelx**2 + sobely**2)
        magnitude = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
        return magnitude.astype(np.uint8)
    elif filter_type == 'prewitt':
        try:
            # Prewitt kenar tespiti
            print("Prewitt filtresi uygulanıyor...")
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            print(f"Gri tonlama başarılı. Boyut: {gray.shape}")
            
            # Kernel'ları oluştur
            kernelx = np.array([[1,1,1],[0,0,0],[-1,-1,-1]], dtype=np.float32)
            kernely = np.array([[-1,0,1],[-1,0,1],[-1,0,1]], dtype=np.float32)
            print("Kernel'lar oluşturuldu")
            
            # Filtreleme işlemi
            prewittx = cv2.filter2D(gray, cv2.CV_32F, kernelx)
            prewitty = cv2.filter2D(gray, cv2.CV_32F, kernely)
            print("Filtreleme işlemi tamamlandı")
            
            # Magnitude hesaplama
            magnitude = np.sqrt(prewittx**2 + prewitty**2)
            print("Magnitude hesaplandı")
            
            # Normalizasyon
            magnitude = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
            magnitude = magnitude.astype(np.uint8)
            print("Normalizasyon tamamlandı")
            
            # 3 kanala çevirme
            result = cv2.cvtColor(magnitude, cv2.COLOR_GRAY2BGR)
            print("3 kanala çevirme tamamlandı")
            
            return result
            
        except Exception as e:
            print(f"Prewitt filtresi hatası: {str(e)}")
            raise
    elif filter_type == 'roberts':
        try:
            # Roberts Cross kenar tespiti
            print("Roberts filtresi uygulanıyor...")
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            print(f"Gri tonlama başarılı. Boyut: {gray.shape}")
            
            # Kernel'ları oluştur
            kernelx = np.array([[1, 0], [0, -1]], dtype=np.float32)
            kernely = np.array([[0, 1], [-1, 0]], dtype=np.float32)
            print("Kernel'lar oluşturuldu")
            
            # Filtreleme işlemi
            robertsx = cv2.filter2D(gray, cv2.CV_32F, kernelx)
            robertsy = cv2.filter2D(gray, cv2.CV_32F, kernely)
            print("Filtreleme işlemi tamamlandı")
            
            # Magnitude hesaplama
            magnitude = np.sqrt(robertsx**2 + robertsy**2)
            print("Magnitude hesaplandı")
            
            # Normalizasyon
            magnitude = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
            magnitude = magnitude.astype(np.uint8)
            print("Normalizasyon tamamlandı")
            
            # 3 kanala çevirme
            result = cv2.cvtColor(magnitude, cv2.COLOR_GRAY2BGR)
            print("3 kanala çevirme tamamlandı")
            
            return result
            
        except Exception as e:
            print(f"Roberts filtresi hatası: {str(e)}")
            raise
    elif filter_type == 'compass':
        # Compass kenar tespiti
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        kernels = [
            np.array([[-1, -1, -1], [1, -2, 1], [1, 1, 1]]),  # N
            np.array([[1, -1, -1], [1, -2, -1], [1, 1, 1]]),  # NE
            np.array([[1, 1, -1], [1, -2, -1], [1, 1, -1]]),  # E
            np.array([[1, 1, 1], [1, -2, -1], [1, -1, -1]]),  # SE
            np.array([[1, 1, 1], [1, -2, 1], [-1, -1, -1]]),  # S
            np.array([[1, 1, 1], [-1, -2, 1], [-1, -1, 1]]),  # SW
            np.array([[-1, 1, 1], [-1, -2, 1], [-1, 1, 1]]),  # W
            np.array([[-1, -1, 1], [-1, -2, 1], [1, 1, 1]])   # NW
        ]
        compass = np.zeros_like(gray)
        for kernel in kernels:
            filtered = cv2.filter2D(gray, -1, kernel)
            compass = np.maximum(compass, filtered)
        compass = cv2.normalize(compass, None, 0, 255, cv2.NORM_MINMAX)
        return compass.astype(np.uint8)
    elif filter_type == 'canny':
        # Canny kenar tespiti
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        return edges
    elif filter_type == 'laplace':
        # Laplace kenar tespiti
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian = np.uint8(np.absolute(laplacian))
        return laplacian
    elif filter_type == 'gabor':
        # Gabor filtresi
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        ksize = 31
        theta = np.pi/4
        kernel = cv2.getGaborKernel((ksize, ksize), 4.0, theta, 10.0, 0.5, 0, ktype=cv2.CV_32F)
        filtered = cv2.filter2D(gray, cv2.CV_8UC3, kernel)
        return filtered
    elif filter_type == 'hough':
        # Hough dönüşümü
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi/180, 200)
        result = image.copy()
        if lines is not None:
            for rho, theta in lines[:, 0]:
                a = np.cos(theta)
                b = np.sin(theta)
                x0 = a * rho
                y0 = b * rho
                x1 = int(x0 + 1000*(-b))
                y1 = int(y0 + 1000*(a))
                x2 = int(x0 - 1000*(-b))
                y2 = int(y0 - 1000*(a))
                cv2.line(result, (x1,y1), (x2,y2), (0,0,255), 2)
        return result
    elif filter_type == 'kmeans':
        # K-means segmentasyon
        pixel_values = image.reshape((-1, 3))
        pixel_values = np.float32(pixel_values)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        k = 3
        _, labels, centers = cv2.kmeans(pixel_values, k, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        centers = np.uint8(centers)
        labels = labels.flatten()
        segmented_image = centers[labels.flatten()]
        segmented_image = segmented_image.reshape(image.shape)
        return segmented_image
    elif filter_type == 'erode':
        # Aşındırma işlemi
        kernel_size = int(request.form.get('kernel_size', '3'))
        iterations = int(request.form.get('iterations', '1'))
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        eroded = cv2.erode(image, kernel, iterations=iterations)
        return eroded
    elif filter_type == 'dilate':
        # Genişletme işlemi
        kernel_size = int(request.form.get('kernel_size', '3'))
        iterations = int(request.form.get('iterations', '1'))
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        dilated = cv2.dilate(image, kernel, iterations=iterations)
        return dilated
    else:
        # Varsayılan olarak orijinal görüntüyü döndür
        return image

@app.route('/')
def index():
    return jsonify({'message': 'Fotoğraf İşleme API çalışıyor. /process-image endpoint\'ini kullanarak fotoğraf yükleyebilirsiniz.'}), 200

@app.route('/process-image', methods=['POST'])
def process_image():
    if 'image' not in request.files and 'image' not in request.form:
        return jsonify({'error': 'No image file found'}), 400

    try:
        # Görüntüyü al
        if 'image' in request.files:
            file = request.files['image']
            file_bytes = file.read()
        else:
            # Base64 formatındaki görüntüyü işle
            image_data = request.form['image']
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            file_bytes = base64.b64decode(image_data)

        image_id = uuid.uuid4().hex
        
        # Form verisinden ayar bilgisini al
        save_original = request.form.get('saveOriginal', 'true').lower() == 'true'
        filter_type = request.form.get('filter', 'gray')
        brightness = float(request.form.get('brightness', '1.0'))
        contrast = float(request.form.get('contrast', '1.0'))
        
        # OpenCV ile bellek üzerinde işle
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Görüntü yüklenemedi")
        
        # Görüntü boyutunu kontrol et ve gerekirse küçült
        max_dimension = 1024  # Maksimum boyut
        height, width = img.shape[:2]
        if max(height, width) > max_dimension:
            scale = max_dimension / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        # Seçilen filtreyi ve parlaklık/kontrast ayarlarını uygula
        filtered_img = apply_filter(img, filter_type, brightness, contrast)
        
        # Tek kanallıysa (gri tonlama) 3 kanala çevir
        if len(filtered_img.shape) == 2:
            filtered_img = cv2.cvtColor(filtered_img, cv2.COLOR_GRAY2BGR)
        
        # İşlenmiş görseli base64'e dönüştür (kalite ayarı ile)
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]  # JPEG kalitesi
        _, buffer = cv2.imencode('.jpg', filtered_img, encode_param)
        img_data = base64.b64encode(buffer).decode('utf-8')
        
        # Orijinal görsel saklanacaksa kaydet
        if save_original:
            input_path = os.path.join(UPLOAD_FOLDER, f"{image_id}.jpg")
            with open(input_path, 'wb') as f:
                f.write(file_bytes)
            print(f"Orijinal görsel kaydedildi: {input_path}")
        
        return jsonify({
            'processed_image_base64': img_data,
            'image_id': image_id,
            'filter_applied': filter_type,
            'brightness': brightness,
            'contrast': contrast
        }), 200
        
    except Exception as e:
        print(f"İşlem hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
