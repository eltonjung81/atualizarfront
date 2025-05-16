// src/screens/ConsultaScreen.js - CORRIGIDO
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator,
  Alert, TextInput, StatusBar, Image, SafeAreaView, ScrollView, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
// Se você for usar um componente de calendário, importe-o aqui. Ex:
// import { Calendar } from 'react-native-calendars';

// Importar constantes compartilhadas
import { COLORS, SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants/theme';

// !!! REMOVIDO AQUI: const [isLoading, setIsLoading] = useState(false); !!!
// HOOKS DEVEM SER CHAMADOS DENTRO DO CORPO DO COMPONENTE OU HOOK CUSTOMIZADO

const ConsultaScreen = () => {
  // --- Estados declarados DENTRO do componente ---
  const [isLoading, setIsLoading] = useState(false); // <<<--- MOVIDO PARA CÁ: Local CORRETO para Hooks

  const navigation = useNavigation();
  const route = useRoute();
  // Supondo que currentUser é passado via route.params do SelecaoModalidadeScreen
  const currentUser = route.params?.currentUser || null; // Pode ser null inicialmente se algo der errado

  // --- Estados para Controle dos Modais ---
  const [showChoiceModal, setShowChoiceModal] = useState(true); // Começa aberto
  const [showAIChatModal, setShowAIChatModal] = useState(false);
  const [showLawyerSetupModal, setShowLawyerSetupModal] = useState(false);
  // const [showCaseDescriptionModal, setShowCaseDescriptionModal] = useState(false); // Opcional
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // --- Estados para o Chat com IA ---
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAISending, setIsAISending] = useState(false);

  // --- Estados para Consulta com Advogado ---
  const [selectedCommunicationMethod, setSelectedCommunicationMethod] = useState(null); // 'video', 'voice', 'text'
  const [caseDescription, setCaseDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(null); // Objeto Date ou string 'YYYY-MM-DD'
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]); // ex: ['09:00', '10:00']
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null); // Para o modal de confirmação


   // --- Efeito para carregar mensagens iniciais da IA ao abrir o chat ---
   useEffect(() => {
       if (showAIChatModal && aiMessages.length === 0) {
           // Adiciona a primeira mensagem da IA quando o modal abre pela primeira vez
            setAiMessages([{ id: '0', text: 'Olá! Sou seu assistente jurídico virtual. Como posso ajudar?', sender: 'ai', timestamp: new Date() }]);
       }
   }, [showAIChatModal, aiMessages.length]);


  const resetAllModalsAndState = useCallback(() => {
    setShowAIChatModal(false);
    setShowLawyerSetupModal(false);
    // setShowCaseDescriptionModal(false); // Opcional
    setShowSchedulingModal(false);
    setShowConfirmationModal(false);
    // Não resetar showChoiceModal aqui, ele é controlado por handle... functions
    // Resetar estados específicos do fluxo
    setAiMessages([]);
    setAiInputText('');
    setSelectedCommunicationMethod(null);
    setCaseDescription('');
    setSelectedDate(null);
    setAvailableTimeSlots([]);
    setSelectedTimeSlot(null);
    setBookingDetails(null);
    console.log('[Consulta] Estados da tela resetados.');
  }, []);

   // UseFocusEffect para garantir que o modal de escolha apareça ao focar na tela
   useFocusEffect(
       useCallback(() => {
           console.log('[Consulta] Tela em foco.');
           // Garante que o modal de escolha inicial esteja visível ao entrar na tela
           setShowChoiceModal(true);
           resetAllModalsAndState(); // Reseta outros estados ao focar
           return () => {
               console.log('[Consulta] Tela perdeu foco.');
               // Opcional: Fechar todos os modais ao sair da tela
               // setShowChoiceModal(false);
               // resetAllModalsAndState(); // Reseta tudo ao sair também? Depende do UX desejado.
           };
       }, [resetAllModalsAndState]) // Depende da função de reset
   );


  // --- Handlers para o Modal de Escolha Inicial ---
  const handleSelectAIChat = useCallback(() => {
    setShowChoiceModal(false);
    // A primeira mensagem da IA é adicionada no useEffect quando showAIChatModal se torna true
    setShowAIChatModal(true);
    console.log('[Consulta] Selecionado: Chat com IA.');
  }, []);

  const handleSelectLawyerConsult = useCallback(() => {
    setShowChoiceModal(false);
    setShowLawyerSetupModal(true);
    console.log('[Consulta] Selecionado: Consulta com Advogado.');
  }, []);

   // Handler para fechar o modal de escolha inicial e voltar para a tela anterior (Seleção de Modalidade)
   const handleCloseChoiceModalAndGoBack = useCallback(() => {
       setShowChoiceModal(false);
       resetAllModalsAndState(); // Reseta todos os estados antes de sair
       navigation.goBack(); // Volta para a tela anterior (SelecaoModalidadeScreen)
       console.log('[Consulta] Fechando modal de escolha, voltando...');
   }, [navigation, resetAllModalsAndState]);


  // --- Handlers para o Chat com IA ---
  const handleSendUserMessageToAI = async () => {
    if (!aiInputText.trim()) return;
    const newUserMessage = { id: String(Date.now()), text: aiInputText, sender: 'user', timestamp: new Date() };
    setAiMessages(prev => [...prev, newUserMessage]);
    const currentInput = aiInputText; // Captura o valor antes de limpar
    setAiInputText('');
    setIsAISending(true);

    // Simulação de chamada à API da IA
    console.log(`[AI CHAT] Enviando para IA: "${currentInput}"`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simula delay da API
    // Simula uma resposta da IA baseada na entrada
    const aiResponseText = currentInput.toLowerCase().includes('testamento')
        ? `Para questões sobre testamento, a legislação brasileira define que...`
        : currentInput.toLowerCase().includes('contrato')
        ? `Em relação a contratos, é essencial verificar...`
        : `Entendido. Sobre "${currentInput}", posso te fornecer algumas informações gerais...`;

    const aiResponse = { id: String(Date.now() + 1), text: aiResponseText + "\n\nLembre-se que sou uma IA e não substituo a consulta com um advogado.", sender: 'ai', timestamp: new Date() };
    setAiMessages(prev => [...prev, aiResponse]); // Adiciona a resposta da IA
    setIsAISending(false);
    console.log(`[AI CHAT] Resposta recebida.`);
  };

   // Handler para voltar do chat da IA para o modal de escolha
   const handleCloseAIChatModal = useCallback(() => {
       setShowAIChatModal(false);
       setAiMessages([]); // Limpa mensagens do chat ao fechar
       setAiInputText('');
       setIsAISending(false);
       setShowChoiceModal(true); // Volta para a tela de escolha
       console.log('[Consulta] Fechando Chat IA, voltando para escolha.');
   }, []);


  // --- Handlers para Configuração da Consulta com Advogado ---
  const handleProceedToScheduling = useCallback(() => {
    if (!selectedCommunicationMethod) {
      Alert.alert("Atenção", "Por favor, selecione o formato da consulta (Vídeo, Voz ou Texto).");
      return;
    }
    setShowLawyerSetupModal(false);
    // Decide se mostra o modal de descrição do caso (se showCaseDescriptionModal for um estado válido)
    // setShowCaseDescriptionModal(true); // Se for usar a etapa de descrição
    setShowSchedulingModal(true); // Se for direto para agendamento
    console.log(`[LAWYER] Método escolhido: ${selectedCommunicationMethod}. Indo para agendamento.`);
  }, [selectedCommunicationMethod]);

   // Handler para voltar do modal de setup do advogado para o modal de escolha
    const handleCloseLawyerSetupModal = useCallback(() => {
       setShowLawyerSetupModal(false);
       setSelectedCommunicationMethod(null); // Limpa método selecionado
       setShowChoiceModal(true); // Volta para a tela de escolha
       console.log('[Consulta] Fechando Setup Advogado, voltando para escolha.');
    }, []);


  // --- Handlers para Descrição do Caso (Opcional, se usar modal dedicado) ---
  // const handleProceedFromDescriptionToScheduling = useCallback(() => {
  //   setShowCaseDescriptionModal(false);
  //   setShowSchedulingModal(true);
  //   console.log(`[LAWYER] Descrição: ${caseDescription}. Indo para agendamento.`);
  // }, [caseDescription]);


  // --- Handlers para Agendamento ---
  const fetchTimeSlotsForDate = useCallback(async (dateString) => {
    if (!dateString) return;
    setIsLoadingSlots(true);
    setSelectedTimeSlot(null); // Limpa seleção anterior
    setAvailableTimeSlots([]);
    console.log(`[SCHEDULING] Buscando horários para ${dateString}...`);
    // Simulação de chamada à API para buscar horários disponíveis para a data E método escolhido
    // await new Promise(resolve => setTimeout(resolve, 1000));
     // TODO: Realizar chamada real à API aqui, passando selectedCommunicationMethod e dateString
     try {
          // Exemplo de chamada fictícia:
          // const response = await fetch(apiConfig.getFullApiUrl(apiConfig.API_ENDPOINTS.GET_LAWYER_SCHEDULE), {
          //     method: 'POST',
          //     headers: { 'Content-Type': 'application/json' },
          //     body: JSON.stringify({ date: dateString, method: selectedCommunicationMethod }),
          // });
          // if (!response.ok) throw new Error('Erro ao buscar horários');
          // const data = await response.json();
          // setAvailableTimeSlots(data.time_slots || []); // Supondo que o backend retorna { time_slots: ["HH:mm", ...] }

           // Usando MOCK_SLOTS enquanto a API não está pronta
           const MOCK_SLOTS = {
             "2024-07-25": selectedCommunicationMethod === 'video' ? ["09:00", "10:00", "11:00", "14:00", "15:00"] : ["09:00", "10:30", "14:00"],
             "2024-07-26": selectedCommunicationMethod === 'voice' ? ["09:30", "10:30", "14:30"] : ["10:00", "15:00"],
             "2024-07-27": selectedCommunicationMethod === 'text' ? ["11:00", "15:00", "16:30"] : [],
             // Adicione mais datas e horários simulados conforme necessário
           };
           await new Promise(resolve => setTimeout(resolve, 800)); // Simula delay
           setAvailableTimeSlots(MOCK_SLOTS[dateString] || []);
           console.log(`[SCHEDULING] Horários para ${dateString} (${selectedCommunicationMethod}):`, MOCK_SLOTS[dateString] || []);

     } catch (error) {
         console.error("[SCHEDULING] Erro ao buscar horários:", error);
         Alert.alert("Erro", "Não foi possível carregar os horários disponíveis.");
         setAvailableTimeSlots([]);
     } finally {
         setIsLoadingSlots(false);
     }
  }, [selectedCommunicationMethod]); // Depende do método de comunicação para buscar horários específicos

  const handleDateSelect = useCallback((day) => { // 'day' viria do react-native-calendars
    // const dateString = day.dateString; // Formato 'YYYY-MM-DD' do react-native-calendars
    // setSelectedDate(dateString);
    // fetchTimeSlotsForDate(dateString);

    // Placeholder para quando não tiver o componente Calendar
    // Simular a seleção de uma data específica (ex: hoje + 3 dias)
     const today = new Date();
     const mockDate = new Date(today.setDate(today.getDate() + 3)); // Simula data futura
     const mockDateString = mockDate.toISOString().split('T')[0]; // Formato 'YYYY-MM-DD'

    setSelectedDate(mockDateString); // Define a data simulada
    fetchTimeSlotsForDate(mockDateString); // Busca horários para a data simulada
     Alert.alert("Seleção de Data (Simulado)", `Você selecionaria ${mockDateString}. (Calendário a ser implementado)`);
  }, [fetchTimeSlotsForDate]); // Depende de fetchTimeSlotsForDate

  const handleTimeSlotSelect = useCallback((slot) => {
    setSelectedTimeSlot(slot);
  }, []);

  const handleConfirmAndPay = async () => {
    if (!selectedDate || !selectedTimeSlot || !selectedCommunicationMethod || !currentUser?.cpf) {
      Alert.alert("Atenção", "Por favor, complete todos os campos necessários (usuário, data, horário, método).");
      console.warn("[CONSULTA] Falha na validação para pagamento/confirmação:", { selectedDate, selectedTimeSlot, selectedCommunicationMethod, currentUser });
      return;
    }
    console.log(`[CONSULTA] Iniciando processo de agendamento/pagamento para consulta em ${selectedDate} às ${selectedTimeSlot}`);

    setIsLoading(true); // Ativa loading para pagamento/solicitação

    // --- LÓGICA DE PAGAMENTO E ENVIO AO BACKEND ---
    // TODO: Implementar fluxo de pagamento real (gateway, etc.)
    // Após pagamento, enviar solicitação de agendamento para o backend.

     // Simulação de pagamento bem-sucedido e envio ao backend
     await new Promise(resolve => setTimeout(resolve, 2000)); // Simula delay de pagamento

     try {
          // TODO: Substituir por chamada real à API para agendar consulta
          console.log("[CONSULTA] Simulando envio de agendamento para o backend...");
          // const response = await fetch(apiConfig.getFullApiUrl(apiConfig.API_ENDPOINTS.BOOK_LAWYER_CONSULTATION), {
          //      method: 'POST',
          //      headers: { 'Content-Type': 'application/json' },
          //      body: JSON.stringify({
          //          cpf_passageiro: currentUser.cpf,
          //          data: selectedDate,
          //          hora: selectedTimeSlot,
          //          metodo: selectedCommunicationMethod,
          //          descricao_caso: caseDescription, // Envia descrição opcional
          //          // Adicionar ID da transação de pagamento se aplicável
          //      }),
          //  });
          // if (!response.ok) throw new Error('Erro ao agendar consulta');
          // const bookingResult = await response.json();

           // Simulação de sucesso no agendamento
          const bookingResult = {
              success: true,
              consulta_id: 'CONSULTA-12345',
              status: 'Aguardando Confirmação do Advogado',
              valor_final: 'R$ 70,00', // Valor final confirmado
              advogado_nome: 'Dr. Fulano de Tal', // Se backend retornar info do advogado
          };
           console.log("[CONSULTA] Resposta simulada do backend:", bookingResult);


         if (bookingResult.success) {
             const bookingData = {
               id: bookingResult.consulta_id,
               date: selectedDate,
               time: selectedTimeSlot,
               method: selectedCommunicationMethod,
               description: caseDescription,
               cost: bookingResult.valor_final || "R$ 70,00",
               status: bookingResult.status || "Agendado",
               advogado: bookingResult.advogado_nome,
             };
             setBookingDetails(bookingData);
             setShowSchedulingModal(false); // Fecha modal de agendamento
             setShowConfirmationModal(true); // Exibe modal de confirmação
             console.log("[CONSULTA] Agendamento solicitado com sucesso:", bookingData);
         } else {
            // Tratar falha no agendamento APÓS pagamento (ex: horário ficou indisponível)
             // Isso exigiria um reembolso ou reagendamento.
            const errorMessage = bookingResult.message || bookingResult.error || "Não foi possível confirmar seu agendamento. O valor pode ser reembolsado. Tente novamente.";
            Alert.alert("Erro no Agendamento", errorMessage);
            // Talvez não resetar tudo, apenas o fluxo de agendamento
            resetAllModalsAndState(); // Ou um reset mais granular
            setShowChoiceModal(true); // Volta para a escolha inicial
             console.error("[CONSULTA] Falha no agendamento após simular pagamento.", bookingResult);
         }
     } catch (error) {
         console.error("[CONSULTA] Erro no processo de pagamento/agendamento:", error);
         Alert.alert("Erro", error.message || "Ocorreu um erro ao finalizar o agendamento.");
         // Em caso de erro de rede APÓS o pagamento (simulado), o estado é incerto.
         // O ideal é ter um processo robusto de retentativa ou verificação no backend.
         // Por ora, resetamos o fluxo.
         resetAllModalsAndState();
         setShowChoiceModal(true);
     } finally {
         setIsLoading(false); // Para o loading
     }
  };

   // Handler para fechar o modal de agendamento e voltar para o setup do advogado
   const handleCloseSchedulingModal = useCallback(() => {
       setShowSchedulingModal(false);
        // Limpar estados de agendamento ao fechar
       setSelectedDate(null);
       setSelectedTimeSlot(null);
       setAvailableTimeSlots([]);
       setIsLoadingSlots(false);
       setShowLawyerSetupModal(true); // Volta para o setup
       console.log('[Consulta] Fechando Agendamento, voltando para Setup.');
   }, []);


  const handleCloseConfirmation = useCallback(() => {
    setShowConfirmationModal(false);
    setBookingDetails(null); // Limpa detalhes da reserva
    resetAllModalsAndState(); // Reseta todos os outros estados
    // navigation.goBack(); // Pode voltar para SelecaoModalidadeScreen ou...
    // ...navegar para uma tela de "Meus Agendamentos" se existir
    navigation.navigate('SelecaoModalidade', { initialUserData: currentUser }); // Exemplo: volta para seleção
    console.log('[Consulta] Fechando Confirmação, voltando para seleção de modalidade.');
  }, [navigation, resetAllModalsAndState, currentUser]);


  // --- Renderização ---

  // Renderiza um loading inicial se o currentUser não estiver carregado
  if (!currentUser) {
      return (
           <SafeAreaView style={styles.loadingContainer}>
               <StatusBar barStyle="light-content" backgroundColor={COLORS.background}/>
               <ActivityIndicator size="large" color={COLORS.primary} />
               <Text style={styles.loadingText}>Carregando dados do usuário...</Text>
           </SafeAreaView>
      );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

       {/* A barra de cabeçalho só é mostrada quando *nenhum* modal fullscreen está aberto */}
      {!showAIChatModal && !showSchedulingModal && (
           <View style={styles.headerBar}>
             <TouchableOpacity onPress={handleCloseChoiceModalAndGoBack} style={styles.backButton}>
                 <Ionicons name="arrow-back" size={28} color={COLORS.textPrimary} />
             </TouchableOpacity>
             <Text style={styles.headerTitle}>Consultoria Jurídica</Text>
             {/* Espaço para centralizar o título, se necessário */}
             <View style={{width: 40}} />
           </View>
      )}


      {/* --- Modal de Escolha Inicial --- */}
      {/* Este modal cobre a tela e é o ponto de entrada */}
      <Modal
        transparent={true}
        visible={showChoiceModal}
        animationType="fade"
        onRequestClose={handleCloseChoiceModalAndGoBack} // Ao fechar pelo hardware back button
      >
        <View style={styles.modalBackground}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView}>
                 <View style={styles.modalContainer}>
                   <Text style={styles.modalTitle}>Como podemos te ajudar?</Text>
                   <Text style={styles.modalSubtext}>Escolha uma opção de consultoria:</Text>

                   {/* Botão IA */}
                   <TouchableOpacity style={styles.choiceButton} onPress={handleSelectAIChat}>
                     <MaterialCommunityIcons name="robot-happy-outline" size={30} color={COLORS.primary} />
                     <View style={styles.choiceTextContainer}>
                       <Text style={styles.choiceButtonTitle}>Informações com IA</Text>
                       <Text style={styles.choiceButtonSubtitle}>Gratuito - Tire dúvidas rápidas sobre temas jurídicos</Text>
                     </View>
                     <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
                   </TouchableOpacity>

                    {/* Botão Advogado */}
                   <TouchableOpacity style={styles.choiceButton} onPress={handleSelectLawyerConsult}>
                     <MaterialIcons name="gavel" size={30} color={COLORS.secondary} />
                     <View style={styles.choiceTextContainer}>
                       <Text style={styles.choiceButtonTitle}>Consulta com Advogado</Text>
                       <Text style={styles.choiceButtonSubtitle}>R$ 70,00 - Agende uma conversa particular</Text>
                     </View>
                     <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
                   </TouchableOpacity>

                    {/* Botão Voltar/Cancelar */}
                   <TouchableOpacity style={[styles.actionButtonBase, styles.closeModalButton, {marginTop: 20}]} onPress={handleCloseChoiceModalAndGoBack}>
                       <Text style={styles.actionButtonText}>Voltar para Serviços</Text>
                   </TouchableOpacity>
                 </View>
             </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* --- Modal de Chat com IA --- */}
      <Modal
        transparent={true}
        visible={showAIChatModal}
        animationType="slide" // Usa slide para dar sensação de tela cheia
        onRequestClose={handleCloseAIChatModal} // Ao fechar pelo hardware back button
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackgroundFull} // Estilo para tela cheia
        >
           <View style={styles.chatHeader}>
             <TouchableOpacity onPress={handleCloseAIChatModal}>
               <Ionicons name="arrow-back" size={28} color={COLORS.textPrimary} />
             </TouchableOpacity>
             <Text style={styles.chatHeaderTitle}>Assistente Jurídico IA</Text>
             <View style={{width: 28}} />{/* Placeholder */}
           </View>
           {isLoading && aiMessages.length <= 1 ? ( // Mostra loading se estiver buscando primeira resposta
               <View style={styles.loadingContainerChat}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                   <Text style={styles.loadingTextChat}>Aguardando resposta da IA...</Text>
               </View>
           ) : (
                <ScrollView
                  style={styles.chatMessagesContainer}
                  contentContainerStyle={{ paddingVertical: 10 }}
                  ref={ref => this.scrollView = ref}
                  onContentSizeChange={() => this.scrollView?.scrollToEnd({animated: true})} // Rola pro final automaticamente
                >
                  {aiMessages.map(msg => (
                    <View
                      key={msg.id}
                      style={[
                        styles.chatBubble,
                        msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                      ]}
                    >
                      <Text style={styles.chatText}>{msg.text}</Text>
                       <Text style={styles.chatTime}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                    </View>
                  ))}
                  {isAISending && <ActivityIndicator size="small" color={COLORS.primary} style={{alignSelf: 'flex-start', marginLeft: 10, marginTop: 5}}/>}
                </ScrollView>
            )}
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Digite sua dúvida..."
                placeholderTextColor={COLORS.textHint}
                value={aiInputText}
                onChangeText={setAiInputText}
                multiline
                editable={!isAISending} // Desabilita input enquanto IA responde
              />
              <TouchableOpacity onPress={handleSendUserMessageToAI} style={styles.sendButton} disabled={isAISending || !aiInputText.trim()}>
                <Ionicons name="send" size={24} color={(isAISending || !aiInputText.trim()) ? COLORS.textHint : COLORS.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.disclaimerText}>
                Esta é uma IA para informações gerais e não substitui aconselhamento profissional.
            </Text>
             {/* Adiciona padding inferior para teclados iOS */}
             {Platform.OS === 'ios' && <View style={{ height: 20 }} />}

        </KeyboardAvoidingView>
      </Modal>

      {/* --- Modal de Setup da Consulta com Advogado --- */}
      <Modal
        transparent={true}
        visible={showLawyerSetupModal}
        animationType="fade"
        onRequestClose={handleCloseLawyerSetupModal}
      >
        <View style={styles.modalBackground}>
             <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView}>
                 <View style={styles.modalContainer}>
                   <Text style={styles.modalTitle}>Consulta com Advogado</Text>
                   <Text style={styles.modalSubtext}>Valor: R$ 70,00 | Duração aprox.: 30 minutos</Text>
                   <Text style={[styles.modalSectionTitle, {marginTop: 10}]}>Escolha o formato:</Text>
                   {['video', 'voice', 'text'].map(method => {
                     const icons = { video: "videocam-outline", voice: "call-outline", text: "chatbox-ellipses-outline" };
                     const labels = { video: "Vídeo Chamada", voice: "Chamada de Voz", text: "Chat por Texto" };
                     return (
                       <TouchableOpacity
                         key={method}
                         style={[
                           styles.methodOptionButton,
                           selectedCommunicationMethod === method && styles.methodOptionSelected
                         ]}
                         onPress={() => setSelectedCommunicationMethod(method)}
                       >
                         <Ionicons name={icons[method]} size={24} color={selectedCommunicationMethod === method ? COLORS.primary : COLORS.textSecondary} />
                         <Text style={[styles.methodOptionText, selectedCommunicationMethod === method && {color: COLORS.primary}]}>{labels[method]}</Text>
                       </TouchableOpacity>
                     );
                   })}
                   <TouchableOpacity
                     style={[styles.actionButtonBase, styles.confirmModalButton, { marginTop: 20 }, !selectedCommunicationMethod && styles.actionButtonDisabled]}
                     onPress={handleProceedToScheduling}
                     disabled={!selectedCommunicationMethod || isLoading} // Desabilita se estiver carregando (embora isLoading seja para a solicitação final, mantido por segurança)
                   >
                     {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionButtonText}>Prosseguir para Agendamento</Text>}
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.actionButtonBase, styles.closeModalButton]} onPress={handleCloseLawyerSetupModal} disabled={isLoading}>
                       <Text style={styles.actionButtonText}>Cancelar</Text>
                   </TouchableOpacity>
                 </View>
             </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* --- Modal de Agendamento --- */}
      <Modal
        transparent={true}
        visible={showSchedulingModal}
        animationType="slide" // Usa slide para dar sensação de tela cheia
        onRequestClose={handleCloseSchedulingModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackgroundFull}
        >
           <View style={styles.chatHeader}>
               <TouchableOpacity onPress={handleCloseSchedulingModal}>
                   <Ionicons name="arrow-back" size={28} color={COLORS.textPrimary} />
               </TouchableOpacity>
               <Text style={styles.chatHeaderTitle}>Agendar Consulta</Text>
               <View style={{width: 28}}/>{/* Placeholder */}
           </View>
           <ScrollView style={{flex: 1, width: '100%', paddingHorizontal: 15}}>
               <Text style={styles.modalSectionTitle}>1. Selecione a Data</Text>
               {/* Placeholder para o Calendário */}
               {/* TODO: Substituir pelo componente de calendário real */}
               <View style={styles.calendarPlaceholder}>
                   <Text style={styles.placeholderText}>Componente de Calendário Aqui</Text>
                   <Text style={styles.placeholderTextSm}>(react-native-calendars ou similar)</Text>
                   <TouchableOpacity onPress={handleDateSelect} style={styles.mockCalendarButton} disabled={isLoadingSlots || isLoading}>
                       {isLoadingSlots ? (
                           <ActivityIndicator color={COLORS.white} />
                       ) : (
                           <Text style={styles.actionButtonText}>Simular Seleção de Data (Ex: +3 dias)</Text>
                       )}
                   </TouchableOpacity>
               </View>

               {selectedDate && (
                   <>
                       <Text style={styles.modalSectionTitle}>2. Horários para {selectedDate}:</Text>
                       {isLoadingSlots && <ActivityIndicator color={COLORS.primary} style={{marginVertical: 20}}/>}
                       {!isLoadingSlots && availableTimeSlots.length === 0 && (
                           <Text style={styles.infoText}>Nenhum horário disponível para esta data.</Text>
                       )}
                       {!isLoadingSlots && availableTimeSlots.length > 0 && (
                           <View style={styles.timeSlotsContainer}>
                               {availableTimeSlots.map(slot => (
                                   <TouchableOpacity
                                       key={slot}
                                       style={[
                                           styles.timeSlotButton,
                                           selectedTimeSlot === slot && styles.timeSlotSelected
                                       ]}
                                       onPress={() => handleTimeSlotSelect(slot)}
                                       disabled={isLoading} // Desabilita seleção de horário enquanto carrega (agendamento final)
                                   >
                                       <Text style={[styles.timeSlotText, selectedTimeSlot === slot && {color: COLORS.white}]}>{slot}</Text>
                                   </TouchableOpacity>
                               ))}
                           </View>
                       )}
                   </>
               )}
               {/* Campo para descrição do caso */}
               <Text style={styles.modalSectionTitle}>3. Descreva seu caso (opcional):</Text>
               <TextInput
                   style={styles.caseDescriptionInput}
                   placeholder="Resuma o motivo da consulta em poucas frases..."
                   placeholderTextColor={COLORS.textHint}
                   value={caseDescription}
                   onChangeText={setCaseDescription}
                   multiline
                   numberOfLines={3}
                   editable={!isLoading} // Desabilita input enquanto carrega (agendamento final)
               />
           </ScrollView>
           {/* Footer Fixo para o Botão de Confirmar */}
           <View style={styles.stickyFooter}>
               <TouchableOpacity
                   style={[styles.actionButtonBase, styles.confirmScheduleButton, (!selectedDate || !selectedTimeSlot || isLoading) && styles.actionButtonDisabled]}
                   onPress={handleConfirmAndPay}
                   disabled={!selectedDate || !selectedTimeSlot || isLoading}
               >
                   {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionButtonText}>Confirmar e Pagar R$ 70,00</Text>}
               </TouchableOpacity>
           </View>
            {/* Adiciona padding inferior para teclados iOS */}
            {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
         </KeyboardAvoidingView>
      </Modal>

      {/* --- Modal de Confirmação do Agendamento --- */}
      <Modal
        transparent={true}
        visible={showConfirmationModal}
        animationType="fade"
        onRequestClose={handleCloseConfirmation}
      >
        <View style={styles.modalBackground}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardAvoidingView}>
                 <View style={styles.modalContainerSimple}>
                   <Ionicons name="checkmark-circle-outline" size={60} color={COLORS.success} style={{alignSelf: 'center', marginBottom: 15}}/>
                   <Text style={styles.modalTitle}>Solicitação Enviada!</Text>
                   {bookingDetails ? (
                       <>
                           <Text style={styles.modalSubtext}>
                               Sua solicitação de consulta por {bookingDetails.method} para <Text style={{fontWeight: 'bold'}}>{bookingDetails.date}</Text> às <Text style={{fontWeight: 'bold'}}>{bookingDetails.time}</Text> foi registrada.
                           </Text>
                            {bookingDetails.advogado && (
                                <Text style={styles.infoTextSmall}>Advogado: {bookingDetails.advogado}</Text>
                            )}
                           <Text style={styles.infoTextSmall}>
                               Status: {bookingDetails.status}. Você será notificado(a) sobre a confirmação ou detalhes adicionais.
                           </Text>
                           {bookingDetails.cost && (
                                <Text style={styles.infoTextSmall}>Valor: {bookingDetails.cost}</Text>
                           )}
                       </>
                   ) : (
                       <Text style={styles.modalSubtext}>Sua solicitação de agendamento foi enviada com sucesso.</Text>
                   )}
                   <TouchableOpacity style={[styles.actionButtonBase, styles.confirmModalButton, {marginTop: 25, backgroundColor: COLORS.primary}]} onPress={handleCloseConfirmation}>
                       <Text style={styles.actionButtonText}>OK</Text>
                   </TouchableOpacity>
                 </View>
             </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
   loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: 10,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
     loadingContainerChat: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
     },
     loadingTextChat: {
         marginTop: 10,
         color: COLORS.textSecondary,
         fontSize: 15,
     },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    backgroundColor: COLORS.background, // Para não ficar transparente se o modal de escolha não cobrir tudo
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)', // Escurece mais o fundo
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalKeyboardAvoidingView: { // Para modais menores (escolha, setup, confirmação, rating, cancel)
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackgroundFull: { // Para modais que se tornam telas cheias (chat, agendamento)
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContainer: { // Para modais menores e centralizados
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 15,
    padding: 25,
    alignItems: 'stretch', // Para botões ocuparem a largura
    elevation: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
   modalContainerSimple: { // Para modais mais simples como o de Chegada (usado aqui para confirmação)
     width: SCREEN_WIDTH * 0.85,
     maxWidth: 400,
     padding: 30,
     borderRadius: 20,
     alignItems: 'center', // Centraliza conteúdo simples
     elevation: 10,
     shadowColor: COLORS.black,
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 6,
     backgroundColor: COLORS.surfaceHighlight, // Fallback se gradiente não funcionar
   },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtext: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 15,
    marginBottom: 10,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  choiceTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  choiceButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  choiceButtonSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionButtonBase: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%', // Garante que ocupe a largura total do container
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmModalButton: {
      backgroundColor: COLORS.primary,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.textHint,
    opacity: 0.6,
  },
  // Chat IA Styles
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, // Ajuste para status bar
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    backgroundColor: COLORS.surfaceHighlight,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  chatMessagesContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  chatBubble: {
    maxWidth: '85%', // Aumenta um pouco a largura máxima
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
    flexDirection: 'column', // Para permitir hora abaixo do texto
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5, // Cantinho reto
    paddingRight: 12, // Espaço extra para hora
  },
  aiBubble: {
    backgroundColor: COLORS.surfaceHighlight,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5, // Cantinho reto
     paddingLeft: 12, // Espaço extra para hora
  },
  chatText: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },
    chatTime: {
        fontSize: 10,
        color: COLORS.textHint,
        alignSelf: 'flex-end', // Hora no final da bolha
        marginTop: 3,
    },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    backgroundColor: COLORS.surfaceHighlight,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginRight: 10,
    textAlignVertical: 'top', // Android
  },
  sendButton: {
    padding: 10,
  },
  disclaimerText: {
    fontSize: 10,
    color: COLORS.textHint,
    textAlign: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
    paddingTop: 5,
    backgroundColor: COLORS.surfaceHighlight,
  },
  // Lawyer Setup Styles
  methodOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  methodOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
  },
  methodOptionText: {
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  // Scheduling Styles
  calendarPlaceholder: {
    height: 200, // Altura simulada
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 5,
  },
  placeholderTextSm: {
    color: COLORS.textHint,
    fontSize: 12,
    marginBottom: 10,
  },
  mockCalendarButton: {
      backgroundColor: COLORS.primaryVariant,
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 20,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginVertical: 10,
  },
  timeSlotButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeSlotSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeSlotText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  caseDescriptionInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderRadius: 10,
    padding: 15,
    textAlignVertical: 'top',
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    marginBottom: 20, // Espaço antes do footer
  },
  stickyFooter: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    backgroundColor: COLORS.background,
  },
  confirmScheduleButton: {
    backgroundColor: COLORS.success,
  },
  infoText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 15,
  },
  infoTextSmall: {
    color: COLORS.textHint,
    textAlign: 'center',
    marginVertical: 5,
    fontSize: 13,
  }
});

export default ConsultaScreen;
