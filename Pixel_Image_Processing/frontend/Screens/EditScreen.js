import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Button, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EditScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { imageBase64 } = route.params || {};

  if (!imageBase64) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Görsel bulunamadı</Text>
        <Button 
          title="Ana Sayfaya Dön" 
          onPress={() => navigation.navigate('Home')} 
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
        
        <Button 
          title="Ana Sayfaya Dön" 
          onPress={() => navigation.navigate('Home')} 
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
  }
});
