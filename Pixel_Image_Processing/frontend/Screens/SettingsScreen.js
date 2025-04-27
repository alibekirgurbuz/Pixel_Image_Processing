import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [saveOriginal, setSaveOriginal] = useState(true);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ayarlar</Text>
      
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Karanlık Mod</Text>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
        />
      </View>
      
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Bildirimler</Text>
        <Switch
          value={notifications}
          onValueChange={setNotifications}
        />
      </View>
      
      <View style={styles.settingItem}>
        <Text style={styles.settingText}>Orijinal Görseli Sakla</Text>
        <Switch
          value={saveOriginal}
          onValueChange={setSaveOriginal}
        />
      </View>

      <Text style={styles.version}>Sürüm 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
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
    borderBottomColor: '#e0e0e0',
  },
  settingText: {
    fontSize: 16,
  },
  version: {
    marginTop: 40,
    textAlign: 'center',
    color: '#888',
  }
});
