import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Keychain from 'react-native-keychain';
import { ApiClient } from '../services/ApiClient';

const SettingsScreen = () => {
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:8765');
  const [showApiKey, setShowApiKey] = useState(false);
  const [autoCrawl, setAutoCrawl] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setApiKey(credentials.password);
      }
      // Aquí podrías cargar más configuraciones desde AsyncStorage
    } catch (error) {
      console.error('Error cargando settings:', error);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Por favor ingresa una API key');
      return;
    }

    try {
      await Keychain.setGenericPassword('jarvis-api-key', apiKey);
      ApiClient.setApiKey(apiKey);
      setSaved(true);
      Alert.alert('Éxito', 'API key guardada correctamente');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la API key');
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL del servidor');
      return;
    }

    try {
      ApiClient.setBaseURL(serverUrl);
      setSaved(true);
      Alert.alert('Éxito', 'URL del servidor actualizada');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la URL');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que quieres limpiar todos los datos?',
      [
        { text: 'Cancelar', onPress: () => {} },
        {
          text: 'Limpiar',
          onPress: async () => {
            try {
              await Keychain.resetGenericPassword();
              setApiKey('');
              Alert.alert('Éxito', 'Datos limpios');
            } catch {
              Alert.alert('Error', 'No se pudieron limpiar los datos');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Configuración</Text>

        {/* API Key Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="key" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>API Key</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ingresa tu API key"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Icon
                name={showApiKey ? 'eye' : 'eye-off'}
                size={20}
                color="#0066CC"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, saved && styles.buttonSuccess]}
            onPress={handleSaveApiKey}
          >
            <Icon name="content-save" size={20} color="#fff" />
            <Text style={styles.buttonText}>
              {saved ? 'Guardado' : 'Guardar API Key'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Server URL Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="server-network" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>Servidor</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="URL del servidor"
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSaveServerUrl}
          >
            <Icon name="content-save" size={20} color="#fff" />
            <Text style={styles.buttonText}>Guardar URL</Text>
          </TouchableOpacity>
        </View>

        {/* Options Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="cog" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>Opciones</Text>
          </View>

          <View style={styles.optionRow}>
            <View>
              <Text style={styles.optionTitle}>Auto-Crawling Activado</Text>
              <Text style={styles.optionDesc}>
                Comenzar indexación automática
              </Text>
            </View>
            <Switch
              value={autoCrawl}
              onValueChange={setAutoCrawl}
              trackColor={{ false: '#ccc', true: '#81C784' }}
              thumbColor={autoCrawl ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="information" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>Acerca de</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>JARVIS Intranet Assistant</Text>
            <Text style={styles.infoBoxVersion}>Versión 2.0.0 (Mobile)</Text>
            <Text style={styles.infoBoxDescription}>
              Herramientas de OSINT y búsqueda avanzada para redes internas
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearData}
          >
            <Icon name="trash-can" size={20} color="#f44336" />
            <Text style={styles.dangerButtonText}>Limpiar Todos los Datos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  iconButton: {
    padding: 8,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonSuccess: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBoxVersion: {
    fontSize: 12,
    color: '#0066CC',
    marginBottom: 8,
  },
  infoBoxDescription: {
    fontSize: 12,
    color: '#666',
  },
  dangerButton: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  dangerButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    height: 20,
  },
});

export default SettingsScreen;
