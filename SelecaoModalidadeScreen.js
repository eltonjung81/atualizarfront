// Este é um código TEMPORÁRIO apenas para testar o carregamento.
// Substitua TODO o conteúdo original do seu arquivo SelecaoModalidadeScreen.js por este.

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';

// IMPORTANTE: Se o seu sistema de ScreenLoader espera um DEFAULT EXPORT, mantenha esta linha
// Se ele carrega componentes de outra forma, adapte ou me avise.
const SelecaoModalidadeScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <View style={styles.content}>
        <Text style={styles.title}>Tela de Teste Minimalista</Text>
        <Text style={styles.subtitle}>Se você está vendo isso, o arquivo foi carregado!</Text>
         <ActivityIndicator size="small" color="#ffffff" style={{marginTop: 20}}/>
         <Text style={styles.loadingText}>Teste bem-sucedido. Pronto para o próximo passo.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFF00', // Amarelo para destacar que é teste
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 20,
    textAlign: 'center',
  },
   loadingText: {
     marginTop: 10,
     color: '#CCCCCC',
     fontSize: 14,
  },
});

// Garante que o componente seja exportado como padrão, como o original SelecaoModalidadeScreen
export default SelecaoModalidadeScreen;
