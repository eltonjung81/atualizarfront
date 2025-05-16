

// FreightScreen refatorado com Mapbox e Autocomplete integrado no modal
import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
View, Text, TextInput, TouchableOpacity, StyleSheet,
ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
Platform, Dimensions, SafeAreaView, Modal, FlatList, Image // Added Image for potential logo
} from 'react-native';

// Importe do Mapbox React Native SDK
import MapboxGL from "@rnmapbox/maps";

// Importe Constants para acessar variáveis do app.config.js
import Constants from 'expo-constants';

// Defina a chave API do Mapbox. É preferível acessá-la via variáveis de ambiente/config.
// O plugin do Expo pode configurar isso nativamente para o SDK, mas para usar na API Search (fetch),
// você precisa acessá-la no JS.
const MAPBOX_PUBLIC_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || Constants.expoConfig.extra.mapboxAccessToken;

// Setar o token globalmente para o SDK nativo (necessário para Android e iOS)
// Faça isso apenas uma vez na inicialização do seu aplicativo, talvez no App.js
// Ou use a configuração nativa do plugin se ele a setar automaticamente.
// Se você precisar setar aqui, descomente e certifique-se que a variável MAPBOX_PUBLIC_ACCESS_TOKEN
// está acessível e contém o token correto ANTES que qualquer componente Mapbox seja montado.
if (MAPBOX_PUBLIC_ACCESS_TOKEN) {
MapboxGL.setAccessToken(MAPBOX_PUBLIC_ACCESS_TOKEN);
// console.log("Mapbox Access Token Set."); // Log opcional para depuração
} else {
console.error("Mapbox Access Token not found. Map features may not work.");
Alert.alert("Erro", "Chave Mapbox não encontrada. Funcionalidades de mapa podem não funcionar.");
}

import * as Location from 'expo-location';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons'; // Importe FontAwesome para ícone Money

// Opcional: Lib para debounce para chamadas de autocomplete
// npm install lodash.debounce
// import debounce from 'lodash.debounce'; // Não usado diretamente aqui, mas a lógica de debounce foi implementada com useRef/setTimeout

const SCREEN_HEIGHT = Dimensions.get('window').height;
const IS_IOS = Platform.OS === 'ios';
const { width: SCREEN_WIDTH } = Dimensions.get('window'); // Adiciona SCREEN_WIDTH para estilos absolutos

// Definir cores usadas nos estilos para melhor organização
const COLORS = {
primary: '#ffa726', // Laranja principal
secondary: '#42a5f5', // Azul secundário
success: '#4caf50', // Verde para sucesso
danger: '#f44336', // Vermelho para erro/cuidado
white: '#fff',
black: '#000',
dark: '#1e1e1e', // Fundo principal
surface: '#2e2e2e', // Superfícies como inputs, cards
border: '#444', // Bordas sutis
textPrimary: '#fff',
textSecondary: '#dcdcdc', // Texto secundário (cinza claro)
textHint: '#aaa', // Texto de placeholder/dicas
};

// Definição de estilo padrão Mapbox - use seu Style URL aqui
const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/dark-v11'; // Ou 'mapbox://styles/seu_username/seu_style_id'

// Cores e estilos para marcadores (consistentes com seus estilos RN)
const COLOR_COLETA = COLORS.success; // Verde
const COLOR_ENTREGA = COLORS.danger; // Vermelho
const COLOR_USER = COLORS.primary; // Laranja
const COLOR_ROUTE_LINE = COLORS.primary; // Laranja para linha reta no resumo

// Estilos para ícones de marcadores customizados - MapboxGL.MarkerView é recomendado
const MARKER_SIZE = 30; // Tamanho base do círculo/View do marcador

// API Base URL para Mapbox Search (v3)
const MAPBOX_SEARCH_API_URL = 'https://api.mapbox.com/search/v3/';

const initialState = {
step: 1, // 1: Descrição, 2/3: Seleção Localização (via Modal), 4: Agendamento, 5: Resumo
description: '',
pickup: null, // { latitude, longitude, address? }
delivery: null, // { latitude, longitude, address? }
scheduling: 'now',
scheduledDate: null,
loading: false, // Loading para confirmar frete
currentLocation: null, // Localização do usuário { latitude, longitude }
showDatePicker: false,

// --- Estados para Autocomplete no Modal ---
locationSearchText: '',
locationSuggestions: [], // Lista de { place_name, geometry: { coordinates: [lng, lat] } } ou 'suggestions' na v3
isSearchingLocations: false, // Indicador de busca por autocomplete
// -----------------------------------------

// Estados adicionais para controle de loading/erro globais (simulados)
isLocationPermissionGranted: null, // null: checking, true: granted, false: denied
initialLoading: true, // Loading inicial para obter permissão/local
appStateError: null, // Armazena mensagem de erro geral
};

function reducer(state, action) {
// Permite sobrescrever múltiplos estados
return { ...state, ...action };
}

export default function FreightScreenModern() {
const [state, dispatch] = useReducer(reducer, initialState);
const [modalVisible, setModalVisible] = useState(false);
const [selectingPickup, setSelectingPickup] = useState(true); // true: Selecionando Coleta, false: Selecionando Entrega
// Ref para o MapView no Modal
const mapModalRef = useRef(null); // Ref específica para o mapa DENTRO do modal
// Ref para o MapView no Resumo (step 5)
const mapSummaryRef = useRef(null); // Ref para o mapa NO RESUMO

// --- Efeito inicial para permissão e localização ---
useEffect(() => {
const requestLocationPermissionAndGetLocation = async () => {
dispatch({ initialLoading: true }); // Start initial loading
try {
let { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
Alert.alert('Permissão negada', 'Não foi possível acessar sua localização. Funcionalidades baseadas em localização podem não funcionar.', [
{ text: 'OK', onPress: () => dispatch({ isLocationPermissionGranted: false, initialLoading: false }) },
{ text: 'Configurações', onPress: openAppSettings } // Implement openAppSettings if needed
]);
dispatch({ isLocationPermissionGranted: false, initialLoading: false });
return;
}
dispatch({ isLocationPermissionGranted: true });

const location = await Location.getCurrentPositionAsync({
         accuracy: Location.Accuracy.High,
         timeout: 15000, // Tempo maior para obter localização mais precisa
         // MayNeedImprovement: Add fallback if high accuracy fails
        // usePrioritizedLocation: true, // May improve speed on Android
     });

     const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
     dispatch({ currentLocation: coords, initialLoading: false });
     console.log("Localização atual obtida:", coords);

  } catch (error) {
     console.error("Erro ao obter localização inicial:", error);
      // Decide if this is a fatal error or just a feature limitation
      Alert.alert("Erro de Localização", "Não foi possível obter sua localização atual. Algumas funcionalidades como 'Usar minha localização' podem não funcionar.", [
          { text: 'OK', onPress: () => dispatch({ currentLocation: null, initialLoading: false, appStateError: "Failed to get initial location" }) } // Proceed but with limitations
      ]);
       dispatch({ currentLocation: null, initialLoading: false, appStateError: "Failed to get initial location" });
  }
};

 // Only run if permission status is unknown (null)
 if (state.isLocationPermissionGranted === null) {
     requestLocationPermissionAndGetLocation();
 }

 // Cleanup for location watcher can be added if you watch location continuously.
 // Currently using getCurrentPositionAsync once.


}, [state.isLocationPermissionGranted]); // Dependência para rodar se o estado de permissão mudar

// --- Efeito para animar o mapa NO MODAL quando ele abre ou localizações são selecionadas ---
useEffect(() => {
// Este effect só deve rodar quando o modal Visible muda para true E a ref do mapa modal existir
if (modalVisible && mapModalRef.current) {
// Determine o ponto para focar: Local selecionado (pickup/delivery) > Localização atual > Local padrão (Brasília)
const targetCoord = selectingPickup ? (state.pickup || state.currentLocation) : (state.delivery || state.currentLocation);

console.log("[MapModal Effect] Modal Visível. Selecionando:", selectingPickup ? 'Coleta' : 'Entrega');

        if(targetCoord) {
            console.log("[MapModal Effect] Animando para:", targetCoord.latitude, targetCoord.longitude);
             try {
                mapModalRef.current.setCamera({
                    centerCoordinate: [targetCoord.longitude, targetCoord.latitude], // Mapbox usa [lng, lat]
                    zoomLevel: selectingPickup ? 15 : 12, // Zoom mais perto para selecionar pickup, mais longe para entrega se necessário
                    animationDuration: 800, // ms
                });
             } catch (error) {
                console.error("Erro ao animar câmera inicial/modal:", error);
             }
       } else {
            // Se não tem current location nem pickup/delivery setado, anima para uma região padrão (ex: Brasília)
            console.log("[MapModal Effect] Animando para padrão (Brasília)");
             try {
                mapModalRef.current.setCamera({
                   centerCoordinate: [-47.93, -15.78], // Brasília
                    zoomLevel: 11,
                    animationDuration: 800,
                });
             } catch (e) { console.error("Erro ao animar câmera modal padrão:", e); }
        }

        // Resetar autocomplete states ao abrir modal para nova seleção
        dispatch({ locationSearchText: '', locationSuggestions: [], isSearchingLocations: false });
   } else if (!modalVisible) {
       // Optional: Logic when modal closes. Could reset temp states or update main UI preview.
       // console.log("[MapModal Effect] Modal fechado.");
   }
   // Este effect também pode ser acionado se state.pickup/delivery mudar ENQUANTO O MODAL ESTIVER VISÍVEL
   // (ex: selecionou locationSuggestions, queremos animar o mapa do modal para o ponto selecionado)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

}, [modalVisible, state.currentLocation, state.pickup, state.delivery, selectingPickup]); // Depende desses estados/ref

// --- Efeito para lidar com Geocodificação Reversa (LatLng para Endereço Legível) ---
// Roda sempre que state.pickup ou state.delivery mudar (coordenadas), mas APENAS se não tiver endereço ainda
useEffect(() => {
const geocode = async (coords, isPickup) => {
if (!coords || (coords.address !== undefined && coords.address !== null)) return; // Only geocode if address is missing/null/undefined

console.log("[Geocode Effect] Fazendo geocode reverso para:", coords, isPickup ? 'pickup' : 'delivery');
         try {
             const accessToken = MAPBOX_PUBLIC_ACCESS_TOKEN;
             if (!accessToken) {
                  console.error("Chave Mapbox não disponível para geocode reverso.");
                 // Opcional: Alertar ou atualizar o estado com erro de geocode
                 if (isPickup) dispatch({ pickup: { ...coords, address: "Erro: Chave Mapbox" } });
                 else dispatch({ delivery: { ...coords, address: "Erro: Chave Mapbox" } });
                 return;
             }

            // Endpoint Mapbox Search API v3 para Geocodificação Reversa
             const url = `${MAPBOX_SEARCH_API_URL}reverse_geocode?longitude=${coords.longitude}&latitude=${coords.latitude}&access_token=${accessToken}`;

             const response = await fetch(url);
             if (!response.ok) {
                  console.error(`[Geocode Effect] API Error ${response.status}:`, await response.text());
                   throw new Error(`API Error: ${response.status}`);
             }
             const data = await response.json();
             // console.log("[Geocode Effect] Geocode Results:", data); // Debug results

             if (data.features && data.features.length > 0) {
                const address = data.features[0].properties.full_address || data.features[0].properties.place_formatted || data.features[0].text;
                console.log(`[Geocode Effect] Endereço encontrado para ${isPickup ? 'pickup' : 'delivery'}:`, address);
                 // Atualize o estado com o endereço (mesclando com coords existentes)
                if (isPickup) {
                    dispatch({ pickup: { ...coords, address: address } });
                } else {
                     dispatch({ delivery: { ...coords, address: address } });
                }
             } else {
                console.warn(`[Geocode Effect] Nenhum endereço encontrado para ${isPickup ? 'pickup' : 'delivery'} nas coords.`, coords);
                // Manter coords, setar address como "Endereço não encontrado"
                if (isPickup) dispatch({ pickup: { ...coords, address: "Endereço não encontrado" } });
                else dispatch({ delivery: { ...coords, address: "Endereço não encontrado" } });
             }

         } catch (error) {
             console.error(`[Geocode Effect] Erro ao fazer geocode reverso para ${isPickup ? 'pickup' : 'delivery'}:`, error);
             // Opcional: Tratar erro de geocode
             if (isPickup) dispatch({ pickup: { ...coords, address: "Erro ao buscar endereço" } });
             else dispatch({ delivery: { ...coords, address: "Erro ao buscar endereço" } });
         }
    };

    // Geocode apenas se a coordenada foi definida (lat/lng existem) e o endereço AINDA NÃO foi obtido.
    if (state.pickup?.latitude && state.pickup?.longitude && state.pickup.address === undefined) { // Check specifically for undefined
        geocode(state.pickup, true);
    }
   if (state.delivery?.latitude && state.delivery?.longitude && state.delivery.address === undefined) { // Check specifically for undefined
       geocode(state.delivery, false);
   }
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

}, [state.pickup?.latitude, state.pickup?.longitude, state.delivery?.latitude, state.delivery?.longitude]); // Depende das coordenadas

// --- Função de Debounce para Autocomplete Search ---
const debounceTimeoutRef = useRef(null); // Ref para armazenar o ID do timeout

// Função para chamar a API Mapbox Search (Autocomplete) - useCallback é importante aqui
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

const fetchLocationSuggestions = useCallback(async (text) => {
if (text.length < 3) { // Busca apenas com 3 ou mais caracteres
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
        // Mapbox Search API v3 Autofill
         const query = encodeURIComponent(text);
         // Adicione proximity baseado no currentLocation do usuário se disponível
         // Mapbox usa [lng, lat] para proximity
         const proximity = state.currentLocation ?
            `&proximity=${state.currentLocation.longitude},${state.currentLocation.latitude}` : '';
        // Opcional: Restringir por país, tipo, etc.
        // const country = '&country=BR';
        // const types = '&types=address,place,poi';

         // Add session_token for better results (create one per search session - maybe when modal opens)
         // const sessionToken = 'YOUR_SESSION_TOKEN'; // Implement session token logic if needed

        const url = `${MAPBOX_SEARCH_API_URL}autofill?q=${query}${proximity}&access_token=${accessToken}`; // &session_token=${sessionToken}

        console.log("[Autocomplete] Chamando API:", url);
        const response = await fetch(url);
         if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        // console.log("[Autocomplete] Resultados:", data.suggestions); // Debug suggestions

         // Atualiza estado com as sugestões. Mapbox Autofill v3 retorna 'suggestions'
        if (data.suggestions) {
             dispatch({ locationSuggestions: data.suggestions }); // As sugestões já contêm place_name, text e mapbox_id
         } else {
              dispatch({ locationSuggestions: [] });
        }

    } catch (error) {
        console.error("[Autocomplete] Erro ao buscar sugestões:", error);
         dispatch({ locationSuggestions: [] });
        // Opcional: Mostrar alerta ou mensagem de erro na UI
   } finally {
         dispatch({ isSearchingLocations: false });
   }
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

}, [state.currentLocation]); // Depende do currentLocation para o proximity

// --- Efeito para triggar Autocomplete com Debounce ---
useEffect(() => {
// Limpa timeout anterior ao digitar novamente
if (debounceTimeoutRef.current) {
clearTimeout(debounceTimeoutRef.current);
}

// Configura novo debounce
    if (state.locationSearchText.length >= 3) { // Trigger com 3+ caracteres
        debounceTimeoutRef.current = setTimeout(() => {
            fetchLocationSuggestions(state.locationSearchText); // Chama a busca real após debounce
        }, 500); // 500ms debounce time
    } else {
         // Se menos de 3 caracteres, limpa as sugestões e loading
        dispatch({ locationSuggestions: [], isSearchingLocations: false });
   }

    // Cleanup function: limpa timeout se o componente desmontar ou o search text/fetchSuggestions mudar
    return () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
   };
}, [state.locationSearchText, fetchLocationSuggestions]); // Depende do texto digitado e da função de fetch
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

// --- Função para selecionar uma sugestão do Autocomplete ---
const selectLocationFromSuggestion = useCallback(async (suggestion) => {
console.log("[Autocomplete Select] Selecionada:", suggestion);

dispatch({ isSearchingLocations: true, locationSuggestions: [] }); // Limpa sugestões, mostra loading opcionalmente

    try {
         const accessToken = MAPBOX_PUBLIC_ACCESS_TOKEN;
         if (!accessToken) {
            console.error("Chave Mapbox não disponível para retrieve.");
             dispatch({ isSearchingLocations: false });
             return;
         }

         // Endpoint Retrieve para obter detalhes (inclui coordinates) usando o mapbox_id
         const url = `${MAPBOX_SEARCH_API_URL}retrieve/${suggestion.mapbox_id}?access_token=${accessToken}`;
         // Add session_token if used consistently
         // const url = `${MAPBOX_SEARCH_API_URL}retrieve/${suggestion.mapbox_id}?access_token=${accessToken}&session_token=YOUR_SESSION_TOKEN`;

        const response = await fetch(url);
         if (!response.ok) {
              console.error(`[Autocomplete Retrieve] API Error ${response.status}:`, await response.text());
              throw new Error(`API Error: ${response.status}`);
         }
         const data = await response.json();
         console.log("[Autocomplete Retrieve] Resultados:", data.features);

         if (data.features && data.features.length > 0) {
             const feature = data.features[0];
             // Mapbox returns [longitude, latitude]
             const [longitude, latitude] = feature.geometry.coordinates;
             // Use place_formatted or full_address from properties if available, fallback to text
             const address = feature.properties?.place_formatted || feature.properties?.full_address || feature.text;

             const selectedCoord = { latitude, longitude, address };

             // Atualiza o estado (pickup ou delivery) - Note: Do NOT set address here as 'undefined'
             // Set address only if retrieve provides it. Geocode effect will handle cases where it's missing.
             if (selectingPickup) {
                dispatch({ pickup: selectedCoord });
            } else {
                dispatch({ delivery: selectedCoord });
            }
             console.log(`Local selecionado via autocomplete (${selectingPickup ? 'Coleta' : 'Entrega'}):`, selectedCoord);

            // --- ANIMA O MAPA DO MODAL PARA O LOCAL SELECIONADO ---
             if (mapModalRef.current) {
                try {
                   mapModalRef.current.setCamera({
                       centerCoordinate: [longitude, latitude], // [lng, lat]
                       zoomLevel: 16, // Zoom mais perto no local selecionado
                       animationDuration: 800,
                   });
               } catch (e) { console.error("Erro ao animar câmera após selecionar autocomplete:", e); }
             }

            // Limpar o termo de busca após seleção
            dispatch({ locationSearchText: '', locationSuggestions: [] });

        } else {
            console.warn("Retrieve failed or no feature found for suggestion:", suggestion);
             Alert.alert("Erro na Seleção", "Não foi possível obter os detalhes do local. Tente buscar novamente ou clique no mapa.");
        }

    } catch (error) {
         console.error("Erro no processo de seleção/retrieve do autocomplete:", error);
          Alert.alert("Erro na Busca", "Não foi possível buscar detalhes do local. Tente novamente.");
    } finally {
        dispatch({ isSearchingLocations: false }); // Garantir que loading para
    }
}, [selectingPickup, mapModalRef]); // Depende do tipo de seleção (pickup/delivery) e da ref do mapa
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

// --- Handler para toque no mapa no Modal ---
const onMapPress = useCallback((event) => {
console.log("[Map Press] Coordenadas:", event.geometry.coordinates);
const [longitude, latitude] = event.geometry.coordinates;
const tappedCoord = { latitude, longitude };

// Atualiza o estado temporariamente com as coordenadas do toque.
   // O endereço será obtido pelo useEffect de geocodificação reversa.
    if (selectingPickup) {
        // Setting address to undefined explicitly tells the geocode effect to run
        dispatch({ pickup: { ...tappedCoord, address: undefined } });
    } else {
         dispatch({ delivery: { ...tappedCoord, address: undefined } });
    }

   // Opcional: Animar o mapa para o ponto clicado
    if (mapModalRef.current) {
         try {
            mapModalRef.current.setCamera({
                centerCoordinate: [longitude, latitude],
                zoomLevel: 16, // Zoom no ponto clicado
                animationDuration: 400,
            });
         } catch (e) { console.error("Erro ao animar câmera após clique no mapa:", e); }
    }
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

}, [selectingPickup, mapModalRef]); // Depende do tipo de seleção e da ref do mapa

// --- Handler para botão "Confirmar Local" no Modal ---
const confirmLocation = useCallback(() => {
console.log("[Confirm Location] Confirmando:", selectingPickup ? state.pickup : state.delivery);
// O local já foi setado no state por onMapPress ou selectLocationFromSuggestion

// Basic validation - ensure coords exist
    const confirmedLocation = selectingPickup ? state.pickup : state.delivery;
     if (!confirmedLocation?.latitude || !confirmedLocation?.longitude) {
         Alert.alert("Erro", "Por favor, selecione um local no mapa ou use a busca.");
         return;
     }

    // Close modal
    setModalVisible(false);

    // Proceed to next step
    proceedToNext();

}, [selectingPickup, state.pickup, state.delivery]); // Depende do que está sendo selecionado e dos estados de pickup/delivery


// --- Handler para botão "Usar minha localização" no Modal ---
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
     // Use currentLocation para definir pickup. Endereço será geocodificado automaticamente pelo effect.
    dispatch({ pickup: { ...state.currentLocation, address: undefined } }); // Setting address to undefined triggers geocode

    // Anima o mapa do modal para a localização atual
    if (mapModalRef.current) {
         try {
            mapModalRef.current.setCamera({
                centerCoordinate: [state.currentLocation.longitude, state.currentLocation.latitude],
                zoomLevel: 16,
                animationDuration: 800,
            });
         } catch (e) { console.error("Erro ao animar câmera para minha localização:", e); }
    }
    // Note: Modal does NOT close automatically. User must confirm.
}, [state.currentLocation, selectingPickup, mapModalRef]);
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

// --- Handler para abrir o Modal do Mapa ---
const openMapModal = useCallback((isPickup) => {
setSelectingPickup(isPickup);
setModalVisible(true);
// The useEffect for modalVisible will handle initial camera animation
}, []); // No dependencies needed, this function just sets state

// --- Handler para avançar entre os passos ---
const proceedToNext = useCallback(() => {
// Basic validation before proceeding
if (state.step === 1 && !state.description.trim()) {
Alert.alert("Campo Vazio", "Por favor, descreva a carga.");
return;
}
// Após step 1, vai para seleção de localização (step 2/3)
if (state.step === 1) {
dispatch({ step: 2 }); // Vai para o passo de seleção de localização
return; // Exit here
}

// Após seleção de localização (step 2/3), verifica se ambos foram selecionados
   // Note: Steps 2 and 3 are managed by the modal flow. The main UI shows a placeholder until both are done.
   // The confirmLocation handler in the modal calls proceedToNext.
   // If coming from modal confirmLocation:
   // If we just confirmed Pickup (selectingPickup was true), check if Delivery is set. If not, open modal for Delivery.
   // If we just confirmed Delivery (selectingPickup was false), proceed to step 4.
   if (state.step === 2 || state.step === 3) {
       if (!state.pickup) {
           Alert.alert("Selecione a Coleta", "Por favor, selecione o local de coleta.");
            // openMapModal(true); // Optional: automatically open modal for pickup
           return;
       }
       if (!state.delivery) {
            Alert.alert("Selecione a Entrega", "Por favor, selecione o local de entrega.");
           // openMapModal(false); // Optional: automatically open modal for delivery
           return;
       }
        // If both are selected, proceed to scheduling
       dispatch({ step: 4 });
        return;
   }


   // Após agendamento (step 4), verifica se a data foi selecionada se for agendado
   if (state.step === 4) {
       if (state.scheduling === 'schedule' && !state.scheduledDate) {
           Alert.alert("Data de Agendamento", "Por favor, escolha a data e hora do agendamento.");
           return;
       }
       // Proceed to summary
       dispatch({ step: 5 });
        return;
   }

   // Após resumo (step 5), o próximo passo é CONFIRMAR (confirmRequest), não avançar o step
   // This case should ideally not be reached by the "next" button if it's labeled "Confirmar Frete"
   // The confirmRequest function is separate.
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

}, [state.step, state.description, state.pickup, state.delivery, state.scheduling, state.scheduledDate]);

// --- Handler para a confirmação final do frete (Step 5) ---
const confirmRequest = useCallback(async () => {
    // Re-validation before final confirmation
     if (!state.description.trim() || !state.pickup?.latitude || !state.delivery?.latitude || (state.scheduling === 'schedule' && !state.scheduledDate)) {
         Alert.alert("Erro", "Por favor, preencha todos os dados necessários.");
         return;
     }

    dispatch({ loading: true });

    try {
        // --- SIMULAÇÃO DE ENVIO PARA BACKEND ---
        console.log("Simulando envio da solicitação de frete:", {
            description: state.description,
            pickup: state.pickup, // Will include address if geocoded
            delivery: state.delivery, // Will include address if geocoded
            scheduling: state.scheduling,
            scheduledDate: state.scheduling === 'schedule' ? state.scheduledDate?.toISOString() : null, // Enviar em formato ISO
            // Optional: currentLocation if useful for backend logistics
            // currentLocation: state.currentLocation,
        });

         // Substitua esta simulação por uma chamada real à sua API de backend
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simula delay de rede

        Alert.alert("Sucesso!", "Sua solicitação de frete foi enviada com sucesso.", [
             { text: "OK", onPress: () => dispatch(initialState) } // Reset form on success
        ]);

    } catch (error) {
        console.error("Erro ao enviar solicitação de frete:", error);
        Alert.alert("Erro", "Não foi possível enviar sua solicitação. Tente novamente mais tarde.");
    } finally {
        dispatch({ loading: false });
    }

}, [state.description, state.pickup, state.delivery, state.scheduling, state.scheduledDate]);


// --- UI Helper para Renderizar Items da FlatList de Sugestões ---
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

const renderSuggestionItem = useCallback(({ item }) => (
<TouchableOpacity
style={styles.suggestionItem}
onPress={() => selectLocationFromSuggestion(item)} // Chame a função para selecionar sugestão
>
{/* Mapbox Autofill v3 pode ter place_name ou text como label principal /}
<Text style={styles.suggestionText}>{item.place_name || item.text}</Text>
{/ Mostrar endereço formatado/detalhes se disponível */}
{(item.properties?.place_formatted || item.properties?.full_address) && (
<Text style={styles.suggestionDetails}>{item.properties.place_formatted || item.properties.full_address}</Text>
)}
</TouchableOpacity>
), [selectLocationFromSuggestion]); // Dependency on the select function

// --- Renderização de Loading Inicial / Permissão Negada ---
// Estes devem renderizar ENQUANTO os estados iniciais não estão prontos
if (state.initialLoading || state.isLocationPermissionGranted === null) {
return (
<SafeAreaView style={styles.loadingContainer}>
{/* <Image source={require('./path/to/your/logo.png')} style={styles.loadingLogo} /> /} {/ Substitua com sua logo */}
<ActivityIndicator size="large" color={COLORS.primary} />
<Text style={styles.loadingText}>Carregando e verificando permissões...</Text>
</SafeAreaView>
);
}

if (state.isLocationPermissionGranted === false) {
    return (
         <SafeAreaView style={styles.permissionDeniedContainer}>
            <MaterialIcons name="location-off" size={60} color={COLORS.textSecondary} style={{marginBottom: 20}}/>
            <Text style={styles.permissionDeniedTitle}>Permissão de Localização Necessária</Text>
            <Text style={styles.permissionDeniedText}>
                Para usar esta funcionalidade, precisamos acessar sua localização para definir pontos de coleta e entrega.
                Por favor, conceda a permissão nas configurações do seu aparelho.
            </Text>
             <TouchableOpacity style={styles.permissionButton} onPress={() => Location.requestForegroundPermissionsAsync()}>
                 <Text style={styles.permissionButtonText}>Conceder Permissão</Text>
             </TouchableOpacity>
              {/* Opcional: Botão para tentar novamente a permissão (pode não abrir as configurações do sistema diretamente) */}
             {/* <TouchableOpacity style={styles.retryButton} onPress={() => requestLocationPermissionAndGetLocation()}>
                  <Text style={styles.retryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity> */}
         </SafeAreaView>
    );
}

 // Renderização principal uma vez que o estado inicial está pronto e permissão concedida
 // Se houver um erro de estado geral (ex: falha ao obter localização inicial), você pode
 // exibir uma mensagem de erro aqui também, talvez com um botão de "tentar novamente"
if (state.appStateError) {
     // Exemplo simples de tela de erro
     return (
          <SafeAreaView style={styles.loadingContainer}>
               <MaterialIcons name="error-outline" size={60} color={COLORS.danger} style={{marginBottom: 20}}/>
               <Text style={styles.errorTitle}>Ocorreu um Erro</Text>
               <Text style={styles.errorText}>{`Não foi possível carregar a tela devido a um erro:\n${state.appStateError}`}</Text>
               <TouchableOpacity style={styles.retryButton} onPress={() => dispatch(initialState)}>
                    <Text style={styles.retryButtonText}>Tentar Novamente</Text>
               </TouchableOpacity>
          </SafeAreaView>
     );
}


// --- UI Principal (renderizada apenas se não estiver em loading/erro/permisão negada) ---
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

return (
<SafeAreaView style={styles.container}>
{/* KeyboardAvoidingView deve envolver a ScrollView para ajustar o conteúdo quando o teclado aparece /}
<KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: -SCREEN_HEIGHT * 0.1 })}> {/ Adjust offset as needed /}
{/ ScrollView envolve todo o conteúdo do formulário que pode ser scrollado */}
<ScrollView contentContainerStyle={styles.inner}>

{/* Use um fragment para agrupar todos os blocos condicionais dentro da ScrollView */}
      <>
         {/* Passo de Descrição */}
        {state.step === 1 && !modalVisible && ( // Only show step 1 if modal is NOT visible
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
             {/* Botão para prosseguir após descrição */}
            <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
               <Text style={styles.nextText}>Confirmar descrição</Text>
             </TouchableOpacity>
          </>
        )}

         {/* Passo de Seleção de Localização (UI no background quando modal fechado) */}
         {/* Mostra resumo básico dos locais e botão para abrir modal */}
        {(state.step === 2 || state.step === 3) && !modalVisible && (
             <View style={{ alignItems: 'center' }}>
                  <MaterialIcons name="map" size={80} color={COLORS.textSecondary + '80'} style={{marginBottom: 20}}/>
                  <Text style={[styles.panelSubtext, {fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary}]}>Selecione os Locais</Text>
                  <Text style={styles.panelSubtext}>{!state.pickup ? 'Primeiro, selecione o local de COLETA.' : (!state.delivery ? 'Agora, selecione o local de ENTREGA.' : 'Locais de coleta e entrega selecionados.')}</Text>
                   <Text style={styles.panelSubtext}>Use o mapa no modal que será aberto para definir os pontos.</Text>


                  {/* Exibir locais selecionados até agora (opcional, visualização simples) */}
                  {state.pickup && (
                      <View style={styles.locationSummaryBox}>
                         <Text style={styles.summaryTextTitle}>Coleta:</Text>
                         <Text style={styles.summaryText}>{state.pickup.address || `Coords: ${state.pickup.latitude.toFixed(4)}, ${state.pickup.longitude.toFixed(4)}`}</Text>
                      </View>
                  )}
                   {state.delivery && (
                       <View style={styles.locationSummaryBox}>
                           <Text style={styles.summaryTextTitle}>Entrega:</Text>
                          <Text style={styles.summaryText}>{state.delivery.address || `Coords: ${state.delivery.latitude.toFixed(4)}, ${state.delivery.longitude.toFixed(4)}`}</Text>
                       </View>
                   )}


                 <TouchableOpacity
                    style={styles.nextButton}
                     // Abre o modal para selecionar Pickup se ainda não foi, senão abre para Delivery
                    onPress={() => {
                        if (!state.pickup) openMapModal(true);
                        else if (!state.delivery) openMapModal(false);
                         else {
                            // If both are selected, the "next" button should change behavior or be hidden.
                            // Or clicking it proceeds if validation passes. Let's make it proceed if both are set.
                             proceedToNext();
                         }
                     }}
                 >
                      <Text style={styles.nextText}>
                          {!state.pickup ? 'Abrir Mapa para Coleta' : (!state.delivery ? 'Abrir Mapa para Entrega' : 'Avançar para Agendamento')} {/* Texto dinâmico */}
                      </Text>
                 </TouchableOpacity>

                  {/* Opcional: Botão para editar locais selecionados */}
                   {(state.pickup || state.delivery) && (
                       <TouchableOpacity onPress={() => dispatch({ pickup: null, delivery: null, locationSearchText: '', locationSuggestions: [] })} style={styles.subtleButton}>
                          <Text style={styles.clearButtonText}>Limpar Locais Selecionados</Text>
                       </TouchableOpacity>
                   )}
                </View>
             )}


              {/* Passo de Agendamento */}
             {state.step === 4 && !modalVisible && ( // Only show step 4 if modal is NOT visible
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
                       locale="pt_BR" // Set locale if needed
                     />
                   </>
                 )}
                  {/* Botão para ir para o resumo (step 5) */}
                 <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
                   <Text style={styles.nextText}>Ver Resumo e Confirmar</Text>
                 </TouchableOpacity>
               </View>
             )}

              {/* Estado: Resumo com Mapa Mapbox */}
              {state.step === 5 && !modalVisible && ( // Only show step 5 if modal is NOT visible
                <View>
                  <Text style={styles.label}>Resumo da Solicitação</Text>
                  <Text style={styles.summaryTextTitle}>Detalhes:</Text>
                  <Text style={styles.summaryText}>Carga: {state.description || 'Não informado'}</Text>
                   {/* Mostra endereço se disponível após geocode reverso */}
                   <Text style={styles.summaryText}>Coleta: {state.pickup?.address || (state.pickup ? `Coords: ${state.pickup.latitude.toFixed(4)}, ${state.pickup.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                  <Text style={styles.summaryText}>Entrega: {state.delivery?.address || (state.delivery ? `Coords: ${state.delivery.latitude.toFixed(4)}, ${state.delivery.longitude.toFixed(4)}` : 'Não selecionado')}</Text>
                  <Text style={styles.summaryText}>Quando: {state.scheduling === 'now' ? 'Agora' : (state.scheduledDate?.toLocaleString() || 'Não agendado')}</Text>

                  {/* === Mapbox MapView no Resumo === */}
                  {state.pickup && state.delivery && ( // Renderiza MapboxGL.MapView apenas se tiver pontos
                       <MapboxGL.MapView
                            ref={mapSummaryRef} // Ref específica para o mapa resumo
                            style={styles.summaryMap} // Estilo reduzido
                           styleURL={MAPBOX_STYLE_URL}
                            // Camera configuration often works best AFTER the map loads/renders.
                            // For a static summary map, setting initialCamera might suffice,
                            // but fitting bounds dynamically after render is more robust.
                           // Adjusts the camera to the points - this initial setting is basic
                            camera={{
                                centerCoordinate: [(state.pickup.longitude + state.delivery.longitude) / 2, (state.pickup.latitude + state.delivery.latitude) / 2],
                                 zoomLevel: 10, // Initial zoom
                                 // Consider adding padding to center the line away from edges if needed
                            }}
                            // Mapa resumo NÃO é interativo
                           scrollEnabled={false}
                           zoomEnabled={false}
                           pitchEnabled={false}
                           rotateEnabled={false}
                            // Use onMapReady to set camera/bounds more accurately
                            // onMapReady={(e) => { ... fit bounds here ... }}
                       >
                            {/* === Adicionar Componentes Mapbox (Annotations/Markers e Shapes/Polylines) === */}

                            {/* Marcadores de Coleta e Entrega no Resumo */}
                           <MapboxGL.PointAnnotation
                               id="pickupSummaryLocation"
                               coordinate={[state.pickup.longitude, state.pickup.latitude]}
                               title="Coleta"
                           >
                                {/* MarkerView para ícone visual mais customizável */}
                               <View style={{ width: MARKER_SIZE*0.8, height: MARKER_SIZE*0.8, backgroundColor: COLOR_COLETA, borderRadius: MARKER_SIZE*0.4, borderWidth: 2, borderColor: COLORS.white }} />
                           </MapboxGL.PointAnnotation>
                            <MapboxGL.PointAnnotation
                               id="deliverySummaryLocation"
                               coordinate={[state.delivery.longitude, state.delivery.latitude]}
                               title="Entrega"
                           >
                               {/* MarkerView para ícone visual mais customizável */}
                                <View style={{ width: MARKER_SIZE*0.8, height: MARKER_SIZE*0.8, backgroundColor: COLOR_ENTREGA, borderRadius: MARKER_SIZE*0.4, borderWidth: 2, borderColor: COLORS.white }} />
                           </MapboxGL.PointAnnotation>


                           {/* Polyline da Rota (linha reta simples) no Resumo */}
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
                  )} {/* Fim da condição de renderização do MapboxGL.MapView no resumo */}


                  <TouchableOpacity style={styles.confirmButton} onPress={confirmRequest} disabled={state.loading}>
                    {state.loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmText}>Confirmar Frete</Text>}
                  </TouchableOpacity>
                   {state.loading && <Text style={styles.loadingText}>Enviando solicitação...</Text>}
                </View>
              )}

         {/* Renderiza Placeholder para passos 2 e 3 (seleção de localização) fora do modal e resumo */}
          {/* Removido o bloco duplicado de placeholder. O bloco acima (step 2||3 && !modalVisible) já serve. */}


      </> {/* Fim do fragment que envolve os passos */}
    </ScrollView>
  </KeyboardAvoidingView>


  {/* --- Modal de Mapa com MapboxGL (Substituição e Adição Autocomplete) --- */}
  {/* O Modal deve ser um CHILD direto do container principal (SafeAreaView), NÃO dentro da ScrollView ou KeyboardAvoidingView */}
  {/* Renderizado condicionalmente com base em modalVisible */}
  <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} transparent={false}>
       {/* SafeAreaView dentro do modal para respeitar notched areas */}
       <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.dark }}>

           {/* Header do Modal */}
           <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.backButton} onPress={() => setModalVisible(false)}>
                   <Ionicons name="close" size={28} color={COLORS.textPrimary} />
              </TouchableOpacity>
               <Text style={styles.modalTitle}>{selectingPickup ? '📍 Local de COLETA' : '🚚 Local de ENTREGA'}</Text>
               {/* Espaço reservado para centralizar o título */}
               <View style={{ width: 44 }} />
           </View>

           {/* Container que engloba Mapa E UI de Autocomplete */}
           <View style={styles.modalMapContainer}>

              {/* === MapboxGL.MapView (Mapa no Modal) === */}
               <MapboxGL.MapView
                  ref={mapModalRef} // Referência para controlar a câmera deste mapa
                   style={styles.modalMap} // Usa style Flex 1 dentro do modalMapContainer
                  styleURL={MAPBOX_STYLE_URL} // Estilo do Mapa Mapbox
                  // initialCamera será setado no effect (para current location ou selecionado)
                  // Propriedades de Interação - habilite gestures no modal
                   scrollEnabled={true}
                   zoomEnabled={true}
                   pitchEnabled={false} // Pitch disabled to avoid tilting issues unless intended
                   rotateEnabled={false} // Rotate disabled unless intended
                   onPress={onMapPress} // Captura toques no mapa do modal para selecionar ponto
               >
                   {/* Mostrar a localização atual do usuário */}
                   {/* Use MapboxGL.UserLocation para o ponto azul nativo */}
                   <MapboxGL.UserLocation
                       androidRenderMode={'gps'} // Melhor para seguir no Android
                       showsUserHeadingIndicator={true} // Mostra direção no Android
                      visible={true}
                      // onUpdate={(location) => { console.log("User Location Updated:", location.coords); }} // Optional: monitor user location updates
                   />
                    {/* Opcional: MarkerView customizado para o ponto azul se o UserLocation nativo não for suficiente */}
                    {/* {state.currentLocation && (
                        <MapboxGL.MarkerView id="userCurrentLocationMarker" coordinate={[state.currentLocation.longitude, state.currentLocation.latitude]}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'blue', borderWidth: 3, borderColor: 'white' }} />
                        </MapboxGL.MarkerView>
                    )} */}


                   {/* === Adicionar Marcador PONTO VERDE/VERMELHO TEMPORÁRIO no Mapa DO MODAL === */}
                    {/* Este é o marcador que aparece onde o usuário TOCOU no mapa ou selecionou via autocomplete */}
                    {/* Mostra o marcador se a localização atual (pickup ou delivery) no state TEM coordenadas */}
                   {(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude) && (
                        <MapboxGL.PointAnnotation
                             id="tempSelectedLocationModal"
                            coordinate={[
                                (selectingPickup ? state.pickup.longitude : state.delivery.longitude),
                                (selectingPickup ? state.pickup.latitude : state.delivery.latitude)
                             ]}
                            title={selectingPickup ? 'Coleta Selecionada' : 'Entrega Selecionada'}
                            // Use MarkerView para um ícone customizado mais robusto
                        >
                            <View style={{ backgroundColor: selectingPickup ? COLOR_COLETA : COLOR_ENTREGA, padding: 5, borderRadius: 20, borderWidth: 2, borderColor: COLORS.white }}>
                               <MaterialIcons name="location-pin" size={20} color={COLORS.white} />
                            </View>
                        </MapboxGL.PointAnnotation>
                     )}

               </MapboxGL.MapView>

                {/* --- UI DE AUTOCOMPLETE (TextInput e Lista de Sugestões) --- */}
                {/* Posição Absoluta para sobrepor o mapa */}
                <View style={styles.autocompleteContainer}>
                     {/* Input de Texto para Endereço */}
                    <TextInput
                        style={styles.autocompleteInput}
                         placeholder={`Buscar Endereço para ${selectingPickup ? 'Coleta' : 'Entrega'}...`}
                        placeholderTextColor={COLORS.textHint}
                        value={state.locationSearchText}
                        onChangeText={(text) => dispatch({ locationSearchText: text })} // Atualiza estado do search text
                         autoCapitalize="words" // capitalized words are common for addresses
                        autoCorrect={false} // Prevents auto-correction interference
                    />
                     {/* Indicador de Loading enquanto busca sugestões */}
                     {state.isSearchingLocations && (
                         <ActivityIndicator size="small" color={COLORS.primary} style={styles.autocompleteLoading} />
                     )}

                     {/* Lista de Sugestões (Condicional) */}
                     {/* Renderiza a lista apenas se houver sugestões */}
                     {state.locationSuggestions.length > 0 && (
                        <FlatList
                             data={state.locationSuggestions}
                            keyExtractor={(item) => item.mapbox_id || item.name || item.text} // Mapbox id é mais confiável
                            renderItem={renderSuggestionItem} // Usa a função helper de renderização
                             style={styles.suggestionsList}
                             keyboardShouldPersistTaps="always" // Importante para tocar nos items da lista sem fechar teclado/lista
                             // Defina um limite de altura para a lista para não cobrir tudo
                            maxHeight={SCREEN_HEIGHT * 0.3} // Exemplo: max 30% da tela de altura
                             showsVerticalScrollIndicator={false}
                        />
                    )}
                    {/* Opcional: Mensagem se não encontrar resultados após a busca (sem loading) */}
                      {!state.locationSuggestions.length && !state.isSearchingLocations && state.locationSearchText.length > 2 && (
                          <View style={styles.noResults}>
                              <Text style={styles.noResultsText}>Nenhum resultado encontrado.</Text>
                          </View>
                      )}

                </View>
                 {/* Fim UI AUTOCOMPLETE */}


            </View>
           {/* Fim Container Mapa e Autocomplete */}


          {/* Botão "Usar minha localização" no Modal */}
          {selectingPickup && state.currentLocation && ( // Apenas na seleção de Coleta E se a localização atual estiver disponível
               <TouchableOpacity onPress={useMyLocation} style={styles.useLocationBtn}>
                 <MaterialIcons name="my-location" size={20} color={COLORS.white} style={{marginRight: 5}}/>
                  <Text style={styles.useLocationText}>Usar minha localização atual</Text>
               </TouchableOpacity>
             )}

           {/* Botão "Confirmar Local" no Modal */}
            {/* Habilita apenas se um local (pickup ou delivery) tiver sido selecionado (via toque OU autocomplete) E TEM coordenadas */}
           <TouchableOpacity
              onPress={confirmLocation}
              style={[
                  styles.confirmButtonModal,
                  !(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude) ? styles.buttonDisabled : {} // Desabilita se a coordenada não está definida
              ]}
               disabled={!(selectingPickup ? state.pickup?.latitude : state.delivery?.latitude)} // Desabilita se a coordenada não está definida
            >
               <Text style={styles.confirmText}>Confirmar Local de {selectingPickup ? 'Coleta' : 'Entrega'}</Text>
           </TouchableOpacity>


       </SafeAreaView>
   </Modal>
  {/* Fim Modal de Mapa */}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
</SafeAreaView>
);
}


// --- Estilos ---
// Adicionados estilos para autocomplete no modal e cores
const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: COLORS.dark },
inner: { padding: 20 },
title: { fontSize: 26, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20, textAlign: 'center' },
label: { fontSize: 16, color: COLORS.textPrimary, marginBottom: 10 },
input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border }, // Added border
cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }, // Added border
selectedCard: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, // Change border color too
cardText: { color: COLORS.textPrimary, marginTop: 10 },
nextButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' }, // Fixed width and center content
nextText: { color: COLORS.dark, textAlign: 'center', fontWeight: 'bold' }, // Text color contrast
confirmButton: { backgroundColor: COLORS.success, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' },
confirmText: { color: COLORS.white, textAlign: 'center', fontWeight: 'bold' },
// Novo estilo para o botão de confirmação no modal para não ter conflito de nome
confirmButtonModal: { backgroundColor: COLORS.success, padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', width: '80%', alignItems: 'center' },
buttonDisabled: {
backgroundColor: COLORS.border, // Cinza para botão desabilitado
// opacity: 0.8, // Optional: visual cue
},

// Summary Section Styles
summaryTextTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 10, marginBottom: 5 },
summaryText: { color: COLORS.textSecondary, marginBottom: 5 },
locationSummaryBox: {
backgroundColor: COLORS.surface,
padding: 15,
borderRadius: 8,
marginTop: 10,
width: '100%', // Take full width
borderWidth: 1,
borderColor: COLORS.border,
},
// Estilo para o mapa pequeno no resumo (step 5)
summaryMap: {
height: 200,
marginVertical: 20, // More vertical space
borderRadius: 10,
overflow: 'hidden',
width: '100%', // Ensure map takes full width
},
panelSubtext: {
fontSize: 16,
color: COLORS.textSecondary,
textAlign: 'center',
marginBottom: 10,
},

// Estilos para o botão "Usar minha localização" no modal
useLocationBtn: {
flexDirection: 'row', // Ícone e texto
backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, marginTop: 10, alignSelf: 'center', width: '80%', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border
},
useLocationText: { color: COLORS.white, textAlign: 'center' },

// --- Estilos para o Modal ---
modalHeader: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
paddingHorizontal: 10,
paddingVertical: 15, // More padding
backgroundColor: COLORS.dark, // Header background
width: '100%',
borderBottomWidth: 1, // Separator line
borderBottomColor: COLORS.border,
},
modalTitle: {
fontSize: 18,
fontWeight: 'bold',
color: COLORS.primary,
textAlign: 'center',
flex: 1, // Allows title to take available space and center
},
modalMapContainer: {
flex: 1, // Permite que o mapa e autocomplete ocupem o espaço restante no modal
position: 'relative', // Para posicionar autocomplete absoluto DENTRO deste container
// Remove borderRadius and overflow here, apply to the MapView itself if needed or rely on container clipping
},
modalMap: {
flex: 1, // Ocupa todo o espaço disponível no container
borderRadius: 10, // Apply border radius directly to map
overflow: 'hidden', // Needed for borderRadius
margin: 10, // Margin around the map inside the modal
},
// --- Estilos para Autocomplete (no Modal) ---
autocompleteContainer: {
position: 'absolute', // Posiciona em cima do mapa
top: 20, // Distância do topo dentro do modalMapContainer
left: 20, // Distância da esquerda (matches map margin)
right: 20, // Distância da direita (matches map margin)
zIndex: 5, // Garante que fica em cima do mapa
},
autocompleteInput: {
backgroundColor: COLORS.surface, // Fundo escuro
color: COLORS.textPrimary, // Texto claro
borderRadius: 8,
paddingHorizontal: 15,
paddingVertical: Platform.select({ ios: 15, android: 12 }), // Adjust padding for platforms
fontSize: 16,
borderWidth: 1,
borderColor: COLORS.border,
// Sombra para destacar (opcional)
shadowColor: COLORS.black,
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3, // Slightly more visible shadow
shadowRadius: 4,
elevation: 5, // Android elevation
},
autocompleteLoading: {
position: 'absolute',
right: 25, // Adjust position to match input padding
top: Platform.select({ ios: 15, android: 12 }) + 5, // Center vertically
zIndex: 6, // Acima do input se necessário
},
suggestionsList: {
backgroundColor: COLORS.surface, // Fundo para a lista
borderRadius: 8,
marginTop: 5, // Espaço abaixo do input
maxHeight: SCREEN_HEIGHT * 0.3, // Limite de altura da lista
borderWidth: 1, // Opcional: Borda sutil
borderColor: COLORS.border,
overflow: 'hidden', // For rounded corners
// Add shadow/elevation consistent with input
shadowColor: COLORS.black,
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.3,
shadowRadius: 4,
elevation: 5,
},
suggestionItem: {
padding: 12,
borderBottomWidth: 1,
borderBottomColor: COLORS.border, // Separador
},
// Remove borderBottom for the last item
lastSuggestionItem: {
padding: 12,
},
suggestionText: {
fontSize: 16,
color: COLORS.textPrimary, // Texto principal
},
suggestionDetails: {
fontSize: 13,
color: COLORS.textSecondary, // Texto secundário (endereço completo/detalhes)
marginTop: 3,
},
noResults: {
padding: 12,
alignItems: 'center',
// borderTopWidth: 1, // No need for top border if list is empty
// borderTopColor: COLORS.border,
backgroundColor: COLORS.surface, // Mesma cor de fundo da lista
borderBottomLeftRadius: 8, // Arredondar borda inferior
borderBottomRightRadius: 8,
},
noResultsText: {
fontSize: 15,
color: COLORS.textSecondary,
},

// Styles for initial loading and permission screens
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
  textAlign: 'center', // Added for better text centering
},
 errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.danger, // Error color
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
    backgroundColor: COLORS.secondary, // Action color
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
    marginTop: 15, // More space above
    paddingVertical: 8,
    alignSelf: 'center', // Centraliza o botão
  },
  clearButtonText: {
     color: COLORS.textSecondary, // Subtle color
     fontSize: 14,
     textDecorationLine: 'underline', // Sublinhado
 },
loadingLogo: { // Substitua com o caminho e estilo da sua logo
     width: SCREEN_WIDTH * 0.5, // metade da largura da tela
     height: SCREEN_WIDTH * 0.3, // altura proporcional
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
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

});

