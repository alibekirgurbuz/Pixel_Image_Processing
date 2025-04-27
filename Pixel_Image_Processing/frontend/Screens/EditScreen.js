import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Button, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export default function EditScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { imageBase64, imageId } = route.params || {};
  const [isSaving, setIsSaving] = useState(false);

  const navigateToMain = () => {
    // Bu fonksiyon Ana Sayfaya dönüş işlemini yapar
    // 'Home' yerine 'Main' navigasyonuna gider, çünkü Tab Navigator Main içinde
    navigation.navigate('Main', { screen: 'Home' });
  };

  const saveImageToGallery = async () => {
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
      const base64Data = imageBase64.split('data:image/jpeg;base64,')[1];
      const fileUri = FileSystem.documentDirectory + `temp_${imageId || Date.now()}.jpg`;
      
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

  if (!imageBase64) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Görsel bulunamadı</Text>
        <Button 
          title="Ana Sayfaya Dön" 
          onPress={navigateToMain} 
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.title}>İşlenmiş Fotoğraf</Text>
        
        <Image 
          source={{ uri: imageBase64 }} 
          style={styles.image}
          resizeMode="contain"
        />
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Galeriye Kaydet" 
            onPress={saveImageToGallery}
            color="#4CAF50"
            disabled={isSaving}
          />
          
          {isSaving && (
            <ActivityIndicator 
              style={styles.loadingIndicator} 
              size="small" 
              color="#4CAF50"
            />
          )}
        </View>
        
        <Button 
          title="Ana Sayfaya Dön" 
          onPress={navigateToMain} 
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
  },
  image: {
    width: '100%',
    height: 400,
    marginBottom: 20,
    borderRadius: 8,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginLeft: 10,
  }
});
