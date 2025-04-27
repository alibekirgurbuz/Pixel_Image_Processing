import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, StatusBar, useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const systemColorScheme = useColorScheme();
  const isFocused = useIsFocused();

  // Ayarları yükle
  useEffect(() => {
    loadSettings();
  }, []);

  // Ayarları kaydet ve uygula
  useEffect(() => {
    saveSettings();
    applyDarkMode();
  }, [darkMode]);

  // Ekran odaklandığında tema ayarını yeniden uygula
  useEffect(() => {
    if (isFocused) {
      applyDarkMode();
    }
  }, [isFocused]);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setDarkMode(parsedSettings.darkMode || false);
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings = {
        darkMode
      };
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
    }
  };

  // Dark Mode'u uygula
  const applyDarkMode = () => {
    StatusBar.setBarStyle(darkMode ? 'light-content' : 'dark-content');
    // Android için arka plan rengini de değiştirebiliriz
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(darkMode ? 'black' : '#FFFFFF');
    }
  };

  return (
    <ScrollView 
      style={[
        styles.container, 
        { backgroundColor: darkMode ? '#121212' : '#f5f5f5' }
      ]}
    >
      <Text style={[
        styles.title, 
        { color: darkMode ? '#FFFFFF' : '#000000' }
      ]}>
        Ayarlar
      </Text>
      
      <View style={[
        styles.settingItem, 
        { borderBottomColor: darkMode ? '#333333' : '#e0e0e0' }
      ]}>
        <Text style={[
          styles.settingText, 
          { color: darkMode ? '#FFFFFF' : '#000000' }
        ]}>
          Karanlık Mod
        </Text>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
          trackColor={{ false: "#767577", true: "#4CAF50" }}
        />
      </View>

      <View style={styles.appInfoContainer}>
        <Text style={[
          styles.appInfo, 
          { color: darkMode ? '#BBBBBB' : '#666666' }
        ]}>
          Bu uygulama, fotoğraflarınıza filtreler uygulamanızı sağlar.
          Filtrelenmiş görseller cihazınıza kaydedilebilir.
        </Text>
      </View>

      <Text style={[
        styles.version, 
        { color: darkMode ? '#888888' : '#888888' }
      ]}>
        Sürüm 1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  settingText: {
    fontSize: 16,
  },
  version: {
    marginTop: 40,
    textAlign: 'center',
  },
  appInfoContainer: {
    marginTop: 30,
    padding: 15,
    borderRadius: 8,
  },
  appInfo: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  }
});
