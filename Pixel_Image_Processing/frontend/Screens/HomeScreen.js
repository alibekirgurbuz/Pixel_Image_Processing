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
  Platform
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
  { id: 'gray', name: 'Gri Ton', icon: '🌫️', description: 'Gri tonlama filtresi uygular' },
  { id: 'negative', name: 'Negatif', icon: '🔄', description: 'Negatif görüntü filtresi' },
  { id: 'threshold', name: 'Eşikleme', icon: '⚪', description: 'Eşikleme filtresi uygular' },
  { id: 'histogram', name: 'Histogram', icon: '📈', description: 'Histogram eşitleme uygular' },
  { id: 'rgb_split', name: 'RGB\'ye Ayır', icon: '🎨', description: 'RGB kanallarını ayrıştırır' },
  { id: 'warm', name: 'Sıcak', icon: '🔥', description: 'Sıcak renk tonu filtresi uygular' },
  { id: 'cold', name: 'Soğuk', icon: '❄️', description: 'Soğuk renk tonu filtresi uygular' },
];

// Ayarlanabilir parametreler (İkonlar ve Sliderlar için)
const ADJUSTMENTS = [
  { id: 'brightness', name: 'Parlaklık', icon: '☀️', min: 0.5, max: 2.0, step: 0.05, defaultValue: 1.0 },
  { id: 'contrast', name: 'Kontrast', icon: '📊', min: 0.5, max: 2.0, step: 0.05, defaultValue: 1.0 },
];

// Ekran genişliğine göre grid boyutu ayarla
const { width } = Dimensions.get('window');
const ITEM_WIDTH = 80; // Yatay liste için eleman genişliği

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [saveOriginal, setSaveOriginal] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('gray'); // Varsayılan filtre
  const [processedImageUri, setProcessedImageUri] = useState(null); // İşlenmiş görsel için state
  const [currentFilterName, setCurrentFilterName] = useState('Orijinal'); // Mevcut filtre adı
  const [isSaving, setIsSaving] = useState(false); // Kaydetme durumu için state
  const [brightness, setBrightness] = useState(1.0); // Parlaklık değeri için state
  const [contrast, setContrast] = useState(1.0); // Kontrast değeri için state
  const [activeAdjustment, setActiveAdjustment] = useState(null); // Aktif ayar için state
  
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
    }
  };

  // Seçilen filtreyi uygula
  const applyFilter = async (filterId, brightnessValue = brightness, contrastValue = contrast) => {
    if (!imageUri) return;
    
    setSelectedFilter(filterId);
    setIsUploading(true);
    setError(null);
  
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    
    // Ayarlar bilgisini ekle
    formData.append('saveOriginal', saveOriginal.toString());
    formData.append('filter', filterId);
    formData.append('brightness', brightnessValue.toString()); // Parlaklık değerini ekle
    formData.append('contrast', contrastValue.toString()); // Kontrast değerini ekle
    
    try {
      console.log('Filtre uygulanıyor...', filterId, 'Parlaklık:', brightnessValue, 'Kontrast:', contrastValue);
      
      const response = await fetch(`${API_URL}/process-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
        timeout: 15000, // 15 saniye zaman aşımı
      });
  
      if (!response.ok) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.processed_image_base64) {
        throw new Error('Sunucudan geçerli veri alınamadı');
      }
      
      // İşlenmiş görseli göster
      setProcessedImageUri(`data:image/jpeg;base64,${data.processed_image_base64}`);
      
      // Filtre adını güncelle
      const filterInfo = FILTERS.find(f => f.id === filterId);
      setCurrentFilterName(filterInfo ? filterInfo.name : 'Filtre');
      
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          {/* Fotoğraf Seç artı butonu */}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={pickImage}
          >
            <Ionicons name="add" size={28} color="white" />
          </TouchableOpacity>
          
          {imageUri && !processedImageUri && (
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Orijinal Görsel</Text>
              <Image 
                source={{ uri: imageUri }} 
                style={styles.image}
              />
            </View>
          )}
          
          {processedImageUri && (
            <View style={styles.imageContainer}>
              <View style={styles.imageHeaderContainer}>
                <Text style={styles.imageLabel}>{currentFilterName} Uygulanmış</Text>
                <TouchableOpacity 
                  style={styles.saveButton}
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
              <Image 
                source={{ uri: processedImageUri }} 
                style={styles.image}
              />
            </View>
          )}
          
          {imageUri && (
            <View style={styles.filterContainer}>
              <Text style={styles.filterTitle}>İşlemi Seçin:</Text>
              <FlatList
                ref={flatListRef}
                data={FILTERS}
                renderItem={renderFilterItem}
                keyExtractor={(item) => item.id}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersList}
                pagingEnabled={false}
                disableIntervalMomentum={true}
                decelerationRate="fast"
                snapToOffsets={FILTERS.map((_, i) => (i * (ITEM_WIDTH + 6)))}
                snapToAlignment="start"
                onScrollEndDrag={e => {
                  const scrollX = e.nativeEvent.contentOffset.x;
                  const itemIndex = Math.round(scrollX / (ITEM_WIDTH + 6));
                  flatListRef.current?.scrollToOffset({
                    offset: itemIndex * (ITEM_WIDTH + 6),
                    animated: true
                  });
                }}
              />
            </View>
          )}
          
          {processedImageUri && (
            <View style={styles.adjustmentsContainer}>
              <Text style={styles.adjustmentsTitle}>Ayarlar:</Text>
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
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderValue}>
                    {activeAdjustment === 'brightness' ? 'Parlaklık' : 'Kontrast'}: 
                    {getActiveAdjustmentValue().toFixed(2)}x
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={getActiveAdjustmentSettings().min}
                    maximumValue={getActiveAdjustmentSettings().max}
                    step={getActiveAdjustmentSettings().step}
                    value={getActiveAdjustmentValue()}
                    onValueChange={handleSliderValueChange}
                    onSlidingComplete={handleSliderComplete}
                    minimumTrackTintColor="#4CAF50"
                    maximumTrackTintColor="#000000"
                    thumbTintColor="#4CAF50"
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderMinLabel}>{getActiveAdjustmentSettings().min}x</Text>
                    <Text style={styles.sliderMaxLabel}>{getActiveAdjustmentSettings().max}x</Text>
                  </View>
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
  imageContainer: {
    marginVertical: 8,
    alignItems: 'center',
    width: '100%',
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
  saveButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: 6,
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
    marginBottom: 8,
    marginTop: 8,
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
  // Ayarlar için stiller
  adjustmentsContainer: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
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
  sliderContainer: {
    padding: 6,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginTop: 4,
  },
  sliderValue: {
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 25,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  sliderMinLabel: {
    fontSize: 8,
    color: '#666',
  },
  sliderMaxLabel: {
    fontSize: 8,
    color: '#666',
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
});
