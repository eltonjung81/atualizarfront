

// FreightScreen refatorado com Mapbox e Autocomplete integrado no modal
import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, SafeAreaView, Modal, FlatList
} from 'react-native';

// Importe do Mapbox React Native SDK
import MapboxGL from "@rnmapbox/maps";

// Opcional: importe Constants para acessar variáveis do app.config.js
import Constants from 'expo-constants';
// A chave API do Mapbox está em .env e configurada via plugin no app.config.js.
// Ela deve estar acessível nativamente para o SDK, mas se precisar no JS/RN:
// const MAPBOX_PUBLIC_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || Constants.expoConfig.extra.mapboxAccessToken; // Access via ENV variable

// Se por algum motivo a config global não funcionar imediatamente após o build EAS, você PODE
// setar o token diretamente no JS, MAS USE VARIÁVEIS DE AMBIENTE PARA ISSO EM PRODUÇÃO!
// MapboxGL.setAccessToken(MAPBOX_PUBLIC_ACCESS_TOKEN);


import * as Location from 'expo-location';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons'; // Importe FontAwesome para ícone Money

// Opcional: Lib para debounce para chamadas de autocomplete
// npm install lodash.debounce
// import debounce from 'lodash.debounce';


const SCREEN_HEIGHT = Dimensions.get('window').height;
const IS_IOS = Platform.OS === 'ios';
const { width: SCREEN_WIDTH } = Dimensions.get('window'); // Adiciona SCREEN_WIDTH para estilos absolutos


// Definição de estilo padrão Mapbox - use seu Style URL aqui
const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/dark-v11'; // Ou 'mapbox://styles/seu_username/seu_style_id'

// Cores e estilos para marcadores (consistentes com seus estilos RN)
const COLOR_COLETA = '#4caf50'; // Verde
const COLOR_ENTREGA = '#f44336'; // Vermelho
const COLOR_USER = '#ffa726'; // Laranja
const COLOR_ROUTE_LINE = '#ffa726'; // Laranja para linha reta no resumo

// Estilos para ícones de marcadores customizados - MapboxGL.MarkerView é recomendado
const MARKER_SIZE = 30; // Tamanho base do círculo/View do marcador

// API Base URL para Mapbox Search (v3)
const MAPBOX_SEARCH_API_URL = 'https://api.mapbox.com/search/v3/';


const initialState = {
  step: 1, // 1: Descrição, 2/3: Seleção Localização (via Modal), 4: Agendamento, 5: Resumo
  description: '',
  pickup: null, // { latitude, longitude, address? } - Opcional: Adicionar address aqui depois da geocodificação
  delivery: null, // { latitude, longitude, address? }
  scheduling: 'now',
  scheduledDate: null,
  loading: false, // Loading para confirmar frete
  currentLocation: null, // Localização do usuário { latitude, longitude }
  showDatePicker: false,

  // --- Estados para Autocomplete no Modal ---
  locationSearchText: '',
  locationSuggestions: [], // Lista de { place_name, geometry: { coordinates: [lng, lat] } }
  isSearchingLocations: false, // Indicador de busca por autocomplete
  // -----------------------------------------
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
  // Ref para o MapView no Resumo (step 5) - Pode ser útil, mas menos crítico
  const mapSummaryRef = useRef(null); // Ref para o mapa NO RESUMO

  // Obtenha o token Mapbox se for necessário acessá-lo no JS/RN (Ex: para API Search)
   // MapboxGL.accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN; // Tente setar globalmente se o plugin não o fizer

  // --- Efeito inicial para localização ---
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Não foi possível acessar sua localização.');
        return;
      }
      try {
         const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 10000 }); // timeout menor para obter mais rápido
         const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
         dispatch({ currentLocation: coords });

         // Não anima o mapa principal AQUI porque ele está DENTRO DO MODAL e não existe ainda.
         // A animação para o current location ocorrerá QUANDO o modal for aberto (no effect abaixo).

         // Opcional: Fazer geocode reverso no current location para mostrar endereço do usuário na UI? (Feature separada)

      } catch (error) {
         console.error("Erro ao obter localização inicial:", error);
          Alert.alert("Erro", "Não foi possível obter sua localização atual. A funcionalidade 'Usar minha localização' pode não funcionar.");
          dispatch({ currentLocation: null }); // Garante que o estado é null em caso de erro
      }

    })();
     // Cleanup for location watcher can be added if you watch location continuously.
     // Currently using getCurrentPositionAsync once.
  }, []); // Dependências vazias para rodar apenas uma vez


  // --- Efeito para animar o mapa NO MODAL quando ele abre ou localizações são selecionadas ---
   useEffect(() => {
       // Este effect só deve rodar quando o modal Visible muda para true E a ref do mapa modal existir
       if (modalVisible && mapModalRef.current) {
            const targetCoord = selectingPickup ? (state.pickup || state.currentLocation) : (state.delivery || state.currentLocation);
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
                       centerCoordinate: [-47.93, -15.78],
                        zoomLevel: 11,
                        animationDuration: 800,
                    });
                 } catch (e) { console.error("Erro ao animar câmera modal padrão:", e); }
            }

            // Resetar autocomplete states ao abrir modal para nova seleção
            dispatch({ locationSearchText: '', locationSuggestions: [], isSearchingLocations: false });
       }
       // Este effect também pode ser acionado se state.pickup/delivery mudar ENQUANTO O MODAL ESTIVER VISÍVEL
       // (ex: selecionou locationSuggestions, queremos animar o mapa do modal para o ponto selecionado)
   }, [modalVisible, state.currentLocation, state.pickup, state.delivery, selectingPickup, mapModalRef]); // Depende desses estados/ref

   // --- Efeito para lidar com Geocodificação Reversa (LatLng para Endereço Legível) ---
    // Roda sempre que state.pickup ou state.delivery mudar
    // Opcional: Desative isso se seu backend fará a geocodificação reversa.
   useEffect(() => {
        const geocode = async (coords, isPickup) => {
             if (!coords) return;
            console.log("[Geocode Effect] Fazendo geocode reverso para:", coords, isPickup ? 'pickup' : 'delivery');
             try {
                // Verifique se a chave de acesso Mapbox está acessível
                 const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN; // OU MapboxGL.accessToken;
                 if (!accessToken) {
                      console.error("Chave Mapbox não disponível para geocode reverso.");
                     // Opcional: Alertar ou atualizar o estado com erro de geocode
                     return;
                 }

                // Endpoint Mapbox Search API para Geocodificação Reversa
                 const url = `https://api.mapbox.com/search/v3/reverse_geocode?longitude=${coords.longitude}&latitude=${coords.latitude}&access_token=${accessToken}`;

                 const response = await fetch(url);
                 const data = await response.json();

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
                    // Manter coords, setar address como "Endereço não encontrado" ou null
                    if (isPickup && !state.pickup.address) dispatch({ pickup: { ...coords, address: "Endereço não encontrado" } });
                    if (!isPickup && !state.delivery.address) dispatch({ delivery: { ...coords, address: "Endereço não encontrado" } });
                 }

             } catch (error) {
                 console.error(`[Geocode Effect] Erro ao fazer geocode reverso para ${isPickup ? 'pickup' : 'delivery'}:`, error);
                 // Opcional: Tratar erro de geocode
                 if (isPickup && !state.pickup.address) dispatch({ pickup: { ...coords, address: "Erro ao buscar endereço" } });
                 if (!isPickup && !state.delivery.address) dispatch({ delivery: { ...coords, address: "Erro ao buscar endereço" } });
             }
        };

        // Geocode apenas se a coordenada foi definida PELA PRIMEIRA VEZ ou alterada.
        // Evita geocode loops. Só chama se tiver latitude e longitude e AINDA NÃO tiver um endereço.
        if (state.pickup?.latitude && state.pickup?.longitude && !state.pickup.address) {
            geocode(state.pickup, true);
        }
       if (state.delivery?.latitude && state.delivery?.longitude && !state.delivery.address) {
           geocode(state.delivery, false);
       }
   }, [state.pickup?.latitude, state.pickup?.longitude, state.delivery?.latitude, state.delivery?.longitude]); // Depende das coordenadas


   // --- Função de Debounce para Autocomplete Search ---
   // Cria uma função debounce fora dos componentes e effects ou usa useCallback+timeout
   // Usar um useRef para o timeout ID é comum para debounce simples em effects

   const debounceTimeoutRef = useRef(null); // Ref para armazenar o ID do timeout


    // Função para chamar a API Mapbox Search (Autocomplete) - useCallback é importante aqui
   const fetchLocationSuggestions = useCallback(async (text, searchType) => {
        if (text.length < 3) { // Busca apenas com 3 ou mais caracteres
             dispatch({ locationSuggestions: [] });
            return;
        }
         dispatch({ isSearchingLocations: true });

       try {
            const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN; // Ou MapboxGL.accessToken;
            if (!accessToken) {
                console.error("Chave Mapbox não disponível para autocomplete.");
                dispatch({ isSearchingLocations: false });
                return;
            }
            // Mapbox Search API v3 Autocomplete/Autofill
            // Autofill (novo) é geralmente melhor para sugestões enquanto digita.
            // discover/search (v1/v2) ou geocoding (v1/v3) podem ser usados para busca "final" após seleção ou geocode reverso
             const query = encodeURIComponent(text);
             // Adicione proximity baseado no currentLocation do usuário se disponível
             const proximity = state.currentLocation ?
                `&proximity=${state.currentLocation.longitude},${state.currentLocation.latitude}` : ''; // Mapbox usa [lng, lat]
            // Opcional: Restringir por país, tipo, etc.
            // const country = '&country=BR';
            // const types = '&types=address,place,poi'; // Tipos de resultados desejados

            const url = `${MAPBOX_SEARCH_API_URL}autofill?q=${query}${proximity}&access_token=${accessToken}`; // &session_token=SEU_TOKEN (opcional)

            console.log("[Autocomplete] Chamando API:", url);
            const response = await fetch(url);
             if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            console.log("[Autocomplete] Resultados:", data.suggestions);

             // Atualiza estado com as sugestões. Mapbox Autofill v3 retorna 'suggestions'
            if (data.suggestions) {
                 dispatch({ locationSuggestions: data.suggestions }); // As sugestões já contêm o place_name e os coords
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
             // Se menos de 3 caracteres, limpa as sugestões
            dispatch({ locationSuggestions: [] });
       }

        // Cleanup function: limpa timeout se o componente desmontar ou o search text/fetchSuggestions mudar
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
       };
    }, [state.locationSearchText, fetchLocationSuggestions]); // Depende do texto digitado e da função de fetch

   // --- Função para selecionar uma sugestão do Autocomplete ---
   const selectLocationFromSuggestion = useCallback(async (suggestion) => {
        console.log("[Autocomplete Select] Selecionada:", suggestion);
        // Autofill suggestion não NECESSARIAMENTE inclui coords diretamente.
        // Precisamos fazer um Geocode explícito usando o `mapbox.place_id` ou `feature.geometry`
        // Se suggestion já tiver `coordinates` na v3 autofill: use-os.
        // SE NÃO tiver coords na autofill suggestion (common):
        // Precisamos chamar a API SEARCH (v3 /v3/retrieve?) ou GEOCoding (v1 /geocoding/v5) com o place_id ou texto completo
        // para obter os detalhes completos, incluindo a coordenada precisa.
        // V3 Autofill V3 API Doc: Uma `suggestion` tem um `mapbox_id`.
        // Você usa `mapbox_id` no endpoint `/search/v3/retrieve` para pegar os detalhes, incluindo coordenadas.

        dispatch({ isSearchingLocations: true, locationSuggestions: [] }); // Limpa sugestões, mostra loading opcionalmente

        try {
             const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN; // Ou MapboxGL.accessToken;
             if (!accessToken) {
                console.error("Chave Mapbox não disponível para retrieve.");
                 dispatch({ isSearchingLocations: false });
                 return;
             }

             // Endpoint Retrieve para obter detalhes (inclui coordinates)
             // https://api.mapbox.com/search/v3/retrieve/<mapbox_id>?access_token=YOUR_ACCESS_TOKEN
             const url = `${MAPBOX_SEARCH_API_URL}retrieve/${suggestion.mapbox_id}?access_token=${accessToken}`;

            const response = await fetch(url);
             if (!response.ok) throw new Error(`API Error: ${response.status}`);
             const data = await response.json();

             if (data.features && data.features.length > 0) {
                 const feature = data.features[0];
                 const [longitude, latitude] = feature.geometry.coordinates; // Coordenada [lng, lat] do local selecionado
                 const address = feature.properties.full_address || feature.properties.place_formatted || feature.text;

                 const selectedCoord = { latitude, longitude, address };

                 // Atualiza o estado (pickup ou delivery)
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
                           zoomLevel: 15, // Zoom no local selecionado
                           animationDuration: 800,
                       });
                   } catch (e) { console.error("Erro ao animar câmera após selecionar autocomplete:", e); }
                 }

                // Limpar o termo de busca após seleção
                dispatch({ locationSearchText: '', locationSuggestions: [] });

            } else {
                console.warn("Retrieve failed or no feature found for suggestion:", suggestion);
                 // Opcional: Mostrar um alerta ou mensagem de erro
                 Alert.alert("Erro na Seleção", "Não foi possível obter os detalhes do local. Tente clicar no mapa.");
                  dispatch({ isSearchingLocations: false }); // Garantir que loading para
            }

        } catch (error) {
             console.error("Erro no processo de seleção/retrieve do autocomplete:", error);
              Alert.alert("Erro na Busca", "Não foi possível buscar detalhes do local. Tente novamente.");
              dispatch({ isSearchingLocations: false });
        }
    }, [selectingPickup, mapModalRef]); // Depende do tipo de seleção (pickup/delivery) e da ref do mapa


  // --- UI Helper para Renderizar Items da FlatList de Sugestões ---
  const renderSuggestionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
       onPress={() => selectLocationFromSuggestion(item)} // Chame a função para selecionar sugestão
    >
      <Text style={styles.suggestionText}>{item.place_name || item.text}</Text>
       {/* Mapbox Autofill v3 pode ter place_name ou text como label principal */}
       {item.address?.place_formatted && <Text style={styles.suggestionDetails}>{item.address.place_formatted}</Text>} {/* Mostrar endereço formatado se disponível */}
    </TouchableOpacity>
  );


  // --- Implementação da UI ---

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.title}>🚚 Solicitação de Frete</Text>

          {state.step === 1 && (
            <>
              <Text style={styles.label}>Descreva a carga:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Geladeira, sofá, caixas..."
                placeholderTextColor="#aaa"
                multiline
                value={state.description}
                onChangeText={(text) => dispatch({ description: text })}
              />
               {/* Mantido botão para prosseguir após descrição */}
              <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
                 <Text style={styles.nextText}>Confirmar descrição</Text>
               </TouchableOpacity>
             {/* REMOVIDO - "Escolher Local Coleta" - A navegação para o modal acontecerá no próximo step */}
            </>
          )}

          {/* === Oculta Step 4 e 5 e o ScrollView quando modal estiver visível para evitar duplicação === */}
          {/* Renderiza conteúdo principal apenas se o modal NÃO estiver visível */}
          {!modalVisible && (
              <>
                  {/* Botão para IR para seleção de localizações (só aparece após step 1) */}
                  {(state.step === 2 || state.step === 3) && (
                      <View style={{ alignItems: 'center' }}>
                           {/* Exibir locais selecionados até agora (opcional, visualização simples) */}
                           {state.pickup && <Text style={styles.summaryText}>Coleta: {state.pickup.address || `${state.pickup.latitude.toFixed(4)}, ${state.pickup.longitude.toFixed(4)}`}</Text>}
                            {state.delivery && <Text style={styles.summaryText}>Entrega: {state.delivery.address || `${state.delivery.latitude.toFixed(4)}, ${state.delivery.longitude.toFixed(4)}`}</Text>}
                           {!(state.pickup && state.delivery) && <Text style={styles.panelSubtext}>Selecione os locais no mapa ou busque por endereço.</Text>} {/* Mensagem guia */}

                           <TouchableOpacity
                              style={styles.nextButton}
                               // Se ainda não selecionou pickup, vai para pickup. Senão, se não selecionou delivery, vai para delivery.
                              onPress={() => {
                                  if (!state.pickup) openMapModal(true); // Vai selecionar Pickup
                                  else if (!state.delivery) openMapModal(false); // Vai selecionar Delivery
                                   // Se ambos selecionados, deveria ter ido para o step 4 no confirmLocation
                                }}
                            >
                                 <Text style={styles.nextText}>
                                     {!state.pickup ? 'Selecionar Local de Coleta' : (!state.delivery ? 'Selecionar Local de Entrega' : 'Locais Selecionados (Avançar)')} {/* Texto dinâmico */}
                                 </Text>
                            </TouchableOpacity>

                           {/* Opcional: Botão para editar locais selecionados */}
                            {(state.pickup || state.delivery) && (
                                <TouchableOpacity onPress={() => dispatch({ pickup: null, delivery: null })} style={styles.subtleButton}>
                                   <Text style={styles.clearButtonText}>Limpar Locais Selecionados</Text>
                                </TouchableOpacity>
                           )}
                       </View>
                  )}


                   {/* Passo de Agendamento */}
                  {state.step === 4 && (
                    <View>
                      <Text style={styles.label}>Quando deseja que o frete aconteça?</Text>
                      <View style={styles.cardRow}>
                        <TouchableOpacity style={[styles.card, state.scheduling === 'now' && styles.selectedCard]} onPress={() => dispatch({ scheduling: 'now', scheduledDate: null })}>
                          <Ionicons name="time" size={28} color="#fff" />
                          <Text style={styles.cardText}>Agora</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.card, state.scheduling === 'schedule' && styles.selectedCard]} onPress={() => dispatch({ scheduling: 'schedule' })}>
                          <Ionicons name="calendar" size={28} color="#fff" />
                          <Text style={styles.cardText}>Agendar</Text>
                        </TouchableOpacity>
                      </View>
                      {state.scheduling === 'schedule' && (
                        <>
                          <TouchableOpacity style={styles.input} onPress={() => dispatch({ showDatePicker: true })}>
                            <Text style={{ color: state.scheduledDate ? '#fff' : COLORS.textHint }}>
                               {state.scheduledDate ? state.scheduledDate.toLocaleString() : 'Escolher Data/Hora'}
                            </Text>
                          </TouchableOpacity>
                          <DateTimePickerModal
                            isVisible={state.showDatePicker}
                            mode="datetime"
                            onConfirm={(date) => dispatch({ scheduledDate: date, showDatePicker: false })}
                            onCancel={() => dispatch({ showDatePicker: false })}
                            minimumDate={new Date()}
                          />
                           {/* <Text style={{ color: '#fff', marginTop: 5 }}>{state.scheduledDate ? `Agendado para: ${state.scheduledDate.toLocaleString()}` : ''}</Text> */} {/* Mover texto para dentro do input-like */}
                        </>
                      )}
                       {/* Botão para ir para o resumo (step 5) */}
                      <TouchableOpacity style={styles.nextButton} onPress={proceedToNext}>
                        <Text style={styles.nextText}>Ver Resumo e Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                   {/* Estado: Resumo com Mapa Mapbox */}
                   {state.step === 5 && (
                     <View>
                       <Text style={styles.label}>Resumo da Solicitação</Text>
                       <Text style={styles.summaryText}>Carga: {state.description}</Text>
                        {/* Mostra endereço se disponível após geocode reverso */}
                        <Text style={styles.summaryText}>Coleta: {state.pickup?.address || `${state.pickup?.latitude.toFixed(4)}, ${state.pickup?.longitude.toFixed(4)}`}</Text>
                       <Text style={styles.summaryText}>Entrega: {state.delivery?.address || `${state.delivery?.latitude.toFixed(4)}, ${state.delivery?.longitude.toFixed(4)}`}</Text>
                       <Text style={styles.summaryText}>Quando: {state.scheduling === 'now' ? 'Agora' : state.scheduledDate?.toLocaleString()}</Text>

                       {/* === Mapbox MapView no Resumo === */}
                       {state.pickup && state.delivery && ( // Renderiza MapboxGL.MapView apenas se tiver pontos
                            <MapboxGL.MapView
                                 ref={mapSummaryRef} // Ref específica para o mapa resumo
                                 style={styles.summaryMap} // Estilo reduzido
                                styleURL={MAPBOX_STYLE_URL}
                                 // Ajusta a câmera para os pontos
                                camera={{
                                     // flyTo ou fitBounds seria ideal aqui APÓS o mapa carregar
                                     // Exemplo Básico de Configuração Inicial (pode não fitar perfeitamente sem flyTo/fitBounds após render)
                                    centerCoordinate: [(state.pickup.longitude + state.delivery.longitude) / 2, (state.pickup.latitude + state.delivery.latitude) / 2],
                                     zoomLevel: 10, // Zoom inicial
                                }}
                                 // Mapa resumo NÃO é interativo
                                scrollEnabled={false}
                                zoomEnabled={false}
                                pitchEnabled={false}
                                rotateEnabled={false}
                            >
                                 {/* === Adicionar Componentes Mapbox (Annotations/Markers e Shapes/Polylines) === */}

                                 {/* Marcadores de Coleta e Entrega no Resumo */}
                                <MapboxGL.PointAnnotation
                                    id="pickupSummaryLocation"
                                    coordinate={[state.pickup.longitude, state.pickup.latitude]}
                                    title="Coleta"
                                >
                                     {/* Marcador Visual SIMPLES para Coleta no Resumo */}
                                    <View style={{ width: MARKER_SIZE*0.8, height: MARKER_SIZE*0.8, backgroundColor: COLOR_COLETA, borderRadius: MARKER_SIZE*0.4, borderWidth: 2, borderColor: '#fff' }} />
                                </MapboxGL.PointAnnotation>
                                 <MapboxGL.PointAnnotation
                                    id="deliverySummaryLocation"
                                    coordinate={[state.delivery.longitude, state.delivery.latitude]}
                                    title="Entrega"
                                >
                                    {/* Marcador Visual SIMPLES para Entrega no Resumo */}
                                     <View style={{ width: MARKER_SIZE*0.8, height: MARKER_SIZE*0.8, backgroundColor: COLOR_ENTREGA, borderRadius: MARKER_SIZE*0.4, borderWidth: 2, borderColor: '#fff' }} />
                                </MapboxGL.PointAnnotation>


                                {/* Polyline da Rota (linha reta) no Resumo */}
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


                       <TouchableOpacity style={styles.confirmButton} onPress={confirmRequest}>
                         {state.loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirmar Frete</Text>}
                       </TouchableOpacity>
                    </View>
                   )}

               {/* Renderiza Placeholder para passos 2 e 3 (seleção de localização) fora do modal e resumo */}
                {(state.step === 2 || state.step === 3) && (
                     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        {/* Texto informativo ou placeholder */}
                         <MaterialIcons name="map" size={80} color={COLORS.textSecondary + '80'} style={{marginBottom: 20}}/>
                         <Text style={[styles.panelSubtext, {fontSize: 18, fontWeight: 'bold'}]}>Aguardando seleção dos locais no mapa...</Text>
                        <Text style={styles.panelSubtext}>Abra o modal clicando no botão abaixo para escolher {selectingPickup ? 'Coleta' : 'Entrega'}.</Text>

                          {/* Botão para abrir o modal se estiver nos steps 2 ou 3 */}
                           <TouchableOpacity
                                style={styles.nextButton}
                               onPress={() => openMapModal(!state.pickup ? true : false)} // Se pickup não foi selecionado, abrir para pickup, senão para delivery
                           >
                                 <Text style={styles.nextText}>
                                     {!state.pickup ? 'Abrir Mapa para Selecionar Coleta' : (!state.delivery ? 'Abrir Mapa para Selecionar Entrega' : 'Editar Locais no Mapa')} {/* Texto dinâmico */}
                                 </Text>
                           </TouchableOpacity>

                            {/* Botão para limpar se já selecionou algo */}
                             {(state.pickup || state.delivery) && (
                                  <TouchableOpacity onPress={() => dispatch({ pickup: null, delivery: null, locationSearchText: '', locationSuggestions: [] })} style={styles.subtleButton}>
                                     <Text style={styles.clearButtonText}>Limpar Locais Selecionados</Text>
                                  </TouchableOpacity>
                              )}
                      </View>
                   )}


         {/* --- Modal de Mapa com MapboxGL (Substituição e Adição Autocomplete) --- */}
        <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
             <SafeAreaView style={{ flex: 1, backgroundColor: '#1e1e1e' }}>

                 {/* Header do Modal */}
                 <View style={styles.modalHeader}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setModalVisible(false)}>
                         <Ionicons name="close" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                     <Text style={styles.modalTitle}>{selectingPickup ? '📍 Local de COLETA' : '🚚 Local de ENTREGA'}</Text>
                     {/* Espaço para centralizar o título */}
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
                         pitchEnabled={true}
                         rotateEnabled={true}
                         onPress={onMapPress} // Captura toques no mapa do modal
                     >
                         {/* Mostrar a localização atual do usuário */}
                         {/* Tenta usar o LocationPuck nativo com MapboxGL.UserLocation */}
                         <MapboxGL.UserLocation
                             androidRenderMode={'gps'} // Melhor para seguir no Android
                             showsUserHeadingIndicator={true} // Mostra direção no Android
                             // renderMode={'normal'} // Default, mas pode tentar outros como 'navigation'
                            visible={true} // Tenta forçar visibilidade
                            // onPress prop para centralizar/usar local atual? A doc pode ter detalhes
                         />
                          {/* Alternativa para ponto azul do usuário: MarkerView */}
                          {/* {state.currentLocation && (
                              <MapboxGL.MarkerView id="userCurrentLocationMarker" coordinate={[state.currentLocation.longitude, state.currentLocation.latitude]}>
                                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'blue', borderWidth: 3, borderColor: 'white' }} />
                              </MapboxGL.MarkerView>
                          )} */}


                         {/* === Adicionar Marcador PONTO VERDE/VERMELHO TEMPORÁRIO no Mapa DO MODAL === */}
                          {/* Este é o marcador que aparece onde o usuário TOCOU no mapa no Modal */}
                         {(selectingPickup ? state.pickup : state.delivery) && (
                              <MapboxGL.PointAnnotation
                                   id="tempSelectedLocationModal"
                                  coordinate={[
                                      (selectingPickup ? state.pickup.longitude : state.delivery.longitude),
                                      (selectingPickup ? state.pickup.latitude : state.delivery.latitude)
                                   ]}
                                  title={selectingPickup ? 'Coleta' : 'Entrega'}
                                  // MarkerView para ícone MaterialIcons Pin customizado no Modal
                              >
                                  <View style={{ backgroundColor: selectingPickup ? COLOR_COLETA : COLOR_ENTREGA, padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#fff' }}>
                                     <MaterialIcons name="location-pin" size={20} color="#fff" />
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
                          />
                           {/* Indicador de Loading enquanto busca sugestões */}
                           {state.isSearchingLocations && (
                               <ActivityIndicator size="small" color={COLORS.primary} style={styles.autocompleteLoading} />
                           )}

                           {/* Lista de Sugestões (Condicional) */}
                           {/* Renderiza a lista apenas se houver sugestões e não estiver vazio */}
                           {state.locationSuggestions.length > 0 && ( // && !state.isSearchingLocations
                              <FlatList
                                   data={state.locationSuggestions}
                                  keyExtractor={(item) => item.mapbox_id || item.name} // Mapbox id é mais confiável
                                  renderItem={renderSuggestionItem} // Usa a função helper de renderização
                                   style={styles.suggestionsList}
                                   keyboardShouldPersistTaps="always" // Importante para tocar nos items da lista sem fechar teclado/lista
                                   // Defina um limite de altura para a lista para não cobrir tudo
                                  maxHeight={SCREEN_HEIGHT * 0.3} // Exemplo: max 30% da tela de altura
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
                {selectingPickup && ( // Apenas na seleção de Coleta
                     <TouchableOpacity onPress={useMyLocation} style={styles.useLocationBtn}>
                       <MaterialIcons name="my-location" size={20} color={COLORS.white} style={{marginRight: 5}}/>
                        <Text style={styles.useLocationText}>Usar minha localização atual</Text>
                     </TouchableOpacity>
                   )}

                 {/* Botão "Confirmar Local" no Modal */}
                  {/* Habilita apenas se um local (pickup ou delivery) tiver sido selecionado (via toque OU autocomplete) */}
                 <TouchableOpacity
                    onPress={confirmLocation}
                    style={[styles.confirmButtonModal, (!state.pickup && selectingPickup) || (!state.delivery && !selectingPickup) ? styles.buttonDisabled : {}]}
                     disabled={(!state.pickup && selectingPickup) || (!state.delivery && !selectingPickup)} // Desabilita se a localização atual NÃO ESTÁ definida
                  >
                     <Text style={styles.confirmText}>Confirmar Local de {selectingPickup ? 'Coleta' : 'Entrega'}</Text>
                 </TouchableOpacity>


             </SafeAreaView>
         </Modal>
        {/* Fim Modal de Mapa */}


        {/* Telas de Loading e Permissão - MANTIDAS INALTERADAS */}
         {/* ... Seu código para loading e permissionDenied containers ... */}
          {/* Reative estes blocos de JSX que foram comentados para evitar renderização enquanto o modal está visível */}
          {/* Lembre-se que o condicional !modalVisible foi adicionado lá em cima para renderizar estes elementos. */}


      </KeyboardAvoidingView>
       {/* Seções de loading/erro */}
         {/* Exibe telas de loading ou permissão antes do conteúdo principal (agora envolve o SafeAreaView principal) */}
        {/* Este JSX pode precisar ser movido para um componente externo ou gerenciado no App.js/Navigator para evitar lógica complexa de renderização condicional */}
        {/* Mantido como no original por agora, mas saiba que renderizar TODOS os blocos (loading, modal, principal) condicionalmente no mesmo nível pode ter side effects */}


           {/* Código de Renderização para telas de loading / permissão negada. Mantido inalterado */}
           {/* Certifique-se de que estas seções NÃO são renderizadas quando a UI principal está ativa */}
           {/* Seu código original parecia renderizá-los se `!currentUser || isLocationPermissionGranted === null || ...` fosse true */}

          {/* Exibe tela de carregamento inicial */}
          {/* isLocationPermissionGranted === null: Verifica permissão pela primeira vez */}
          {/* !currentLocation && isLocationPermissionGranted === true && ...: Permissão concedida mas localização ainda não obtida */}
          {/* appStateError && currentUser && ...: Erro no estado do app, mas usuário existe e permissão não negada definitivamente */}
         {/* ATENÇÃO: Estas condições de renderização de loading/permissão DEVEM estar no nível superior da função, antes do return principal,
              para garantir que substituam TODA a UI abaixo. Seu código original parece ter essa estrutura.
               Vamos manter a estrutura original de renderização condicional de "telas cheias" para loading/erro. */}

         {/* Remova o render condicional !modalVisible se mover as telas de loading/erro para fora */}
          {/* A tela principal SÓ deve renderizar SE `isLocationPermissionGranted === true` E `currentUser` existir e NÃO houver `appStateError` */}


         {/* Reativei os comentários do JSX original de loading/error aqui */}
         {/* --- Renderização de Loading e Erro (Mantido, verifique a estrutura original de renderização) --- */}
           {/* Se o código chegar aqui, é loading ou permissão negada (tratado abaixo) */}
           {/* if (isLocationPermissionGranted === false) { // Cai no próximo if } */}
           {/* else { // Estado geral de loading (sem erro específico ou permissão negada) return (... loading UI ...); } */}
           {/* Permissão de localização negada */}
           {/* if (isLocationPermissionGranted === false) { return (... permission denied UI ...); } */}
         {/* --- Fim Renderização de Loading e Erro --- */}


     </SafeAreaView>
   );
 }

// --- Estilos ---
// Adicionados estilos para autocomplete no modal
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e1e1e' },
  inner: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffa726', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, color: '#fff', marginBottom: 10 },
  input: { backgroundColor: '#333', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 20 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { backgroundColor: '#333', padding: 16, borderRadius: 12, width: '48%', alignItems: 'center' },
  selectedCard: { backgroundColor: '#ffa726' },
  cardText: { color: '#fff', marginTop: 10 },
  nextButton: { backgroundColor: '#ffa726', padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', minWidth: '80%' },
  nextText: { color: '#1e1e1e', textAlign: 'center', fontWeight: 'bold' },
  confirmButton: { backgroundColor: '#4caf50', padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', minWidth: '80%' },
  confirmText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
   // Novo estilo para o botão de confirmação no modal para não ter conflito de nome
  confirmButtonModal: { backgroundColor: '#4caf50', padding: 15, borderRadius: 25, marginTop: 20, alignSelf: 'center', minWidth: '80%' },
   buttonDisabled: {
      backgroundColor: '#aaa', // Cinza para botão desabilitado
       opacity: 0.8,
    },

  summaryText: { color: '#eee', marginBottom: 5 },
   // Estilo para o mapa pequeno no resumo (step 5)
   summaryMap: {
      height: 200,
      marginVertical: 10,
      borderRadius: 10,
       overflow: 'hidden',
       // Para Mapbox, adicione styles relacionados a sua altura e margens aqui
   },

   // Estilos para o botão "Usar minha localização" no modal
  useLocationBtn: {
     flexDirection: 'row', // Ícone e texto
    backgroundColor: '#616161', padding: 12, borderRadius: 10, marginTop: 10, alignSelf: 'center', minWidth: '80%', justifyContent: 'center', alignItems: 'center'
   },
  useLocationText: { color: '#fff', textAlign: 'center' },


   // --- Estilos para o Modal ---
   modalHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       paddingHorizontal: 10,
       paddingTop: 10,
       backgroundColor: '#1e1e1e',
       width: '100%',
   },
   modalTitle: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#ffa726',
     textAlign: 'center',
     flex: 1,
   },
   modalMapContainer: {
       flex: 1, // Permite que o mapa e autocomplete ocupem o espaço restante no modal
        position: 'relative', // Para posicionar autocomplete absoluto DENTRO deste container
       borderRadius: 10, // Para consistência visual com o resumo
       overflow: 'hidden', // Garante bordas arredondadas para o mapa
   },
  modalMap: {
       flex: 1, // Ocupa todo o espaço disponível no container
        // Remove margin/padding aqui, o container cuida
   },
    // --- Estilos para Autocomplete (no Modal) ---
    autocompleteContainer: {
        position: 'absolute', // Posiciona em cima do mapa
        top: 10, // Distância do topo
        left: 10, // Distância da esquerda
        right: 10, // Distância da direita
        zIndex: 5, // Garante que fica em cima do mapa
    },
    autocompleteInput: {
        backgroundColor: COLORS.surface, // Fundo escuro
        color: COLORS.textPrimary, // Texto claro
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        // Sombra para destacar (opcional)
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    autocompleteLoading: {
        position: 'absolute',
        right: 10,
        top: 12, // Centraliza verticalmente com o input
        zIndex: 6, // Acima do input se necessário
    },
    suggestionsList: {
        backgroundColor: COLORS.surface, // Fundo para a lista
        borderRadius: 8,
        marginTop: 5, // Espaço abaixo do input
        maxHeight: SCREEN_HEIGHT * 0.3, // Limite de altura da lista
        borderWidth: 1, // Opcional: Borda sutil
        borderColor: COLORS.border,
        overflow: 'hidden', // Para que as bordas arredondadas funcionem na lista
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border, // Separador
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
         borderTopWidth: 1,
         borderTopColor: COLORS.border,
         backgroundColor: COLORS.surface, // Mesma cor de fundo da lista
         borderBottomLeftRadius: 8, // Arredondar borda inferior
         borderBottomRightRadius: 8,
     },
    noResultsText: {
         fontSize: 15,
        color: COLORS.textSecondary,
    },

     // Estilos de loading/permission re-adicionados aqui se foram removidos de cima
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e1e1e',
      padding: 20,
    },
    permissionDeniedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e1e1e',
      paddingHorizontal: 30,
    },
     errorTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ff3b30', // iOS system red
        textAlign: 'center',
        marginBottom: 10,
     },
    errorText: {
        fontSize: 16,
        color: '#dcdcdc', // light gray
        textAlign: 'center',
        lineHeight: 22,
    },
     retryButton: {
        backgroundColor: '#0a84ff', // iOS system blue
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 20,
     },
     retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
     },
     permissionButton: {
        backgroundColor: '#0a84ff', // iOS system blue
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
        marginTop: 25,
     },
     permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
     },
     subtleButton: {
        marginTop: 10,
        paddingVertical: 8,
        alignSelf: 'center', // Centraliza o botão
      },
      clearButtonText: {
         color: '#8e8e93', // iOS system gray
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
        color: '#8e8e93',
        marginTop: 10,
     },
     permissionDeniedTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 15,
     },
    permissionDeniedText: {
        fontSize: 16,
        color: '#dcdcdc',
        textAlign: 'center',
        lineHeight: 23,
        marginBottom: 20,
    },
});


