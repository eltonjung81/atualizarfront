
// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet, Alert, ImageBackground
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

// Contexto e Serviços
import { useWebSocket } from '../context/WebSocketContext';
import { sendLocalNotification } from '../services/notificationService'; // Para notificar nova msg

/**
 * Tela de Chat entre Passageiro e Motorista durante uma corrida.
 */
const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // Usa addMessageListener e sendCommand do contexto WebSocket
  const { addMessageListener, sendCommand, isConnected: isWsConnected } = useWebSocket();

  // --- Estados ---
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // Inicia carregando
  // Guarda informações essenciais do chat (definido no useEffect inicial)
  const [chatInfo, setChatInfo] = useState({
    rideId: null,
    driverName: 'Motorista',
    driverCpf: null, // Se necessário enviar para o backend
    passengerCpf: null,
    passengerName: 'Passageiro', // Para uso local se necessário
  });
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState(null); // Para evitar duplicatas
  const [soundLoaded, setSoundLoaded] = useState(false); // Controla se o som foi carregado

  // --- Referências ---
  const flatListRef = useRef(null);
  const soundRef = useRef();        // Para a instância do som de notificação
  const isScreenFocusedRef = useRef(true); // Controla se a tela está visível

  // --- Carregamento Inicial e Configuração da Tela ---
  useEffect(() => {
    const { corridaId, motoristaInfo, passageiroInfo } = route.params || {};
    console.log('[ChatScreen] Parâmetros recebidos:', { corridaId, motoristaInfo, passageiroInfo });

    if (!corridaId || !passageiroInfo?.cpf) {
      console.error('[ChatScreen] Erro Crítico: ID da corrida ou CPF do passageiro ausente!');
      Alert.alert('Erro', 'Não foi possível iniciar o chat.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      return;
    }

    // Define as informações do chat
    const info = {
      rideId: corridaId,
      driverName: motoristaInfo?.nome || 'Motorista',
      driverCpf: motoristaInfo?.cpf, // Pode ser útil
      passengerCpf: passageiroInfo.cpf,
      passengerName: passageiroInfo.nome || 'Você',
    };
    setChatInfo(info);
    console.log('[ChatScreen] Informações do Chat:', info);

    // Define o título da barra de navegação
    navigation.setOptions({ title: `Chat com ${info.driverName}` });

    // Carrega mensagens salvas do AsyncStorage
    loadMessages(corridaId);

    // Pré-carrega o som de notificação
    loadSound();

    // TODO: Opcional - Solicitar histórico recente ao backend aqui?
    // if (isWsConnected) {
    //   sendCommand({ type: 'solicitar_historico_chat', corrida_id: corridaId });
    //   setIsLoadingHistory(true); // Mostrar loading enquanto espera histórico
    // }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params, navigation]); // Executa quando os parâmetros da rota mudam


  // --- Gerenciamento de Foco ---
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      console.log('[ChatScreen] Tela em foco.');
      // Marcar mensagens como lidas aqui, se aplicável
      return () => {
        isScreenFocusedRef.current = false;
        console.log('[ChatScreen] Tela perdeu foco.');
      };
    }, [])
  );

  // --- Manipulação de Mensagens WebSocket ---
  useEffect(() => {
    // Só registra o listener se tivermos um rideId definido
    if (!chatInfo.rideId) return;

    console.log(`[ChatScreen] Adicionando listener WS para rideId: ${chatInfo.rideId}`);

    const handleWebSocketMessage = (data) => {
      // Identificador único da mensagem (se o backend fornecer)
      const messageUid = data.id || data.messageId || data.unique_id;

      // Evita processar a mesma mensagem mais de uma vez
      if (messageUid && messageUid === lastProcessedMessageId) {
        // console.log(`[ChatScreen] Ignorando mensagem WS já processada: ${messageUid}`);
        return;
      }
      if (messageUid) {
        setLastProcessedMessageId(messageUid);
      }

      // Filtra e processa mensagens de CHAT para esta corrida
      if ((data.type === 'mensagem_chat' || data.type === 'nova_mensagem') &&
          (data.corridaId === chatInfo.rideId || data.corrida_id === chatInfo.rideId))
      {
         // Processa APENAS mensagens vindas do MOTORISTA
         if (data.remetente === 'MOTORISTA') {
              console.log(`[ChatScreen] Mensagem recebida do motorista para corrida ${chatInfo.rideId}:`, data.mensagem || data.conteudo);
              const newMessage = formatIncomingMessage(data);
              addMessageToStateIfNew(newMessage); // Adiciona à UI
              playNotificationSound();            // Toca som

              // Envia notificação push LOCAL se a tela *não* estiver em foco
              if (!isScreenFocusedRef.current) {
                   sendLocalNotification(
                      `Nova mensagem de ${chatInfo.driverName}`,
                      newMessage.text
                   );
              }
          } else {
               // console.log('[ChatScreen] Mensagem do passageiro recebida (ignorar na UI).');
               // Poderia usar para atualizar status de entrega/leitura se fosse mensagem do próprio user
          }
      }
      // Outros tipos de mensagem (histórico, status, etc.)
      else if (data.type === 'historico_chat' && data.corrida_id === chatInfo.rideId) {
           console.log(`[ChatScreen] Recebido histórico com ${data.messages?.length ?? 0} mensagens.`);
           if (Array.isArray(data.messages)) {
               const formattedHistory = data.messages.map(formatIncomingMessage);
               setMessages(prev => mergeAndSortMessages(prev, formattedHistory)); // Junta e ordena
               saveMessages(chatInfo.rideId, mergeAndSortMessages(messages, formattedHistory)); // Salva estado merged
                setIsLoadingHistory(false); // Terminou de carregar (se esperava histórico)
               scrollToBottom();
            }
      } else if (data.type === 'mensagem_enviada' && data.message_id) {
           // Atualiza status da mensagem enviada localmente
           updateMessageStatus(data.message_id, 'sent');
       }
        // Adicione mais tratamentos se necessário (mensagem_lida, etc.)
    };

    // Adiciona o listener usando a função do contexto
    const removeListener = addMessageListener(handleWebSocketMessage);

    // Função de cleanup: remove o listener ao desmontar ou quando rideId muda
    return () => {
      console.log(`[ChatScreen] Removendo listener WS para rideId: ${chatInfo.rideId}`);
      removeListener();
    };
  }, [chatInfo.rideId, addMessageListener, lastProcessedMessageId, playNotificationSound]); // Dependências chave

  // --- Funções Auxiliares ---

   /** Carrega o som de notificação */
   const loadSound = useCallback(async () => {
     try {
        if (!soundRef.current) {
           console.log('[ChatScreen] Carregando som de notificação...');
           const { sound } = await Audio.Sound.createAsync(require('../../assets/alert.mp3')); // Ajuste caminho
            soundRef.current = sound;
           setSoundLoaded(true);
            console.log('[ChatScreen] Som carregado.');
       }
     } catch (error) {
        console.error('[ChatScreen] Erro ao carregar som:', error);
     }
   }, []);

   /** Toca o som de notificação */
    const playNotificationSound = useCallback(async () => {
      if (!soundLoaded || !soundRef.current) {
          console.warn('[ChatScreen] Som não carregado, tentando carregar...');
           await loadSound(); // Tenta carregar se ainda não estiver
           if(!soundRef.current) return; // Aborta se falhar
       }
      try {
         await soundRef.current.replayAsync(); // Toca do início
       } catch (error) {
         console.error('[ChatScreen] Erro ao tocar som:', error);
       }
    }, [soundLoaded, loadSound]);


   /** Formata uma mensagem recebida do WebSocket para o estado local */
  const formatIncomingMessage = (data) => {
    const timestamp = data.timestamp || data.data || new Date().toISOString();
    const dateObj = new Date(timestamp);
    const timeString = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    return {
      id: data.id || data.messageId || data.unique_id || `msg_${dateObj.getTime()}_${Math.random()}`, // ID robusto
      text: data.mensagem || data.conteudo || data.message || '', // Conteúdo da mensagem
       sender: (data.remetente === 'MOTORISTA' || data.sender === 'motorista') ? 'motorista' : 'passageiro', // Identifica remetente
      timestamp: timestamp,
      status: 'received', // Status padrão para recebidas
      time: timeString,   // Hora formatada para exibição
    };
  };

   /** Adiciona uma mensagem à lista, evitando duplicatas e ordenando */
    const addMessageToStateIfNew = useCallback((newMessage) => {
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
        if (messageExists) {
          // console.log(`[ChatScreen] Ignorando adição de msg duplicada: ${newMessage.id}`);
          return prevMessages;
        }
        const updated = [...prevMessages, newMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        saveMessages(chatInfo.rideId, updated); // Salva estado atualizado
         scrollToBottom();
        return updated;
      });
    }, [chatInfo.rideId, scrollToBottom]); // Adicionado chatInfo.rideId e scrollToBottom como deps


   /** Atualiza o status de uma mensagem específica */
   const updateMessageStatus = useCallback((messageId, newStatus) => {
     setMessages(prevMessages => {
       let changed = false;
       const updatedMessages = prevMessages.map(msg => {
         if (msg.id === messageId && msg.status !== newStatus) {
           changed = true;
           return { ...msg, status: newStatus };
         }
         return msg;
       });

        if (changed) {
           saveMessages(chatInfo.rideId, updatedMessages); // Salva se houve mudança
         }
       return changed ? updatedMessages : prevMessages; // Retorna novo array apenas se mudou
     });
   }, [chatInfo.rideId]);

   /** Junta mensagens novas (ex: histórico) com as existentes, remove duplicatas e ordena */
   const mergeAndSortMessages = (existingMessages, newMessages) => {
        const messageMap = new Map();
        // Adiciona existentes primeiro
        existingMessages.forEach(msg => messageMap.set(msg.id, msg));
        // Adiciona/sobrescreve com novas
        newMessages.forEach(msg => messageMap.set(msg.id, msg));
        // Converte de volta para array e ordena
        return Array.from(messageMap.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    };

    /** Carrega mensagens salvas */
    const loadMessages = useCallback(async (rideId) => {
      if (!rideId) return;
      console.log(`[ChatScreen] Carregando mensagens para rideId: ${rideId}`);
      setIsLoadingHistory(true);
      try {
        const chatKey = `chat_${rideId}`;
        const savedJson = await AsyncStorage.getItem(chatKey);
        if (savedJson) {
          const loaded = JSON.parse(savedJson);
           setMessages(loaded.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
          console.log(`[ChatScreen] ${loaded.length} mensagens carregadas.`);
          // Rolar para o fim após um pequeno delay para dar tempo de renderizar
           setTimeout(scrollToBottom, 150);
        } else {
          console.log('[ChatScreen] Nenhuma mensagem salva.');
        }
      } catch (error) {
        console.error('[ChatScreen] Erro ao carregar mensagens:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }, [scrollToBottom]); // Adicionado scrollToBottom

    /** Salva mensagens no AsyncStorage */
    const saveMessages = useMemo(() => {
        // Cria um buffer/debounce para evitar salvamentos excessivos
        let saveTimeout = null;
        let pendingMessages = null;

       return (rideId, messagesToSave) => {
            if (!rideId) return;
            pendingMessages = messagesToSave; // Guarda a versão mais recente

            if (saveTimeout) clearTimeout(saveTimeout); // Cancela timeout anterior

            saveTimeout = setTimeout(async () => {
               try {
                  if (pendingMessages) {
                      const chatKey = `chat_${rideId}`;
                      // Garante que salva em ordem e apenas dados necessários
                       const dataToStore = pendingMessages.map(msg => ({
                          id: msg.id, text: msg.text, sender: msg.sender,
                           timestamp: msg.timestamp, status: msg.status, time: msg.time // Salvar a hora também
                       })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                       // console.log(`[ChatScreen] Salvando ${dataToStore.length} mensagens...`); // Log verboso
                       await AsyncStorage.setItem(chatKey, JSON.stringify(dataToStore));
                       pendingMessages = null; // Limpa após salvar
                   }
                } catch (error) {
                   console.error('[ChatScreen] Erro ao salvar mensagens (debounce):', error);
                }
            }, 500); // Salva 500ms após a última chamada
        };
    }, []); // Criado apenas uma vez

    /** Envia a mensagem digitada */
    const handleSendMessage = useCallback(() => {
      const text = inputMessage.trim();
      if (!text || !chatInfo.rideId || !isWsConnected) {
        Alert.alert("Erro", !isWsConnected ? "Sem conexão com o servidor." : "Digite uma mensagem.");
        return;
      }

       const localId = `msg_${Date.now()}_${chatInfo.passengerCpf}`; // ID local temporário
       const now = new Date();

      // Mensagem para adicionar à UI imediatamente
      const newMessage = {
        id: localId,
        text: text,
        sender: 'passageiro',
        timestamp: now.toISOString(),
        status: 'sending',
        time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
      };
      addMessageToStateIfNew(newMessage); // Adiciona e salva
      setInputMessage('');             // Limpa input
      scrollToBottom();               // Rola pra baixo

      // Comando para enviar ao WebSocket
      const command = {
        type: 'mensagem_chat',
        corrida_id: chatInfo.rideId,
        remetente: 'PASSAGEIRO',
        cpf_passageiro: chatInfo.passengerCpf, // Envia CPF do remetente
        // cpf_motorista: chatInfo.driverCpf, // Envia CPF do destinatário se necessário
        mensagem: text,
        message_id: localId, // Envia ID local para possível confirmação
      };
      console.log('[ChatScreen] Enviando comando de mensagem:', command);
      sendCommand(command);

    }, [inputMessage, chatInfo, isWsConnected, sendCommand, addMessageToStateIfNew, scrollToBottom]);


  // --- Renderização ---

  const renderMessageItem = ({ item }) => {
    const isFromMe = item.sender === 'passageiro';
    return (
      <View style={[styles.messageBubbleContainer, isFromMe ? styles.myMessage : styles.theirMessage]}>
        <LinearGradient
          colors={isFromMe ? ['#FF6B00', '#FF8C00'] : ['#3a3a3a', '#2a2a2a']}
          style={styles.messageGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{item.time}</Text>
            {isFromMe && (
              <View style={styles.statusContainer}>
                 {item.status === 'sending' && <MaterialIcons name="access-time" size={14} color="#E0E0E0" style={styles.statusIcon} />}
                 {item.status === 'sent' && <MaterialIcons name="check" size={14} color="#E0E0E0" style={styles.statusIcon}/>}
                  {/* {item.status === 'delivered' && <MaterialIcons name="done-all" size={14} color="#E0E0E0" />} */}
                 {item.status === 'read' && <MaterialIcons name="done-all" size={14} color="#64B5F6" style={styles.statusIcon}/>}
                 {item.status === 'failed' && <MaterialIcons name="error-outline" size={14} color="#EF9A9A" style={styles.statusIcon}/>}
               </View>
             )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('../../assets/chat_background.png')} // Troque por um fundo de chat sutil se desejar
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImageStyle} // Controla opacidade/modo da imagem
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} // Ajustar offset do cabeçalho
      >
        {isLoadingHistory && messages.length === 0 ? ( // Mostra loading apenas se NUNCA carregou nada
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Carregando mensagens...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()} // Garante que ID é string
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToBottom} // Tenta rolar quando conteúdo muda
            onLayout={scrollToBottom} // Tenta rolar quando layout muda
            ListEmptyComponent={
              !isLoadingHistory ? ( // Só mostra se não estiver carregando
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#555" />
                  <Text style={styles.emptyText}>Nenhuma mensagem</Text>
                  <Text style={styles.emptySubtext}>Envie a primeira mensagem para {chatInfo.driverName}.</Text>
                </View>
              ) : null // Não mostra nada se carregando e vazio
            }
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.inputField}
            placeholder="Digite sua mensagem aqui..."
            placeholderTextColor="#888"
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
            editable={isWsConnected} // Permite digitar apenas se conectado
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputMessage.trim() || !isWsConnected) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputMessage.trim() || !isWsConnected}
          >
            <Ionicons name="send" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

// --- Estilos ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // KAV transparente para ver o fundo
  },
  backgroundImage: {
    flex: 1,
    backgroundColor: '#181818', // Fundo escuro caso imagem falhe
  },
  backgroundImageStyle: {
    opacity: 0.05, // Deixa a imagem bem sutil
    resizeMode: 'repeat', // Ou 'cover', 'contain' etc.
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingVertical: 15, // Mais espaço vertical
    flexGrow: 1, // Permite que a lista cresça
  },
  messageBubbleContainer: {
    maxWidth: '80%', // Largura máxima do balão
    marginBottom: 12,
  },
  myMessage: {
    alignSelf: 'flex-end', // Mensagens do usuário à direita
  },
  theirMessage: {
    alignSelf: 'flex-start', // Mensagens do outro à esquerda
  },
  messageGradient: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 18, // Bordas arredondadas
    minWidth: 60, // Largura mínima
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21, // Melhora legibilidade
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Alinha hora e status à direita
    marginTop: 5,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  statusContainer: {
    marginLeft: 5, // Espaço entre hora e status
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: { /* Estilos adicionais se necessário */ },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1E1E1E', // Fundo da área de input
  },
  inputField: {
    flex: 1,
    backgroundColor: '#333', // Fundo do campo de texto
    color: '#FFFFFF',
    borderRadius: 20, // Bordas arredondadas
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, // Ajuste padding vertical por plataforma
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100, // Limita altura para multiline
  },
  sendButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 22, // Circular
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2, // Ajuste fino para ícone de enviar
  },
  sendButtonDisabled: {
    backgroundColor: '#666', // Cor quando desabilitado
  },
  emptyContainer: {
    flex: 1, // Ocupa espaço disponível
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200, // Garante espaço mínimo
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});

export default ChatScreen;

