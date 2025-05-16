
// src/screens/LoadingScreen.js
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, StatusBar } from 'react-native';

/**
 * Tela de Loading genérica exibida durante operações assíncronas iniciais
 * ou transições de estado de autenticação.
 */
const LoadingScreen = ({ message = "Carregando..." }) => { // Permite mensagem customizada
  return (
    <View style={styles.container}>
       {/* StatusBar aqui garante a cor correta enquanto esta tela é visível */}
       <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <ActivityIndicator size="large" color="#FF6B00" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212', // Cor de fundo consistente
  },
  text: {
    marginTop: 20, // Um pouco mais de espaço
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500', // Um pouco mais de destaque
  },
});

export default LoadingScreen;
