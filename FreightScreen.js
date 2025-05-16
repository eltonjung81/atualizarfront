// FreightScreen refatorado com Mapbox e Autocomplete integrado no modal
import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, SafeAreaView, Modal, FlatList, Image
} from 'react-native';

import MapboxGL from "@rnmapbox/maps";
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

const MAPBOX_PUBLIC_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || Constants.expoConfig.extra.mapboxAccessToken;

if (MAPBOX_PUBLIC_ACCESS_TOKEN) {
  MapboxGL.setAccessToken(MAPBOX_PUBLIC_ACCESS_TOKEN);
} else {
  console.error("Mapbox Access Token not found. Map features may not work.");
  Alert.alert("Erro", "Chave Mapbox não encontrada. Funcionalidades de mapa podem não funcionar.");
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const IS_IOS = Platform.OS === 'ios';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#ffa726',
  secondary: '#42a5f5',
  success: '#4caf50',
  danger: '#f44336',
  white: '#fff',
  black: '#000',
  dark: '#1e1e1e',
  surface: '#2e2e2e',
  border: '#444',
  textPrimary: '#fff',
  textSecondary: '#dcdcdc',
  textHint: '#aaa',
};

const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/dark-v11';

const COLOR_COLETA = COLORS.success;
const COLOR_ENTREGA = COLORS.danger;
const COLOR_USER = COLORS.primary;
const COLOR_ROUTE_LINE = COLORS.primary;

const MARKER_SIZE = 30;

const MAPBOX_SEARCH_API_URL = 'https://api.mapbox.com/search/v3/';

const initialState = {
  step: 1,
  description: '',
  pickup: null,
  delivery: null,
  scheduling: 'now',
  scheduledDate: null,
  loading: false,
  currentLocation: null,
  showDatePicker: false,

  locationSearchText: '',
  locationSuggestions: [],
  isSearchingLocations: false,

  isLocationPermissionGranted: null,
  initialLoading: true,
  appStateError: null,
};

function reducer(state, action) {
  return { ...state, ...action };
}

export default function FreightScreenModern() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingPickup, setSelectingPickup] = useState(true);
  const mapModalRef = useRef(null);
  const mapSummaryRef = useRef(null);

  useEffect(() => {
    const requestLocationPermissionAndGetLocation = async () => {
      dispatch({ initialLoading: true });
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Não foi possível acessar sua localização. Funcionalidades baseadas em localização podem não funcionar.', [
            { text: 'OK', onPress: () => dispatch({ isLocationPermissionGranted: false, initialLoading: false }) },
            // { text: 'Configurações', onPress: openAppSettings } // Implement openAppSettings if needed
          ]);
          dispatch({ isLocationPermissionGranted: false, initialLoading: false });
          return;
        }
        dispatch({ isLocationPermissionGranted: true });

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000,
        });

        const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        dispatch({ currentLocation: coords, initialLoading: false });
        console.log("Localização atual obtida:", coords);

      } catch (error) {
        console.error("Erro ao obter localização inicial:", error);
        Alert.alert("Erro de Localização", "Não foi possível obter sua localização atual. Algumas funcionalidades como 'Usar minha localização' podem não funcionar.", [
          { text: 'OK', onPress: () => dispatch({ currentLocation: null, initialLoading: false, appStateError: "Failed to get initial location" }) }
        ]);
        dispatch({ currentLocation: null, initialLoading: false, appStateError: "Failed to get initial location" });
      }
    };

    if (state.isLocationPermissionGranted === null) {
      requestLocationPermissionAndGetLocation();
    }

  }, [state.isLocationPermissionGranted]);

  useEffect(() => {
    if (modalVisible && mapModalRef.current) {
      const targetCoord = selectingPickup ? (state.pickup || state.currentLocation) : (state.delivery || state.currentLocation);

      console.log("[MapModal Effect] Modal Visível. Selecionando:", selectingPickup ? 'Coleta' : 'Entrega');

      if (targetCoord) {
        console.log("[MapModal Effect] Animando para:", targetCoord.latitude, targetCoord.longitude);
        try {
          mapModalRef.current.setCamera({
            centerCoordinate: [targetCoord.longitude, targetCoord.latitude],
            zoomLevel: selectingPickup ? 15 : 12,
            animationDuration: 800,
          });
        } catch (error) {
          console.error("Erro ao animar câmera inicial/modal:", error);
        }
      } else {
        console.log("[MapModal Effect] Animando para padrão (Brasília)");
        try {
          mapModalRef.current.setCamera({
            centerCoordinate: [-47.93, -15.78],
            zoomLevel: 11,
            animationDuration: 800,
          });
        } catch (e) { console.error("Erro ao animar câmera modal padrão:", e); }
      }

      dispatch({ locationSearchText: '', locationSuggestions: [], isSearchingLocations: false });
    } else if (!modalVisible) {

    }
  }, [modalVisible, state.currentLocation, state.pickup, state.delivery, selectingPickup]);

  useEffect(() => {
    const geocode = async (coords, isPickup) => {
      if (!coords || (coords.address !== undefined && coords.address !== null)) return;

      console.log("[Geocode Effect] Fazendo geocode reverso para:", coords, isPickup ? 'pickup' : 'delivery');
      try {
        const accessToken = MAPBOX_PUBLIC_ACCESS_TOKEN;
        if (!accessToken) {
          console.error("Chave Mapbox não disponível para geocode reverso.");
          if (isPickup) dispatch({ pickup: { ...coords, address: "Erro: Chave Mapbox" } });
          else dispatch({ delivery: { ...coords, address: "Erro: Chave Mapbox" } });
          return;
        }

        const url = `${MAPBOX_SEARCH_API_URL}reverse_geocode?longitude=${coords.longitude}&latitude=${coords.latitude}&access_token=${accessToken}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`[Geocode Effect] API Error ${response.status}:`, await response.text());
          throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const address = data.features[0].properties.full_address || data.features[0].properties.place_formatted || data.features[0].text;
          console.log(`[Geocode Effect] Endereço encontrado para ${isPickup ? 'pickup' : 'delivery'}:`, address);
          if (isPickup) {
            dispatch({ pickup: { ...coords, address: address } });
          } else {
            dispatch({ delivery: { ...coords, address: address } });
          }
        } else {
          console.warn(`[Geocode Effect] Nenhum endereço encontrado para ${isPickup ? 'pickup' : 'delivery'} nas coords.`, coords);
          if (isPickup) dispatch({ pickup: { ...coords, address: "Endereço não encontrado" } });
          else dispatch({ delivery: { ...coords, address: "Endereço não encontrado" } });
        }

      } catch (error) {
        console.error(`[Geocode Effect] Erro ao fazer geocode reverso para ${isPickup ? 'pickup' : 'delivery'}:`, error);
        if (isPickup) dispatch({ pickup: { ...coords, address: "Erro ao buscar endereço" } });
        else dispatch({ delivery: { ...coords, address: "Erro ao buscar endereço" } });
      }
    };

    if (state.pickup?.latitude && state.pickup?.longitude && state.pickup.address === undefined) {
      geocode(state.pickup, true);
    }
    if (state.delivery?.latitude && state.delivery?.longitude && state.delivery.address === undefined) {
      geocode(state.delivery, false);
    }
  }, [state.pickup?.latitude, state.pickup?.longitude, state.delivery?.latitude, state.delivery?.longitude]);

  const debounceTimeoutRef = useRef(null);

  const fetchLocationSuggestions = useCallback(async (text) => {
    if (text.length < 3) {
      dispatch({ locationSuggestions: [] });
      return;
    }
    dispatch({ isSearchingLocations: true });

    try {
      const accessToken = MAPBOX_PUBLIC_ACCESS_TOKEN;
      if (!accessToken) {
        console.error("Chave Mapbox não disponível para autocomplete.");
        dispatch({ isSearchingLocations: false });
        return;
      }
      const query = encodeURIComponent(text);
      const proximity = state.currentLocation ?
        `&proximity=${state.currentLocation.longitude},${state.currentLocation.latitude}` : '';

      const url = `${MAPBOX_SEARCH_API_URL}autofill?q=${query}${proximity}&access_token=${accessToken}`;

      console.log("[Autocomplete] Chamando API:", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();

      if (data.suggestions) {
        dispatch({ locationSuggestions: data.suggestions });
      } else {
        dispatch({ locationSuggestions: [] });
      }

    } catch (error) {
      console.error("[Autocomplete] Erro ao buscar sugestões:", error);
      dispatch({ locationSuggestions: [] });
    } finally {
      dispatch({ isSearchingLocations: false });
    }
  }, [state.currentLocation]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (state.locationSearchText.length >= 3) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchLocationSuggestions(state.locationSearchText);
      }, 500);
    } else {
      dispatch({ locationSuggestions: [], isSearchingLocations: false });
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [state.locationSearchText, fetchLocationSuggestions]);

  const selectLocationFromSuggestion = useCallback(async (suggestion) => {
    console.log("[Autocomplete Select] Selecionada:", suggestion);

    dispatch({ isSearchingLocations: true, locationSuggestions: [] });

    try {
      const accessToken = MAPBOX_PUBLIC_ACCESS_TOKEN;
      if (!accessToken) {
        console.error("Chave Mapbox não disponível para retrieve.");
        dispatch({ isSearchingLocations: false });
        return;
      }

      const url = `${MAPBOX_SEARCH_API_URL}retrieve/${suggestion.mapbox_id}?access_token=${accessToken}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Autocomplete Retrieve] API Error ${response.status}:`, await response.text());
        throw new Error(`API Error: ${response.status}`);
      }
      const data = await response.json();
      console.log("[Autocomplete Retrieve] Resultados:", data.features);

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [longitude, latitude] = feature.geometry.coordinates;
        const address = feature.properties?.place_formatted || feature.properties?.full_address || feature.text;

        const selectedCoord = { latitude, longitude, address };

        if (selectingPickup) {
          dispatch({ pickup: selectedCoord });
        } else {
          dispatch({ delivery: selectedCoord });
        }
        console.log(`Local selecionado via autocomplete (${selectingPickup ? 'Coleta' : 'Entrega'}):`, selectedCoord);

        if (mapModalRef.current) {
          try {
            mapModalRef.current.setCamera({
              centerCoordinate: [longitude, latitude],
              zoomLevel: 16,
              animationDuration: 800,
            });
          } catch (e) { console.error("Erro ao animar câmera após selecionar autocomplete:", e); }
        }

        dispatch({ locationSearchText: '', locationSuggestions: [] });

      } else {
        console.warn("Retrieve failed or no feature found for suggestion:", suggestion);
        Alert.alert("Erro na Seleção", "Não foi possível obter os detalhes do local. Tente buscar novamente ou clique no mapa.");
      }

    } catch (error) {
      console.error("Erro no processo de seleção/retrieve do autocomplete:", error);
      Alert.alert("Erro na Busca", "Não foi possível buscar detalhes do local. Tente novamente.");
    } finally {
      dispatch({ isSearchingLocations: false });
    }
  }, [selectingPickup, mapModalRef]);

  const onMapPress = useCallback((event) => {
    console.log("[Map Press] Coordenadas:", event.geometry.coordinates);
    const [longitude, latitude] = event.geometry.coordinates;
    const tappedCoord = { latitude, longitude };

    if (selectingPickup) {
      dispatch({ pickup: { ...tappedCoord, address: undefined } });
    } else {
      dispatch({ delivery: { ...tappedCoord, address: undefined } });
    }

    if (mapModalRef.current) {
      try {
        mapModalRef.current.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: 16,
          animationDuration: 400,
        });
      } catch (e) { console.error("Erro ao animar câmera após clique no mapa:", e); }
    }
  }, [selectingPickup, mapModalRef]);

  const confirmLocation = useCallback(() => {
    console.log("[Confirm Location] Confirmando:", selectingPickup ? state.pickup : state.delivery);

    const confirmedLocation = selectingPickup ? state.pickup : state.delivery;
    if (!confirmedLocation?.latitude || !confirmedLocation?.longitude) {
      Alert.alert("Erro", "Por favor, selecione um local no mapa ou use a busca.");
      return;
    }

    setModalVisible(false);

    // Passar para o próximo passo APENAS SE for a segunda localização a ser confirmada
    // Se for a primeira (pickup), a UI principal exibirá o botão para selecionar delivery.
    // Se for a segunda (delivery), aí sim pode ir para o passo 4 (agendamento).
    // Simplificado: sempre que confirmar, chama proceedToNext, que decidirá para onde ir
    proceedToNext();

  }, [selectingPickup, state.pickup, state.delivery, proceedToNext]);

  const useMyLocation = useCallback(() => {
    if (!state.currentLocation) {
      Alert.alert("Erro", "Sua localização atual não está disponível.");
      return;
    }
    if (!selectingPickup) {
      Alert.alert("Aviso", "Esta opção só está disponível para o local de coleta.");
      return;
    }

    console.log("[Use My Location] Usando:", state.currentLocation);
    dispatch({ pickup: { ...state.currentLocation, address: undefined } });

    if (mapModalRef.current) {
      try {
        mapModalRef.current.setCamera({
          centerCoordinate: [state.currentLocation.longitude, state.currentLocation.latitude],
          zoomLevel: 16,
          animationDuration: 800,
        });
      } catch (e) { console.error("Erro ao animar câmera para minha localização:", e); }
    }
  }, [state.currentLocation, selectingPickup, mapModalRef]);

  const openMapModal = useCallback((isPickup) => {
    setSelectingPickup(isPickup);
    setModalVisible(true);
  }, []);

  const proceedToNext = useCallback(() => {
    if (state.step === 1) {
      if (!state.description.trim()) {
        Alert.alert("Campo Vazio", "Por favor, descreva a carga.");
        return;
      }
      dispatch({ step: 2 });
      return;
    }

    if (state.step === 2 || state.step === 3) {
      // Se veio de um Confirmar Local do modal:
      // Verifica se agora tem pickup E delivery. Se tiver, vai para step 4.
      // Se não tiver algum dos dois, a UI principal já mostrará o botão para selecionar o local faltante.
       if (state.pickup && state.delivery) {
         dispatch({ step: 4 });
         return;
       }
       // Se confirmou um local, mas o outro ainda falta, permanece no passo 2/3
       // A UI principal (fora do modal) mostrará o estado correto e o botão para abrir o modal para o local que falta.
       console.log("Confirmou um local, mas o outro ainda falta. Permanece no passo de seleção.");
       return;
    }

    if (state.step === 4) {
      if (state.scheduling === 'schedule' && !state.scheduledDate) {
        Alert.alert("Data de Agendamento", "Por favor, escolha a data e hora do agendamento.");
        return;
      }
      dispatch({ step: 5 });
      return;
    }

    // Após step 5, o próximo passo é confirmRequest (não proceedToNext)
  }, [state.step, state.description, state.pickup, state.delivery, state.scheduling, state.scheduledDate]);

  const confirmRequest = useCallback(async () => {
    if (!state.description.trim() || !state.pickup?.latitude || !state.delivery?.latitude || (state.scheduling === 'schedule' && !state.scheduledDate)) {
      Alert.alert("Erro", "Por favor, preencha todos os dados necessários.");
      return;
    }

    dispatch({ loading: true });

    try {
      console.log("Simulando envio da solicitação de frete:", {
        description: state.description,
        pickup: state.pickup,
        delivery: state.delivery,
        scheduling: state.scheduling,
        scheduledDate: state.scheduling === 'schedule' ? state.scheduledDate?.toISOString() : null,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert("Sucesso!", "Sua solicitação de frete foi enviada com sucesso.", [
        { text: "OK", onPress: () => dispatch(initialState) }
      ]);

    } catch (error) {
      console.error("Erro ao enviar solicitação de frete:", error);
      Alert.alert("Erro", "Não foi possível enviar sua solicitação. Tente novamente mais tarde.");
    } finally {
      dispatch({ loading: false });
    }

  }, [state.description, state.pickup, state.delivery, state.scheduling, state.scheduledDate]);

  const renderSuggestionItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => selectLocationFromSuggestion(item)}
    >
      <Text style={styles.suggestionText}>{item.place_name || item.text}</Text>
      {(item.properties?.place_formatted || item.properties?.full_address) && (
        <Text style={styles.suggestionDetails}>{item.properties.place_formatted || item.properties.full_address}</Text>
      )}
    </TouchableOpacity>
  ), [selectLocationFromSuggestion]);

  if (state.initialLoading || state.isLocationPermissionGranted === null) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {/* <Image source={require('./path/to/your/logo.png')} style={styles.loadingLogo} /> */}
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando e verificando permissões...</Text>
      </SafeAreaView>
    );
  }

  if (state.isLocationPermissionGranted === false) {
    return (
      <SafeAreaView style={styles.permissionDeniedContainer}>
        <MaterialIcons name="location-off" size={60} color={COLORS.textSecondary} style={{ marginBottom: 20 }} />
        <Text style={styles.permissionDeniedTitle}>Permissão de Localização Necessária</Text>
        <Text style={styles.permissionDeniedText}>
          Para usar esta funcionalidade, precisamos acessar sua localização para definir pontos de coleta e entrega.
          Por favor, conceda a permissão nas configurações do seu aparelho.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => Location.requestForegroundPermissionsAsync()}>
          <Text style={styles.permissionButtonText}>Conceder Permissão</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (state.appStateError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={60} color={COLORS.danger} style={{ marginBottom: 20 }} />
        <Text style={styles.errorTitle}>Ocorreu um Erro</Text>
        <Text style={styles.errorText}>{`Não foi possível carregar a tela devido a um erro:\n${state.appStateError}`}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => dispatch(initialState)}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: -SCREEN_HEIGHT * 0.1 })}>
        <ScrollView contentContainerStyle={styles.inner}>

          <>
            {state.step === 1 && !modalVisible && (
              <>
                <Text style={styles.label}>Descreva a carga:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Geladeira, sofá, caixas..."
                  placeholderTextColor={COLORS.textHint}
                  multiline
                  value={state.description}
                  onChangeText={(text) => dispatch({ description: text })}
                />
                <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
                  <Text style={styles.nextText}>Confirmar descrição</Text>
                </TouchableOpacity>
              </>
            )}

            {(state.step === 2 || state.step === 3) && !modalVisible && (
              <View style={{ alignItems: 'center' }}>
                <MaterialIcons name="map" size={80} color={COLORS.textSecondary + '80'} style={{ marginBottom: 20 }} />
                <Text style={[styles.panelSubtext, { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary }]}>Selecione os Locais</Text>
                <Text style={styles.panelSubtext}>{!state.pickup ? 'Primeiro, selecione o local de COLETA.' : (!state.delivery ? 'Agora, selecione o local de ENTREGA.' : 'Locais de coleta e entrega selecionados.')}</Text>
                <Text style={styles.panelSubtext}>Use o mapa no modal que será aberto para definir os pontos.</Text>

                {state.pickup && (
                  <View style={styles.locationSummaryBox}>
                    <Text style={styles.summaryTextTitle}>Coleta:</Text>
                    <Text style={styles.summaryText}>{state.pickup.address || (state.pickup ? `Coords: ${state.pickup.latitude.toFixed(4)}, ${state.pickup.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                  </View>
                )}
                {state.delivery && (
                  <View style={styles.locationSummaryBox}>
                    <Text style={styles.summaryTextTitle}>Entrega:</Text>
                    <Text style={styles.summaryText}>{state.delivery.address || (state.delivery ? `Coords: ${state.delivery.latitude.toFixed(4)}, ${state.delivery.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => {
                    if (!state.pickup) openMapModal(true);
                    else if (!state.delivery) openMapModal(false);
                    else {
                      proceedToNext();
                    }
                  }}
                >
                  <Text style={styles.nextText}>
                    {!state.pickup ? 'Abrir Mapa para Coleta' : (!state.delivery ? 'Abrir Mapa para Entrega' : 'Avançar para Agendamento')}
                  </Text>
                </TouchableOpacity>

                {(state.pickup || state.delivery) && (
                  <TouchableOpacity onPress={() => dispatch({ pickup: null, delivery: null, locationSearchText: '', locationSuggestions: [] })} style={styles.subtleButton}>
                    <Text style={styles.clearButtonText}>Limpar Locais Selecionados</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {state.step === 4 && !modalVisible && (
              <View>
                <Text style={styles.label}>Quando deseja que o frete aconteça?</Text>
                <View style={styles.cardRow}>
                  <TouchableOpacity style={[styles.card, state.scheduling === 'now' && styles.selectedCard]} onPress={() => dispatch({ scheduling: 'now', scheduledDate: null })}>
                    <Ionicons name="time" size={28} color={COLORS.white} />
                    <Text style={styles.cardText}>Agora</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.card, state.scheduling === 'schedule' && styles.selectedCard]} onPress={() => dispatch({ scheduling: 'schedule' })}>
                    <Ionicons name="calendar" size={28} color={COLORS.white} />
                    <Text style={styles.cardText}>Agendar</Text>
                  </TouchableOpacity>
                </View>
                {state.scheduling === 'schedule' && (
                  <>
                    <TouchableOpacity style={styles.input} onPress={() => dispatch({ showDatePicker: true })}>
                      <Text style={{ color: state.scheduledDate ? COLORS.textPrimary : COLORS.textHint }}>
                        {state.scheduledDate ? state.scheduledDate.toLocaleString() : 'Escolher Data/Hora'}
                      </Text>
                    </TouchableOpacity>
                    <DateTimePickerModal
                      isVisible={state.showDatePicker}
                      mode="datetime"
                      onConfirm={(date) => dispatch({ scheduledDate: date, showDatePicker: false })}
                      onCancel={() => dispatch({ showDatePicker: false })}
                      minimumDate={new Date()}
                      locale="pt_BR"
                    />
                  </>
                )}
                <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
                  <Text style={styles.nextText}>Ver Resumo e Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}

            {state.step === 5 && !modalVisible && (
              <View>
                <Text style={styles.label}>Resumo da Solicitação</Text>
                <Text style={styles.summaryTextTitle}>Detalhes:</Text>
                <Text style={styles.summaryText}>Carga: {state.description || 'Não informado'}</Text>
                <Text style={styles.summaryText}>Coleta: {state.pickup?.address || (state.pickup ? `Coords: ${state.pickup.latitude.toFixed(4)}, ${state.pickup.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                <Text style={styles.summaryText}>Entrega: {state.delivery?.address || (state.delivery ? `Coords: ${state.delivery.latitude.toFixed(4)}, ${state.delivery.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                <Text style={styles.summaryText}>Quando: {state.scheduling === 'now' ? 'Agora' : (state.scheduledDate?.toLocaleString() || 'Não agendado')}</Text>

                {state.pickup && state.delivery && (
                  <MapboxGL.MapView
                    ref={mapSummaryRef}
                    style={styles.summaryMap}
                    styleURL={MAPBOX_STYLE_URL}
                    camera={{
                      centerCoordinate: [(state.pickup.longitude + state.delivery.longitude) / 2, (state.pickup.latitude + state.delivery.latitude) / 2],
                      zoomLevel: 10,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <MapboxGL.PointAnnotation
                      id="pickupSummaryLocation"
                      coordinate={[state.pickup.longitude, state.pickup.latitude]}
                      title="Coleta"
                    >
                      <View style={{ width: MARKER_SIZE * 0.8, height: MARKER_SIZE * 0.8, backgroundColor: COLOR_COLETA, borderRadius: MARKER_SIZE * 0.4, borderWidth: 2, borderColor: COLORS.white }} />
                    </MapboxGL.PointAnnotation>
                    <MapboxGL.PointAnnotation
                      id="deliverySummaryLocation"
                      coordinate={[state.delivery.longitude, state.delivery.latitude]}
                      title="Entrega"
                    >
                      <View style={{ width: MARKER_SIZE * 0.8, height: MARKER_SIZE * 0.8, backgroundColor: COLOR_ENTREGA, borderRadius: MARKER_SIZE * 0.4, borderWidth: 2, borderColor: COLORS.white }} />
                    </MapboxGL.PointAnnotation>

                    <MapboxGL.ShapeSource
                      id="freightRouteSummarySource"
                      shape={{
                        type: "FeatureCollection",
                        features: [
                          {
                            type: "Feature",
                            properties: {},
                            geometry: {
                              type: "LineString",
                              coordinates: [
                                [state.pickup.longitude, state.pickup.latitude],
                                [state.delivery.longitude, state.delivery.latitude]
                              ]
                            }
                          }
                        ]
                      }}
                    >
                      <MapboxGL.LineLayer
                        id="freightRouteSummaryLine"
                        style={{
                          lineColor: COLOR_ROUTE_LINE,
                          lineWidth: 4,
                          lineCap: 'round',
                          lineJoin: 'round',
                        }}
                      />
                    </MapboxGL.ShapeSource>
                  </MapboxGL.MapView>
                )}

                <TouchableOpacity style={styles.confirmButton} onPress={confirmRequest} disabled={state.loading}>
                  {state.loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmText}>Confirmar Frete</Text>}
                </TouchableOpacity>
                {state.loading && <Text style={styles.loadingText}>Enviando solicitação...</Text>}
              </View>
            )}
          </>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.dark }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectingPickup ? '📍 Local de COLETA' : '🚚 Local de ENTREGA'}</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.modalMapContainer}>
            <MapboxGL.MapView
              ref={mapModalRef}
              style={styles.modalMap}
              styleURL={MAPBOX_STYLE_URL}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
              onPress={onMapPress}
            >
              <MapboxGL.UserLocation
                androidRenderMode={'gps'}
                showsUserHeadingIndicator={true}
                visible={true}
              />

              {(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude) && (
                <MapboxGL.PointAnnotation
                  id="tempSelectedLocationModal"
                  coordinate={[
                    (selectingPickup ? state.pickup.longitude : state.delivery.longitude),
                    (selectingPickup ? state.pickup.latitude : state.delivery.latitude)
                  ]}
                  title={selectingPickup ? 'Coleta Selecionada' : 'Entrega Selecionada'}
                >
                  <View style={{ backgroundColor: selectingPickup ? COLOR_COLETA : COLOR_ENTREGA, padding: 5, borderRadius: 20, borderWidth: 2, borderColor: COLORS.white }}>
                    <MaterialIcons name="location-pin" size={20} color={COLORS.white} />
                  </View>
                </MapboxGL.PointAnnotation>
              )}
            </MapboxGL.MapView>

            <View style={styles.autocompleteContainer}>
              <TextInput
                style={styles.autocompleteInput}
                placeholder={`Buscar Endereço para ${selectingPickup ? 'Coleta' : 'Entrega'}...`}
                placeholderTextColor={COLORS.textHint}
                value={state.locationSearchText}
                onChangeText={(text) => dispatch({ locationSearchText: text })}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {state.isSearchingLocations && (
                <ActivityIndicator size="small" color={COLORS.primary} style={styles.autocompleteLoading} />
              )}

              {state.locationSuggestions.length > 0 && (
                <FlatList
                  data={state.locationSuggestions}
                  keyExtractor={(item) => item.mapbox_id || item.name || item.text}
                  renderItem={renderSuggestionItem}
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="always"
                  maxHeight={SCREEN_HEIGHT * 0.3}
                  showsVerticalScrollIndicator={false}
                />
              )}
              {!state.locationSuggestions.length && !state.isSearchingLocations && state.locationSearchText.length > 2 && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>Nenhum resultado encontrado.</Text>
                </View>
              )}
            </View>
          </View>

          {selectingPickup && state.currentLocation && (
            <TouchableOpacity onPress={useMyLocation} style={styles.useLocationBtn}>
              <MaterialIcons name="my-location" size={20} color={COLORS.white} style={{ marginRight: 5 }} />
              <Text style={styles.useLocationText}>Usar minha localização atual</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={confirmLocation}
            style={[
              styles.confirmButtonModal,
              !(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude) ? styles.buttonDisabled : {}
            ]}
            disabled={!(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude)}
          >
            <Text style={styles.confirmText}>Confirmar Local de {selectingPickup ? 'Coleta' : 'Entrega'}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  inner: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, color: COLORS.textPrimary, marginBottom: 10 },
  input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  selectedCard: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  cardText: { color: COLORS.textPrimary, marginTop: 10 },
  nextButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' },
  nextText: { color: COLORS.dark, textAlign: 'center', fontWeight: 'bold' },
  confirmButton: { backgroundColor: COLORS.success, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' },
  confirmText: { color: COLORS.white, textAlign: 'center', fontWeight: 'bold' },
  confirmButtonModal: { backgroundColor: COLORS.success, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' },
  buttonDisabled: {
    backgroundColor: COLORS.border,
  },

  summaryTextTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 10, marginBottom: 5 },
  summaryText: { color: COLORS.textSecondary, marginBottom: 5 },
  locationSummaryBox: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryMap: {
    height: 200,
    marginVertical: 20,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  panelSubtext: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },

  useLocationBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, marginTop: 10, alignSelf: 'center', width: '80%', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border
  },
  useLocationText: { color: COLORS.white, textAlign: 'center' },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: COLORS.dark,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    flex: 1,
  },
  modalMapContainer: {
    flex: 1,
    position: 'relative',
  },
  modalMap: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    margin: 10,
  },
  autocompleteContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  autocompleteInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: Platform.select({ ios: 15, android: 12 }),
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  autocompleteLoading: {
    position: 'absolute',
    right: 25,
    top: Platform.select({ ios: 15, android: 12 }) + 5,
    zIndex: 6,
  },
  suggestionsList: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginTop: 5,
    maxHeight: SCREEN_HEIGHT * 0.3,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastSuggestionItem: {
    padding: 12,
  },
  suggestionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  suggestionDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  noResults: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  noResultsText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.dark,
    padding: 20,
  },
  permissionDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.dark,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 25,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtleButton: {
    marginTop: 15,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  clearButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loadingLogo: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.3,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  permissionDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 15,
  },
  permissionDeniedText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 20,
  },
});
