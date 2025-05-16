
// src/screens/RegisterScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ScrollView, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, // Add ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerPassenger } from '../services/authService'; // Importa a função do serviço
import { useNavigation } from '@react-navigation/native'; // Hook para navegação

const RegisterScreen = () => {
  const navigation = useNavigation();

  // Estados para cada campo do formulário
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Adicionado para confirmação
  const [dataNascimento, setDataNascimento] = useState(null); // Inicializa como null
  const [endereco, setEndereco] = useState(''); // Campo opcional de endereço

  // Estados de controle da UI
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Para feedback durante o registro

  /**
   * Valida os campos do formulário antes de enviar.
   * Retorna true se válido, senão exibe alerta e retorna false.
   */
  const validateForm = () => {
    if (!cpf.trim() || !nome.trim() || !sobrenome.trim() || !email.trim() || !telefone.trim() || !password || !confirmPassword || !dataNascimento) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha todos os campos marcados com *');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Senhas Diferentes', 'As senhas digitadas não coincidem.');
      return false;
    }
    // Adicionar validações mais robustas (formato de email, CPF, força da senha) se necessário
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        Alert.alert('Email Inválido', 'Por favor, insira um endereço de email válido.');
        return false;
    }
    // Exemplo validação simples de telefone (apenas números, tamanho mínimo)
    if (!/^\d{10,11}$/.test(telefone.replace(/\D/g, ''))) { // Remove não-dígitos e verifica tamanho
        Alert.alert('Telefone Inválido', 'Insira um telefone válido com DDD (10 ou 11 dígitos).');
        return false;
    }
     // Exemplo validação simples de CPF (apenas números, 11 dígitos)
     if (!/^\d{11}$/.test(cpf.replace(/\D/g, ''))) {
        Alert.alert('CPF Inválido', 'Insira um CPF válido (11 dígitos, apenas números).');
        return false;
    }
    // Validação de senha (exemplo: mínimo 6 caracteres)
     if (password.length < 6) {
         Alert.alert('Senha Fraca', 'A senha deve ter pelo menos 6 caracteres.');
         return false;
     }

    return true;
  };

  /**
   * Manipula o envio do formulário de registro.
   */
  const handleRegister = async () => {
    if (!validateForm()) {
      return; // Interrompe se a validação falhar
    }

    setIsLoading(true); // Ativa o loading

    const registrationData = {
      cpf: cpf.trim(),
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      email: email.trim().toLowerCase(), // Normaliza email para minúsculas
      telefone: telefone.trim(),
      password: password, // Senha já validada
      dataNascimento: dataNascimento, // Passa o objeto Date
      endereco: endereco.trim(), // Passa o endereço opcional
    };

    try {
      // Chama a função de registro do serviço
      const result = await registerPassenger(registrationData);
      console.log('[RegisterScreen] Registro bem-sucedido:', result);
      Alert.alert(
        'Cadastro Realizado!',
        'Sua conta foi criada com sucesso. Faça o login para continuar.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }] // Leva para Login após sucesso
      );
    } catch (error) {
      console.error('[RegisterScreen] Falha no registro:', error);
      // Exibe a mensagem de erro retornada pelo authService ou uma genérica
      Alert.alert('Erro no Cadastro', error.message || 'Não foi possível realizar o cadastro. Tente novamente.');
    } finally {
      setIsLoading(false); // Desativa o loading
    }
  };

  /**
   * Manipula a mudança de data no DateTimePicker.
   */
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false); // Fecha o picker em qualquer evento
    if (event.type === 'set' && selectedDate) {
      // 'set' indica que o usuário confirmou a data
      setDataNascimento(selectedDate);
    } else {
      // 'dismissed' ou data não selecionada (Android pode retornar undefined)
      // Não altera a data existente se o usuário cancelar
    }
  };

  return (
    // SafeAreaView para evitar sobreposição com notch/barra de status
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={{ flex: 1 }} // O KAV deve ocupar todo o espaço disponível
        behavior={Platform.OS === "ios" ? "padding" : undefined} // 'height' pode causar problemas com ScrollView
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <LinearGradient colors={['#121212', '#1E1E1E']} style={styles.gradientContainer}>
          {/* ScrollView é essencial para formulários longos */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled" // Ajuda a fechar teclado
          >
            <View style={styles.header}>
              <Text style={styles.title}>Criar Conta de Passageiro</Text>
              <Text style={styles.subtitle}>Preencha seus dados para começar</Text>
            </View>

            <View style={styles.formContainer}>
              {/* Usar um componente InputField customizado seria ideal aqui */}
              <View style={styles.inputGroup}>
                <Ionicons name="card-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="CPF (somente números)*"
                  placeholderTextColor="#888"
                  value={cpf}
                  onChangeText={setCpf}
                  keyboardType="numeric"
                  maxLength={11}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome*"
                  placeholderTextColor="#888"
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="people-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Sobrenome*"
                  placeholderTextColor="#888"
                  value={sobrenome}
                  onChangeText={setSobrenome}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="mail-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email*"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="call-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Telefone (com DDD)*"
                  placeholderTextColor="#888"
                  value={telefone}
                  onChangeText={setTelefone}
                  keyboardType="phone-pad"
                   maxLength={11} // Para (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity style={styles.datePickerButton} onPress={() => !isLoading && setShowDatePicker(true)} disabled={isLoading}>
                <Ionicons name="calendar-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <Text style={[styles.datePickerText, !dataNascimento && styles.placeholderText]}>
                  {dataNascimento
                    ? `Nascimento: ${dataNascimento.toLocaleDateString('pt-BR')}` // Formato BR
                    : 'Data de Nascimento*'}
                </Text>
              </TouchableOpacity>

              {/* O DateTimePicker é renderizado condicionalmente */}
              {showDatePicker && (
                <DateTimePicker
                  value={dataNascimento || new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000)} // Começa 18 anos atrás
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'} // 'spinner' ou 'calendar' no Android
                  onChange={onDateChange}
                   maximumDate={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000)} // Idade mínima de 18 anos
                  // minimumDate={new Date(1900, 0, 1)} // Data mínima opcional
                />
              )}

               {/* Endereço (Opcional) */}
               <View style={styles.inputGroup}>
                   <Ionicons name="home-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                   <TextInput
                      style={styles.input}
                      placeholder="Endereço (opcional)"
                      placeholderTextColor="#888"
                      value={endereco}
                      onChangeText={setEndereco}
                      autoCapitalize="words"
                      editable={!isLoading}
                   />
               </View>

              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Senha*"
                  placeholderTextColor="#888"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" size={22} color="#FF6B00" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar Senha*"
                  placeholderTextColor="#888"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>


              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                   <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                   <Text style={styles.registerButtonText}>CADASTRAR</Text>
                 )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginLink} onPress={() => !isLoading && navigation.goBack()} disabled={isLoading}>
                <Text style={styles.loginLinkText}>Já possui conta? <Text style={styles.loginLinkHighlight}>Faça login</Text></Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Estilos ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212', // Cor de fundo da safe area
  },
  gradientContainer: {
    flex: 1, // Garante que o gradiente preencha o KAV
  },
  scrollContainer: {
    flexGrow: 1, // Permite que o conteúdo interno cresça
    paddingHorizontal: 20,
    paddingVertical: 30, // Espaçamento vertical
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 26, // Um pouco menor que login
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#BBB',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
     backgroundColor: 'rgba(30, 30, 30, 0.6)', // Fundo levemente transparente
     padding: 20,
     borderRadius: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 50, 50, 0.9)', // Fundo do input
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.3)', // Borda laranja sutil
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 12, // Altura do input
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderRadius: 8,
    marginBottom: 15, // Consistente com inputs
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.3)',
    paddingHorizontal: 12,
     height: 50, // Mesma altura visual dos inputs
  },
  datePickerText: {
    fontSize: 16,
    color: '#FFF',
     marginLeft: 10, // Espaçamento do ícone
  },
   placeholderText: {
     color: '#888', // Cor igual ao placeholder dos TextInput
   },
  registerButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20, // Espaço acima do botão principal
    minHeight: 50,
     justifyContent: 'center',
    shadowColor: '#FF6B00',
     shadowOffset: { width: 0, height: 3 },
     shadowOpacity: 0.4,
     shadowRadius: 4,
     elevation: 6,
  },
  buttonDisabled: {
     backgroundColor: '#A0A0A0', // Cor para botão desabilitado
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  loginLink: {
    marginTop: 30, // Mais espaço antes do link de voltar
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#BBB',
    fontSize: 15,
  },
  loginLinkHighlight: {
    color: '#FF8C00', // Destaque laranja/amarelo
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;
