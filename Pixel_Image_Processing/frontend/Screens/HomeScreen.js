import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Button, 
  Image, 
  Alert, 
  ActivityIndicator, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Animated
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import Slider from '@react-native-community/slider';

// API URL'si - sunucu adresi olarak gerçek IP adresi
const API_URL = 'http://192.168.1.50:5000'; // Sunucunun gerçek IP adresi

// Kullanılabilir filtreler listesi
const FILTERS = [
  { id: 'original', name: 'Orijinal', icon: '🖼️', description: 'Orijinal görsel' },
  { id: 'gray', name: 'Gri Ton', icon: '🌫️', description: 'Gri tonlama filtresi uygular' },
  { id: 'negative', name: 'Negatif', icon: '🔄', description: 'Negatif görüntü filtresi' },
  { id: 'threshold', name: 'Eşikleme', icon: '⚪', description: 'Eşikleme filtresi uygular' },
  { id: 'histogram', name: 'Histogram', icon: '📈', description: 'Histogram eşitleme uygular' },
  { id: 'rgb_split', name: 'RGB\'ye Ayır', icon: '🎨', description: 'RGB kanallarını ayrıştırır' },
  { id: 'warm', name: 'Sıcak', icon: '🔥', description: 'Sıcak renk tonu filtresi uygular' },
  { id: 'cold', name: 'Soğuk', icon: '❄️', description: 'Soğuk renk tonu filtresi uygular' },
  { id: 'translate', name: 'Taşı', icon: '↔️', description: 'Görüntüyü taşı' },
  { id: 'mirror', name: 'Aynala', icon: '🪞', description: 'Görüntüyü aynala' },
  { id: 'shear', name: 'Eğ', icon: '↘️', description: 'Görüntüyü eğ' },
  { id: 'scale', name: 'Ölçekle', icon: '🔍', description: 'Görüntüyü ölçekle' },
  { id: 'rotate', name: 'Döndür', icon: '🔄', description: 'Görüntüyü döndür' },
  { id: 'crop', name: 'Kırp', icon: '✂️', description: 'Görüntüyü kırp' },
  { id: 'perspective', name: 'Perspektif', icon: '📐', description: 'Perspektif düzeltme uygula' },
  { id: 'mean', name: 'Ortalama', icon: '🔲', description: 'Ortalama filtreleme uygula' },
  { id: 'median', name: 'Medyan', icon: '📊', description: 'Medyan filtreleme uygula' },
  { id: 'gaussian', name: 'Gauss', icon: '🌫️', description: 'Gauss filtresi uygula' },
  { id: 'conservative', name: 'Konservatif', icon: '🛡️', description: 'Konservatif filtreleme uygula' },
  { id: 'crimmins', name: 'Crimmins', icon: '✨', description: 'Crimmins speckle azaltma' },
  { id: 'fourier_lpf', name: 'Fourier LPF', icon: '🔽', description: 'Fourier alçak geçiren filtre' },
  { id: 'fourier_hpf', name: 'Fourier HPF', icon: '🔼', description: 'Fourier yüksek geçiren filtre' },
  { id: 'bandpass', name: 'Band Geçiren', icon: '🎵', description: 'Band geçiren filtre' },
  { id: 'bandstop', name: 'Band Durduran', icon: '🚫', description: 'Band durduran filtre' },
  { id: 'butterworth_lpf', name: 'Butterworth LPF', icon: '🔽', description: 'Butterworth alçak geçiren filtre' },
  { id: 'butterworth_hpf', name: 'Butterworth HPF', icon: '🔼', description: 'Butterworth yüksek geçiren filtre' },
  { id: 'homomorphic', name: 'Homomorfik', icon: '🌈', description: 'Homomorfik filtre' },
  { id: 'sobel', name: 'Sobel', icon: '📏', description: 'Sobel kenar tespiti' },
  { id: 'prewitt', name: 'Prewitt', icon: '📐', description: 'Prewitt kenar tespiti' },
  { id: 'roberts', name: 'Roberts', icon: '✳️', description: 'Roberts Cross kenar tespiti' },
  { id: 'compass', name: 'Compass', icon: '🧭', description: 'Compass kenar tespiti' },
  { id: 'canny', name: 'Canny', icon: '🔍', description: 'Canny kenar tespiti' },
  { id: 'laplace', name: 'Laplace', icon: '⚡', description: 'Laplace kenar tespiti' },
  { id: 'gabor', name: 'Gabor', icon: '🎯', description: 'Gabor filtresi' },
  { id: 'hough', name: 'Hough', icon: '📈', description: 'Hough dönüşümü' },
  { id: 'kmeans', name: 'K-means', icon: '🎨', description: 'K-means segmentasyon' },
  { id: 'erode', name: 'Aşındır', icon: '🔍', description: 'Aşındırma işlemi' },
  { id: 'dilate', name: 'Genişlet', icon: '🔍', description: 'Genişletme işlemi' },
];

// Ayarlanabilir parametreler (İkonlar ve Sliderlar için)
const ADJUSTMENTS = [
  { id: 'brightness', name: 'Parlaklık', icon: '☀️', min: 0.5, max: 2.0, step: 0.05, defaultValue: 1.0 },
  { id: 'contrast', name: 'Kontrast', icon: '📊', min: 0.5, max: 2.0, step: 0.05, defaultValue: 1.0 },
  { id: 'tx', name: 'X Taşıma', icon: '↔️', min: -100, max: 100, step: 1, defaultValue: 0 },
  { id: 'ty', name: 'Y Taşıma', icon: '↕️', min: -100, max: 100, step: 1, defaultValue: 0 },
  { id: 'shear_x', name: 'X Eğme', icon: '↘️', min: -0.5, max: 0.5, step: 0.05, defaultValue: 0 },
  { id: 'shear_y', name: 'Y Eğme', icon: '↗️', min: -0.5, max: 0.5, step: 0.05, defaultValue: 0 },
  { id: 'scale_x', name: 'X Ölçek', icon: '↔️', min: 0.5, max: 2.0, step: 0.1, defaultValue: 1.0 },
  { id: 'scale_y', name: 'Y Ölçek', icon: '↕️', min: 0.5, max: 2.0, step: 0.1, defaultValue: 1.0 },
  { id: 'angle', name: 'Açı', icon: '🔄', min: -180, max: 180, step: 1, defaultValue: 0 },
  { id: 'crop_x', name: 'X Kırpma', icon: '↔️', min: 0, max: 100, step: 1, defaultValue: 0 },
  { id: 'crop_y', name: 'Y Kırpma', icon: '↕️', min: 0, max: 100, step: 1, defaultValue: 0 },
  { id: 'crop_width', name: 'Genişlik', icon: '↔️', min: 10, max: 100, step: 1, defaultValue: 100 },
  { id: 'crop_height', name: 'Yükseklik', icon: '↕️', min: 10, max: 100, step: 1, defaultValue: 100 },
  { id: 'kernel_size', name: 'Kernel Boyutu', icon: '🔲', min: 3, max: 15, step: 2, defaultValue: 3 },
  { id: 'iterations', name: 'İterasyon', icon: '🔄', min: 1, max: 10, step: 1, defaultValue: 1 },
  { id: 'sigma', name: 'Sigma', icon: 'σ', min: 0.1, max: 5.0, step: 0.1, defaultValue: 1.0 },
  { id: 'cutoff', name: 'Kesim Frekansı', icon: '📉', min: 1, max: 100, step: 1, defaultValue: 30 },
  { id: 'd0', name: 'Merkez Frekans', icon: '🎯', min: 1, max: 100, step: 1, defaultValue: 30 },
  { id: 'w', name: 'Bant Genişliği', icon: '📏', min: 1, max: 50, step: 1, defaultValue: 20 },
  { id: 'n', name: 'Filtre Derecesi', icon: '🔢', min: 1, max: 5, step: 1, defaultValue: 2 },
  { id: 'gamma_l', name: 'Alçak Frekans Kazancı', icon: '🔽', min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.5 },
  { id: 'gamma_h', name: 'Yüksek Frekans Kazancı', icon: '🔼', min: 1.0, max: 5.0, step: 0.1, defaultValue: 2.0 },
  { id: 'c', name: 'Sabit', icon: '⚖️', min: 0.1, max: 5.0, step: 0.1, defaultValue: 1.0 },
];

// Ekran genişliğine göre grid boyutu ayarla
const { width } = Dimensions.get('window');
const ITEM_WIDTH = 80; // Yatay liste için eleman genişliği

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [saveOriginal, setSaveOriginal] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('original'); // Varsayılan filtreyi değiştirdik
  const [processedImageUri, setProcessedImageUri] = useState(null); // İşlenmiş görsel için state
  const [currentFilterName, setCurrentFilterName] = useState('Orijinal'); // Mevcut filtre adı
  const [isSaving, setIsSaving] = useState(false); // Kaydetme durumu için state
  const [brightness, setBrightness] = useState(1.0); // Parlaklık değeri için state
  const [contrast, setContrast] = useState(1.0); // Kontrast değeri için state
  const [activeAdjustment, setActiveAdjustment] = useState(null); // Aktif ayar için state
  const [perspectivePoints, setPerspectivePoints] = useState([]);
  const [isPerspectiveMode, setIsPerspectiveMode] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  // Yeni state'ler
  const [imageHistory, setImageHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [originalImageUri, setOriginalImageUri] = useState(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [modalImageUri, setModalImageUri] = useState(null);
  
  const route = useRoute();
  const navigation = useNavigation();
  const selectedImageUri = route?.params?.imageUri;
  
  // FlatList referansı
  const flatListRef = useRef(null);
  
  // Kullanıcı ayarlarını yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await AsyncStorage.getItem('userSettings');
        if (settings) {
          const parsedSettings = JSON.parse(settings);
          setSaveOriginal(parsedSettings.saveOriginal || true);
        }
      } catch (error) {
        console.error('Ayarlar yüklenirken hata:', error);
      }
    };
    
    loadSettings();
  }, []);

  const pickImage = async () => {
    setError(null);
    setProcessedImageUri(null);
    setCurrentFilterName('Orijinal');
    setImageHistory([]);
    setCurrentHistoryIndex(-1);
    
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("İzin Gerekli", "Galeriye erişmek için izin vermeniz gerekiyor.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setOriginalImageUri(result.assets[0].uri);
      // Parlaklık ayarını aktif et
      setActiveAdjustment('brightness');
      // Varsayılan değerleri ayarla
      setBrightness(1.0);
      setContrast(1.0);
    }
  };

  // Seçilen filtreye göre aktif ayarları belirle
  const getActiveAdjustments = () => {
    switch (selectedFilter) {
      case 'mean':
      case 'median':
      case 'gaussian':
      case 'conservative':
        return ['kernel_size'];
      case 'gaussian':
        return ['kernel_size', 'sigma'];
      case 'fourier_lpf':
      case 'fourier_hpf':
        return ['cutoff'];
      case 'bandpass':
      case 'bandstop':
        return ['d0', 'w'];
      case 'butterworth_lpf':
      case 'butterworth_hpf':
        return ['d0', 'n'];
      case 'homomorphic':
        return ['gamma_l', 'gamma_h', 'd0', 'c'];
      case 'translate':
        return ['tx', 'ty'];
      case 'mirror':
        return ['axis'];
      case 'shear':
        return ['shear_x', 'shear_y'];
      case 'scale':
        return ['scale_x', 'scale_y'];
      case 'rotate':
        return ['angle'];
      case 'crop':
        return ['crop_x', 'crop_y', 'crop_width', 'crop_height'];
      default:
        return ['brightness', 'contrast'];
    }
  };

  // Filtre uygulama fonksiyonunu güncelle
  const applyFilter = async (filterId, brightnessValue = brightness, contrastValue = contrast) => {
    if (!imageUri) return;
    
    setSelectedFilter(filterId);
    setIsUploading(true);
    setError(null);

    try {
      console.log('Filtre uygulanıyor...', filterId);
      
      const formData = new FormData();
      
      // Eğer işlenmiş görüntü varsa, onu kullan, yoksa orijinal görüntüyü kullan
      const imageToProcess = processedImageUri || imageUri;
      
      // Base64 formatındaki görüntüyü işle
      if (imageToProcess.startsWith('data:image')) {
        // Base64 verisini doğrudan formData'ya ekle
        formData.append('image', imageToProcess);
      } else {
        formData.append('image', {
          uri: imageToProcess,
          name: 'photo.jpg',
          type: 'image/jpeg',
        });
      }
      
      formData.append('saveOriginal', saveOriginal.toString());
      formData.append('filter', filterId);
      formData.append('brightness', brightnessValue.toString());
      formData.append('contrast', contrastValue.toString());
      
      const activeAdjustments = getActiveAdjustments();
      activeAdjustments.forEach(adjustment => {
        const value = getActiveAdjustmentValue(adjustment);
        formData.append(adjustment, value.toString());
      });
      
      const response = await fetch(`${API_URL}/process-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
        timeout: 30000, // Timeout süresini 30 saniyeye çıkar
      });

      if (!response.ok) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.processed_image_base64) {
        throw new Error('Sunucudan geçerli veri alınamadı');
      }
      
      const newImageUri = `data:image/jpeg;base64,${data.processed_image_base64}`;
      setProcessedImageUri(newImageUri);
      
      const filterInfo = FILTERS.find(f => f.id === filterId);
      const newFilterName = filterInfo ? filterInfo.name : 'Filtre';
      setCurrentFilterName(newFilterName);
      
      // Geçmişi güncelle
      const newHistory = imageHistory.slice(0, currentHistoryIndex + 1);
      newHistory.push({
        imageUri: newImageUri,
        filterName: newFilterName,
        brightness: brightnessValue,
        contrast: contrastValue
      });
      setImageHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
      
      console.log("İşlem başarılı");

    } catch (error) {
      console.error('Hata detayı:', error);
      setError(error.message || 'Sunucuya bağlanılamadı');
      Alert.alert("Hata", `İşlem sırasında bir sorun oluştu: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  // İşlenmiş görseli galeriye kaydet
  const saveProcessedImage = async () => {
    if (!processedImageUri) return;
    
    try {
      setIsSaving(true);
      
      // İzin kontrolü
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Görseli kaydetmek için galeri izni gerekiyor.');
        setIsSaving(false);
        return;
      }

      // Base64 görselini geçici bir dosyaya kaydet
      const base64Data = processedImageUri.split('data:image/jpeg;base64,')[1];
      const fileUri = FileSystem.documentDirectory + `temp_${Date.now()}.jpg`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Dosyayı galeriye kaydet
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      
      // Başarılı mesajı göster
      Alert.alert(
        'Başarılı', 
        'Görsel galerinize kaydedildi.',
        [{ text: 'Tamam' }]
      );
      
      // Geçici dosyayı sil
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      
    } catch (error) {
      console.error('Görsel kaydederken hata:', error);
      Alert.alert('Hata', 'Görsel kaydedilirken bir sorun oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  // Ayar ikonu render fonksiyonu
  const renderAdjustmentItem = ({ item }) => {
    const isActive = activeAdjustment === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.adjustmentItem,
          isActive && styles.activeAdjustmentItem
        ]}
        onPress={() => setActiveAdjustment(isActive ? null : item.id)}
        disabled={isUploading || !processedImageUri}
      >
        <Text style={styles.adjustmentIcon}>{item.icon}</Text>
        <Text style={styles.adjustmentName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Slider için mevcut aktif ayarın değerini al
  const getActiveAdjustmentValue = () => {
    if (activeAdjustment === 'brightness') {
      return brightness;
    } else if (activeAdjustment === 'contrast') {
      return contrast;
    }
    return 1.0; // Varsayılan değer
  };

  // Slider için mevcut aktif ayarın ayarlarını al
  const getActiveAdjustmentSettings = () => {
    const adjustment = ADJUSTMENTS.find(a => a.id === activeAdjustment);
    return adjustment || ADJUSTMENTS[0]; // Bulunamazsa ilk ayarı varsayılan olarak kullan
  };

  // Slider değeri değiştiğinde çağrılır
  const handleSliderValueChange = (value) => {
    if (activeAdjustment === 'brightness') {
      setBrightness(value);
    } else if (activeAdjustment === 'contrast') {
      setContrast(value);
    }
  };

  // Parlaklık ve Kontrast için buton işleyicileri
  const handleBrightnessChange = (increment) => {
    const newValue = brightness + (increment ? 0.05 : -0.05);
    if (newValue >= 0.5 && newValue <= 2.0) {
      setBrightness(newValue);
      // Seçili filtreyi kullan
      applyFilter(selectedFilter, newValue, contrast);
    }
  };

  const handleContrastChange = (increment) => {
    const newValue = contrast + (increment ? 0.05 : -0.05);
    if (newValue >= 0.5 && newValue <= 2.0) {
      setContrast(newValue);
      // Seçili filtreyi kullan
      applyFilter(selectedFilter, brightness, newValue);
    }
  };

  // Slider kaydırma tamamlandığında çağrılır
  const handleSliderComplete = () => {
    if (imageUri && selectedFilter) {
      applyFilter(selectedFilter, brightness, contrast);
    }
  };

  // Filtre kartı render fonksiyonu
  const renderFilterItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.filterItem,
        selectedFilter === item.id && styles.selectedFilterItem
      ]}
      onPress={() => applyFilter(item.id)}
      disabled={isUploading || !imageUri}
    >
      <Text style={styles.filterIcon}>{item.icon}</Text>
      <Text style={styles.filterName}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Görüntü boyutlarını al
  const handleImageLoad = (event) => {
    const { width, height } = event.nativeEvent.source;
    console.log('Görüntü boyutları:', width, height);
    setImageDimensions({ width, height });
  };

  // Görseli büyütme fonksiyonu
  const handleImageZoom = (imageUri) => {
    setModalImageUri(imageUri);
    setIsImageModalVisible(true);
  };

  // Perspektif noktası ekle
  const handlePerspectivePoint = (event) => {
    if (!isPerspectiveMode) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // Görüntü boyutlarına göre koordinatları normalize et
    const normalizedX = (locationX / imageDimensions.width) * 100;
    const normalizedY = (locationY / imageDimensions.height) * 100;
    
    const newPoint = [normalizedX, normalizedY];
    
    if (perspectivePoints.length < 4) {
      setPerspectivePoints([...perspectivePoints, newPoint]);
      
      if (perspectivePoints.length === 3) {
        // Son nokta eklendiğinde perspektif düzeltmeyi uygula
        applyPerspectiveCorrection();
      }
    }
  };

  // Perspektif düzeltmeyi uygula
  const applyPerspectiveCorrection = async () => {
    if (perspectivePoints.length !== 4) return;

    setIsUploading(true);
    setError(null);

    // Noktaları yüzde değerlerinden piksel değerlerine çevir
    const pixelPoints = perspectivePoints.map(point => [
      (point[0] / 100) * imageDimensions.width,
      (point[1] / 100) * imageDimensions.height
    ]);

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    
    formData.append('saveOriginal', saveOriginal.toString());
    formData.append('filter', 'perspective');
    formData.append('points', JSON.stringify(pixelPoints));

    try {
      console.log('Gönderilen noktalar:', pixelPoints);
      
      const response = await fetch(`${API_URL}/process-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.processed_image_base64) {
        throw new Error('Sunucudan geçerli veri alınamadı');
      }
      
      setProcessedImageUri(`data:image/jpeg;base64,${data.processed_image_base64}`);
      setCurrentFilterName('Perspektif Düzeltme');
      
    } catch (error) {
      console.error('Hata detayı:', error);
      setError(error.message || 'Sunucuya bağlanılamadı');
      Alert.alert("Hata", `İşlem sırasında bir sorun oluştu: ${error.message}`);
    } finally {
      setIsUploading(false);
      setIsPerspectiveMode(false);
      setPerspectivePoints([]);
    }
  };

  // Perspektif modunu başlat
  const startPerspectiveMode = () => {
    setSelectedFilter('perspective');
    setIsPerspectiveMode(true);
    setPerspectivePoints([]);
    Alert.alert(
      "Perspektif Düzeltme",
      "Lütfen görüntünün dört köşesini sırasıyla seçin:\n1. Sol üst\n2. Sağ üst\n3. Sağ alt\n4. Sol alt",
      [{ text: 'Tamam' }]
    );
  };

  // Filtre seçimini güncelle
  const handleFilterSelect = (filterId) => {
    if (filterId === 'perspective') {
      startPerspectiveMode();
    } else {
      setSelectedFilter(filterId);
      setIsPerspectiveMode(false);
      setPerspectivePoints([]);
      applyFilter(filterId);
    }
  };

  // Sıfırlama fonksiyonu
  const resetImage = () => {
    if (originalImageUri) {
      setImageUri(originalImageUri);
      setProcessedImageUri(null);
      setCurrentFilterName('Orijinal');
      setImageHistory([]);
      setCurrentHistoryIndex(-1);
      setBrightness(1.0);
      setContrast(1.0);
    }
  };

  // Geri alma fonksiyonu
  const undoAction = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setProcessedImageUri(imageHistory[newIndex].imageUri);
      setCurrentFilterName(imageHistory[newIndex].filterName);
      setBrightness(imageHistory[newIndex].brightness);
      setContrast(imageHistory[newIndex].contrast);
    }
  };

  // İleri alma fonksiyonu
  const redoAction = () => {
    if (currentHistoryIndex < imageHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setProcessedImageUri(imageHistory[newIndex].imageUri);
      setCurrentFilterName(imageHistory[newIndex].filterName);
      setBrightness(imageHistory[newIndex].brightness);
      setContrast(imageHistory[newIndex].contrast);
    }
  };

  // Modal'ı kapatma fonksiyonu
  const closeImageModal = () => {
    setIsImageModalVisible(false);
    setModalImageUri(null);
  };

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const snackbarAnimation = useRef(new Animated.Value(0)).current;

  // Snackbar gösterme fonksiyonu
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
    Animated.sequence([
      Animated.timing(snackbarAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(snackbarAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSnackbarVisible(false);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          {/* Üst Kısım - Filtreler */}
          {imageUri && (
            <View style={styles.filterContainer}>
              <Text style={styles.filterTitle}>İşlem Seçenekleri</Text>
              <FlatList
                ref={flatListRef}
                data={FILTERS}
                renderItem={renderFilterItem}
                keyExtractor={(item) => item.id}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersList}
              />
            </View>
          )}

          {/* Orta Kısım - Görsel Alanı */}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={pickImage}
          >
            <Ionicons name="add" size={28} color="white" />
          </TouchableOpacity>
          
          {imageUri && !processedImageUri && (
            <TouchableOpacity 
              onPress={() => handleImageZoom(imageUri)}
              activeOpacity={0.9}
            >
              <View style={styles.imageFrame}>
                <Text style={styles.imageLabel}>Orijinal Görsel</Text>
                <Image 
                  source={{ uri: imageUri }} 
                  style={styles.image}
                  onLoad={handleImageLoad}
                />
                {isPerspectiveMode && perspectivePoints.map((point, index) => (
                  <View
                    key={index}
                    style={[
                      styles.perspectivePoint,
                      { left: point[0] - 10, top: point[1] - 10 }
                    ]}
                  >
                    <Text style={styles.perspectivePointText}>{index + 1}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          )}
          
          {processedImageUri && (
            <TouchableOpacity 
              onPress={() => handleImageZoom(processedImageUri)}
              activeOpacity={0.9}
            >
              <View style={styles.imageFrame}>
                <View style={styles.imageHeaderContainer}>
                  <Text style={styles.imageLabel}>{currentFilterName} Uygulanmış</Text>
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.undoButton]}
                      onPress={undoAction}
                      disabled={currentHistoryIndex <= 0}
                    >
                      <Ionicons name="arrow-undo" size={18} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.redoButton]}
                      onPress={redoAction}
                      disabled={currentHistoryIndex >= imageHistory.length - 1}
                    >
                      <Ionicons name="arrow-redo" size={18} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.resetButton]}
                      onPress={resetImage}
                    >
                      <Ionicons name="refresh" size={18} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={saveProcessedImage}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#4CAF50" />
                      ) : (
                        <Ionicons name="save-outline" size={18} color="#4CAF50" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                <Image 
                  source={{ uri: processedImageUri }} 
                  style={styles.image}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* Alt Kısım - Ayarlar */}
          {imageUri && (
            <View style={styles.adjustmentsContainer}>
              <Text style={styles.adjustmentsTitle}>Ayarlar</Text>
              <View style={styles.adjustmentsRow}>
                {ADJUSTMENTS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.adjustmentItem,
                      activeAdjustment === item.id && styles.activeAdjustmentItem
                    ]}
                    onPress={() => setActiveAdjustment(activeAdjustment === item.id ? null : item.id)}
                    disabled={isUploading}
                  >
                    <Text style={styles.adjustmentIcon}>{item.icon}</Text>
                    <Text style={styles.adjustmentName}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {activeAdjustment && (
                <View style={styles.adjustmentControls}>
                  {activeAdjustment === 'brightness' && (
                    <View style={styles.compactControls}>
                      <Text style={styles.adjustmentValue}>
                        Parlaklık: {brightness.toFixed(2)}x
                      </Text>
                      <View style={styles.compactButtonRow}>
                        <TouchableOpacity
                          style={[styles.compactButton, styles.decreaseButton]}
                          onPress={() => handleBrightnessChange(false)}
                          disabled={brightness <= 0.5}
                        >
                          <Text style={styles.compactButtonText}>-</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.compactButton, styles.increaseButton]}
                          onPress={() => handleBrightnessChange(true)}
                          disabled={brightness >= 2.0}
                        >
                          <Text style={styles.compactButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  {activeAdjustment === 'contrast' && (
                    <View style={styles.compactControls}>
                      <Text style={styles.adjustmentValue}>
                        Kontrast: {contrast.toFixed(2)}x
                      </Text>
                      <View style={styles.compactButtonRow}>
                        <TouchableOpacity
                          style={[styles.compactButton, styles.decreaseButton]}
                          onPress={() => handleContrastChange(false)}
                          disabled={contrast <= 0.5}
                        >
                          <Text style={styles.compactButtonText}>-</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.compactButton, styles.increaseButton]}
                          onPress={() => handleContrastChange(true)}
                          disabled={contrast >= 2.0}
                        >
                          <Text style={styles.compactButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
          
          {isUploading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>İşleniyor...</Text>
            </View>
          )}
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </ScrollView>

      {/* Snackbar */}
      {snackbarVisible && (
        <Animated.View
          style={[
            styles.snackbar,
            {
              transform: [
                {
                  translateY: snackbarAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Animated.View>
      )}

      {/* Büyük Görsel Modal */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <TouchableWithoutFeedback onPress={closeImageModal}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {modalImageUri && (
                  <Image
                    source={{ uri: modalImageUri }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
    backgroundColor: '#f5f5f5'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5'
  },
  imageFrame: {
    marginVertical: 12,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 5,
    marginBottom: 5,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    marginLeft: 4,
  },
  undoButton: {
    opacity: 0.7,
  },
  redoButton: {
    opacity: 0.7,
  },
  resetButton: {
    backgroundColor: '#ffebee',
  },
  saveButton: {
    backgroundColor: '#e8f5e9',
  },
  image: {
    width: 240,
    height: 240,
    borderRadius: 12,
  },
  loadingContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 5,
    fontSize: 10,
  },
  errorText: {
    color: 'red',
    marginTop: 5,
    textAlign: 'center',
    fontSize: 10,
  },
  filterContainer: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center'
  },
  filtersList: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterItem: {
    width: ITEM_WIDTH,
    marginHorizontal: 3,
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedFilterItem: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  filterIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  filterName: {
    fontSize: 10,
    textAlign: 'center',
  },
  adjustmentsContainer: {
    width: '100%',
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adjustmentsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center'
  },
  adjustmentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  adjustmentItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    width: '45%',
  },
  activeAdjustmentItem: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  adjustmentIcon: {
    fontSize: 14,
    marginBottom: 3,
  },
  adjustmentName: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  adjustmentControls: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  compactControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 8,
  },
  compactButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  compactButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  snackbar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  snackbarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    marginVertical: 10,
  },
  perspectivePoint: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perspectivePointText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});
