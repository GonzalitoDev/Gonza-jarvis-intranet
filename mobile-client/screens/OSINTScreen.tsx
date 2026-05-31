import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SectionList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ApiClient } from '../services/ApiClient';

interface OSINTTool {
  id: string;
  name: string;
  icon: string;
  description: string;
  placeholder: string;
  function: (input: string) => Promise<any>;
}

const OSINTScreen = () => {
  const [selectedTool, setSelectedTool] = useState<OSINTTool | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const osintTools: OSINTTool[] = [
    {
      id: 'dns',
      name: 'DNS Lookup',
      icon: 'dns',
      description: 'Resuelve direcciones DNS',
      placeholder: 'ej: google.com',
      function: ApiClient.dnsMockup.bind(ApiClient),
    },
    {
      id: 'whois',
      name: 'WHOIS Lookup',
      icon: 'information-outline',
      description: 'Obtiene información WHOIS',
      placeholder: 'ej: ejemplo.com',
      function: ApiClient.whoisLookup.bind(ApiClient),
    },
    {
      id: 'ipgeo',
      name: 'IP Geolocation',
      icon: 'map-marker',
      description: 'Geolocaliza una IP',
      placeholder: 'ej: 8.8.8.8',
      function: ApiClient.ipGeolocation.bind(ApiClient),
    },
    {
      id: 'portscan',
      name: 'Port Scan',
      icon: 'network',
      description: 'Escanea puertos abiertos',
      placeholder: 'ej: example.com',
      function: ApiClient.portScan.bind(ApiClient),
    },
    {
      id: 'ssl',
      name: 'SSL Check',
      icon: 'lock-check',
      description: 'Verifica certificado SSL',
      placeholder: 'ej: ejemplo.com',
      function: ApiClient.sslCheck.bind(ApiClient),
    },
    {
      id: 'headers',
      name: 'HTTP Headers',
      icon: 'file-document',
      description: 'Obtiene headers HTTP',
      placeholder: 'ej: https://ejemplo.com',
      function: ApiClient.httpHeaders.bind(ApiClient),
    },
    {
      id: 'subdomains',
      name: 'Subdomain Enum',
      icon: 'folder-network',
      description: 'Enumera subdominios',
      placeholder: 'ej: ejemplo.com',
      function: ApiClient.subdomainEnum.bind(ApiClient),
    },
    {
      id: 'email',
      name: 'Email Breach Check',
      icon: 'email-alert',
      description: 'Verifica si email fue comprometido',
      placeholder: 'ej: correo@ejemplo.com',
      function: ApiClient.emailBreachCheck.bind(ApiClient),
    },
    {
      id: 'discord',
      name: 'Discord Scanner',
      icon: 'discord',
      description: 'Detecta tokens, webhooks, phishing y contenido ilegal',
      placeholder: 'Pega el mensaje de Discord aqui...',
      function: ApiClient.discordScan.bind(ApiClient),
    },
  ];

  const handleSelectTool = (tool: OSINTTool) => {
    setSelectedTool(tool);
    setInput('');
    setResult(null);
  };

  const handleExecuteTool = async () => {
    if (!input.trim()) {
      Alert.alert('Error', 'Por favor ingresa un valor');
      return;
    }

    if (!selectedTool) return;

    setLoading(true);
    try {
      const response = await selectedTool.function(input);
      setResult(response.data || response);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error ejecutando herramienta');
    } finally {
      setLoading(false);
    }
  };

  if (selectedTool) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          {/* Header */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedTool(null)}
          >
            <Icon name="arrow-left" size={24} color="#0066CC" />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>

          {/* Tool Info */}
          <View style={styles.toolInfo}>
            <Icon name={selectedTool.icon} size={40} color="#0066CC" />
            <Text style={styles.toolName}>{selectedTool.name}</Text>
            <Text style={styles.toolDesc}>{selectedTool.description}</Text>
          </View>

          {/* Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.input}
              placeholder={selectedTool.placeholder}
              value={input}
              onChangeText={setInput}
              editable={!loading}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[styles.executeButton, loading && styles.buttonDisabled]}
              onPress={handleExecuteTool}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="play" size={20} color="#fff" />
                  <Text style={styles.executeButtonText}>Ejecutar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Result */}
          {result && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Resultado:</Text>
              <ScrollView style={styles.resultBox}>
                <Text style={styles.resultText}>
                  {JSON.stringify(result, null, 2)}
                </Text>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Selecciona una herramienta</Text>
        {osintTools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={styles.toolCard}
            onPress={() => handleSelectTool(tool)}
          >
            <Icon name={tool.icon} size={32} color="#0066CC" />
            <View style={styles.toolCardContent}>
              <Text style={styles.toolCardName}>{tool.name}</Text>
              <Text style={styles.toolCardDesc}>{tool.description}</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        ))}
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#0066CC',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toolCardContent: {
    flex: 1,
    marginLeft: 16,
  },
  toolCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toolCardDesc: {
    fontSize: 12,
    color: '#666',
  },
  toolInfo: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
  },
  toolName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  toolDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 14,
  },
  executeButton: {
    flexDirection: 'row',
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  executeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resultContainer: {
    marginTop: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'Courier',
  },
});

export default OSINTScreen;
