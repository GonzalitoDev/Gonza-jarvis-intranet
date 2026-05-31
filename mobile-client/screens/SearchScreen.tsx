import React from 'react';
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

const SearchScreen = () => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Por favor ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await ApiClient.search(query);
      if (response.data?.results) {
        setResults(response.data.results);
      } else {
        setResults([]);
        Alert.alert('Sin resultados', 'No se encontraron resultados para tu búsqueda');
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
        <Text style={styles.title}>Búsqueda Avanzada</Text>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Escribe aquí para buscar..."
            value={query}
            onChangeText={setQuery}
            editable={!loading}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="magnify" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {searched && results.length === 0 && !loading && (
          <View style={styles.noResults}>
            <Icon name="magnify" size={48} color="#ccc" />
            <Text style={styles.noResultsText}>No se encontraron resultados</Text>
          </View>
        )}

        {results.map((result, index) => (
          <View key={index} style={styles.resultCard}>
            <View style={styles.resultCardHeader}>
              <Text style={styles.resultCardTitle} numberOfLines={2}>
                {result.title}
              </Text>
              {result.score && (
                <View style={styles.scoreTag}>
                  <Text style={styles.scoreText}>
                    {Math.round(result.score)}%
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.resultCardUrl} numberOfLines={1}>
              {result.url}
            </Text>
            {result.highlights && (
              <Text style={styles.resultCardHighlight} numberOfLines={3}>
                {result.highlights}
              </Text>
            )}
            <TouchableOpacity style={styles.viewButton}>
              <Icon name="open-in-new" size={16} color="#0066CC" />
              <Text style={styles.viewButtonText}>Ver Página</Text>
            </TouchableOpacity>
          </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: '#0066CC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  scoreTag: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  resultCardUrl: {
    fontSize: 12,
    color: '#0066CC',
    marginBottom: 8,
  },
  resultCardHighlight: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '600',
  },
});

export default SearchScreen;
