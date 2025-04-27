import React, { useState } from 'react';
import { View, Button, Image, Alert, ActivityIndicator, Platform, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';

// API URL'si - sunucu adresi olarak gerçek IP adresi
const API_URL = 'http://192.168.1.50:5000'; // Sunucunun gerçek IP adresi

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const route = useRoute();
  const selectedImageUri = route?.params?.imageUri;

  const pickImage = async () => {
    setError(null);
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

  const navigation = useNavigation();

  const uploadImage = async () => {
    if (!imageUri) return;
  
    setIsUploading(true);
    setError(null);
  
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });

    try {
      console.log('Sunucuya bağlanılıyor...', `${API_URL}/process-image`);
      
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
  
      // Edit ekranına yönlendir ve işlenmiş görseli gönder
      navigation.navigate('Edit', {
        imageBase64: `data:image/jpeg;base64,${data.processed_image_base64}`
      });
      
      console.log("İşlem başarılı");
  
    } catch (error) {
      console.error('Hata detayı:', error);
      setError(error.message || 'Sunucuya bağlanılamadı');
      Alert.alert("Hata", `Sunucuya bağlanılamadı: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Fotoğraf Seç" onPress={pickImage} />
      {imageUri && <Image source={{ uri: imageUri }} style={{ width: 300, height: 300, marginVertical: 20 }} />}
      {imageUri && <Button title="Fotoğrafı Gönder ve İşle" onPress={uploadImage} />}
      {isUploading && <ActivityIndicator size="large" />}
      {error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}
    </View>
  );
}
