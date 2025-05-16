// Substituir o conteúdo do arquivo CorridaScreen.js por uma versão adaptada
// para uso com MapboxGL e sistema de busca com autocomplete conforme solicitado.
// O novo conteúdo está extenso e requer substituição integral da tela anterior baseada em react-native-maps.

// Como essa substituição é extensa e afeta toda a renderização, hooks, estados e integrações do componente,
// vou iniciar a reescrita completa em um novo documento, com base nos pontos de modificação detalhados.

// Iniciar reescrita completa agora...

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, TRANSPORT_MODALITIES } from '../constants/theme';

import Constants from 'expo-constants';
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || Constants.expoConfig.extra?.mapboxAccessToken;

const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/streets-v11';
const MAPBOX_SEARCH_API_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

const CorridaScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [locationSearchText, setLocationSearchText] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);

  const mapRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  const fetchLocationSuggestions = async (query) => {
    if (!query) return;
    setIsSearchingLocations(true);
    try {
      const res = await fetch(`${MAPBOX_SEARCH_API_URL}?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}`);
      const data = await res.json();
      setLocationSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Erro ao buscar sugestões:', err);
    } finally {
      setIsSearchingLocations(false);
    }
  };

  const selectLocationFromSuggestion = async (item) => {
    if (!item || !item.coordinates) return;
    const [lng, lat] = item.coordinates;
    const selectedCoords = [lng, lat];
    setDestination(selectedCoords);
    setLocationSearchText(item.name);
    setLocationSuggestions([]);

    // Ajustar a câmera do Mapbox
    mapRef.current?.setCamera({ centerCoordinate: selectedCoords, zoomLevel: 14, animationDuration: 1000 });
  };

  useEffect(() => {
    if (locationSearchText.length > 2) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        fetchLocationSuggestions(locationSearchText);
      }, 500);
    } else {
      setLocationSuggestions([]);
    }
    return () => clearTimeout(debounceTimeoutRef.current);
  }, [locationSearchText]);

  useEffect(() => {
    // Obter localização inicial do usuário
    (async () => {
      try {
        const granted = await MapboxGL.requestAndroidLocationPermissions();
        if (!granted) return;
        const userLocation = await MapboxGL.locationManager.getLastKnownLocation();
        if (userLocation) {
          setCurrentLocation([userLocation.coords.longitude, userLocation.coords.latitude]);
        }
      } catch (error) {
        console.error('Erro ao obter localização inicial:', error);
      }
    })();
  }, []);

  const handleMapPress = async (e) => {
    if (!e?.geometry?.coordinates) return;
    setDestination(e.geometry.coordinates);
    mapRef.current?.setCamera({ centerCoordinate: e.geometry.coordinates, zoomLevel: 14, animationDuration: 1000 });
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MAPBOX_STYLE_URL}
        onPress={handleMapPress}
      >
        <MapboxGL.Camera
          zoomLevel={14}
          centerCoordinate={destination || currentLocation || [-46.57421, -21.78574]}
          animationMode="flyTo"
          animationDuration={1000}
        />
        <MapboxGL.UserLocation visible={true} />
        {destination && (
          <MapboxGL.PointAnnotation id="destination" coordinate={destination}>
            <View style={styles.marker} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      <View style={styles.autocompleteContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Digite um endereço..."
          value={locationSearchText}
          onChangeText={setLocationSearchText}
        />
        {isSearchingLocations && <ActivityIndicator style={styles.loadingIndicator} />}
        <FlatList
          data={locationSuggestions}
          keyExtractor={(item) => item.mapbox_id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => selectLocationFromSuggestion(item)} style={styles.suggestionItem}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    width: 24,
    height: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  autocompleteContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    zIndex: 10,
  },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  loadingIndicator: { marginVertical: 10 },
  suggestionItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});

export default CorridaScreen;

