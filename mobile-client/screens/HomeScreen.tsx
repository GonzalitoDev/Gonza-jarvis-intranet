import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ApiClient } from '../services/ApiClient';

const HomeScreen = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const isHealthy = await ApiClient.health();
      setConnected(isHealthy);
    } catch {
      setConnected(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Por favor ingresa una búsqueda');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiClient.search(query);
      if (response.data?.results) {
        setResults(response.data.results);
      } else {
        Alert.alert('Error', 'No se encontraron resultados');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Status */}
        <View style={[styles.statusBox, connected ? styles.statusOnline : styles.statusOffline]}>
          <Icon
            name={connected ? 'wifi' : 'wifi-off'}
            size={24}
            color={connected ? '#4CAF50' : '#f44336'}
          />
          <Text style={styles.statusText}>
            {connected ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Buscar información..."
            value={query}
            onChangeText={setQuery}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Icon name="magnify" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultTitle}>Resultados ({results.length})</Text>
            {results.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <Text style={styles.resultItemTitle}>{result.title || result.url}</Text>
                <Text style={styles.resultItemUrl}>{result.url}</Text>
                {result.highlights && (
                  <Text style={styles.resultItemHighlight}>{result.highlights}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <TouchableOpacity style={styles.actionButton} onPress={checkConnection}>
            <Icon name="database-check" size={20} color="#0066CC" />
            <Text style={styles.actionButtonText}>Verificar Conexión</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleSearch()}>
            <Icon name="history" size={20} color="#0066CC" />
            <Text style={styles.actionButtonText}>Últimas Búsquedas</Text>
          </TouchableOpacity>
        </View>
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
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusOnline: {
    backgroundColor: '#E8F5E9',
  },
  statusOffline: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  resultItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultItemUrl: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  resultItemHighlight: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  quickActionsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HomeScreen;
