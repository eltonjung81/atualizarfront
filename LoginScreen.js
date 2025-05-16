// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Alert, StyleSheet, Text,
  ImageBackground, ActivityIndicator, KeyboardAvoidingView, Platform,
  StatusBar, Image, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';

// authService.loginPassenger JÁ SALVA os dados localmente e retorna { userData, token }
import { loginPassenger } from '../services/authService';

const LoginScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const setAsAuthenticated = route.params?.setAsAuthenticated;

  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!cpf.trim() || !password.trim()) {
      Alert.alert('Campos Incompletos', 'Por favor, preencha seu CPF e senha.');
      return;
    }
    setIsLoading(true);
    try {
      // loginPassenger faz a chamada API, salva token/userData localmente, e retorna { userData, token }
      const loginResponse = await loginPassenger(cpf.trim(), password);

      console.log('[LoginScreen] Login via authService bem-sucedido. Token:', loginResponse.token ? 'Sim' : 'Não');

      if (loginResponse.userData && loginResponse.userData.cpf) { // Validação extra
        if (typeof setAsAuthenticated === 'function') {
          console.log('[LoginScreen] Chamando setAsAuthenticated do App.js com userData:', loginResponse.userData);
          setAsAuthenticated(loginResponse.userData); // Passa os dados do usuário para o App.js
                                                     // O App.js cuidará de mudar o authStatus e conectar o WebSocket.
        } else {
          console.error('[LoginScreen] ERRO: setAsAuthenticated não é uma função. A navegação automática não ocorrerá.');
          Alert.alert('Erro de Configuração', 'Não foi possível completar o login devido a um erro interno de configuração do app.');
        }
      } else {
        // Se loginPassenger não retornar userData válidos, mesmo que não lance erro explicitamente
        // (o que não deveria acontecer se a validação dentro de loginPassenger estiver correta)
        console.error('[LoginScreen] Resposta de login do authService inválida ou userData ausente:', loginResponse);
        throw new Error("Resposta de login inválida.");
      }

    } catch (error) {
      console.error('[LoginScreen] Falha no processo de login:', error);
      Alert.alert('Erro de Login', error.message || 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/fundo.png')} // Certifique-se que o caminho está correto
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(18,18,18,0.9)']}
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kavContainer}
        >
          <ScrollView
             contentContainerStyle={styles.scrollContentContainer}
             keyboardShouldPersistTaps="handled"
             showsVerticalScrollIndicator={false}
           >
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo.png')} // Certifique-se que o caminho está correto
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.slogan}>Sua mobilidade, nossa prioridade</Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Acesse sua conta</Text>
              <TextInput
                style={[styles.input, isLoading && styles.inputDisabled]}
                placeholder="CPF (somente números)"
                placeholderTextColor="#999"
                value={cpf}
                onChangeText={setCpf}
                keyboardType="numeric"
                maxLength={11}
                editable={!isLoading}
              />
              <TextInput
                style={[styles.input, isLoading && styles.inputDisabled]}
                placeholder="Senha"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>ENTRAR</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                 style={styles.registerLink}
                 onPress={() => !isLoading && navigation.navigate('Register')}
                 disabled={isLoading}
              >
                <Text style={styles.registerText}>
                  Não tem conta? <Text style={styles.registerLinkHighlight}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
};

// Estilos (reutilizados da sua versão anterior)
const styles = StyleSheet.create({
  container: { flex: 1, },
  overlay: { flex: 1, },
  kavContainer: { flex: 1, },
  scrollContentContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40, },
  logoContainer: { alignItems: 'center', marginBottom: 40, },
  logo: { width: 140, height: 140, marginBottom: 10, },
  slogan: { color: '#E0E0E0', fontSize: 16, fontStyle: 'italic', textAlign: 'center', },
  formContainer: { backgroundColor: 'rgba(30, 30, 30, 0.7)', padding: 25, borderRadius: 15, width: '100%', },
  formTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 25, textAlign: 'center', },
  input: { backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#1A1A1A', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255, 107, 0, 0.5)', },
  inputDisabled: { backgroundColor: 'rgba(200, 200, 200, 0.7)', },
  loginButton: { backgroundColor: '#FF6B00', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 15, minHeight: 50, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5, },
  loginButtonDisabled: { backgroundColor: '#A0A0A0', },
  loginButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', textTransform: 'uppercase', },
  registerLink: { marginTop: 25, alignItems: 'center', },
  registerText: { color: '#CCCCCC', fontSize: 15, },
  registerLinkHighlight: { color: '#FF8C00', fontWeight: 'bold', },
});

export default LoginScreen;
