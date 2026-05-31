import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import * as Keychain from 'react-native-keychain';

import HomeScreen from './screens/HomeScreen';
import OSINTScreen from './screens/OSINTScreen';
import SearchScreen from './screens/SearchScreen';
import SettingsScreen from './screens/SettingsScreen';
import { ApiClient } from './services/ApiClient';

const Tab = createBottomTabNavigator();

const App = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Verificar conexión de red
      const state = await NetInfo.fetch();
      setIsConnected(state.isConnected ?? false);

      // Obtener API key del keychain
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setApiKey(credentials.password);
        ApiClient.setApiKey(credentials.password);
      } else {
        Alert.alert(
          'Configuración Requerida',
          'Por favor ingresa tu API key en configuración'
        );
      }

      setLoading(false);
    } catch (error) {
      console.error('Error inicializando la app:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Inicializando JARVIS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName = 'help-circle';

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'OSINT') {
              iconName = focused ? 'magnify' : 'magnify';
            } else if (route.name === 'Search') {
              iconName = focused ? 'database-search' : 'database-search';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'cog' : 'cog-outline';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#0066CC',
          tabBarInactiveTintColor: '#999',
          headerStyle: styles.header,
          headerTintColor: '#fff',
          headerTitleStyle: styles.headerTitle,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'JARVIS' }}
        />
        <Tab.Screen
          name="OSINT"
          component={OSINTScreen}
          options={{ title: 'Herramientas OSINT' }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: 'Búsqueda' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Configuración' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  header: {
    backgroundColor: '#0066CC',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default App;
