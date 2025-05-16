import { Platform } from 'react-native';
import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, StatusBar,
  ActivityIndicator, Alert
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants/theme';
import { TRANSPORT_MODALITIES } from '../constants/modalityConfig';

const SelecaoModalidadeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentUser = route.params?.initialUserData;

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTempModality, setSelectedTempModality] = useState(null);

  const renderModalityIcon = useCallback((modality) => {
    const IconComponent = { Ionicons, MaterialIcons, FontAwesome }[modality.iconType] || FontAwesome;
    return (
      <IconComponent
        name={modality.iconName}
        size={28}
        color="#FF6B00"
      />
    );
  }, []);

  const handleSelectModality = useCallback(async (modalityKey) => {
    setIsLoading(true);
    setSelectedTempModality(modalityKey);
    try {
      await AsyncStorage.setItem('lastSelectedTransport', modalityKey);
    } catch (e) {
      console.error("Erro ao salvar lastSelectedTransport:", e);
    }

    if (!currentUser) {
      Alert.alert("Erro", "Dados do usuário não carregados.");
      setIsLoading(false);
      return;
    }

    switch (modalityKey) {
      case 'assessoria_adv':
        navigation.navigate('Consulta', { currentUser });
        break;
      case 'frete_caminhonete':
        navigation.navigate('Freight', { currentUser });
        break;
      default:
        navigation.navigate('Corrida', { currentUser, selectedModality: modalityKey });
        break;
    }
  }, [navigation, currentUser]);

  useFocusEffect(useCallback(() => {
    setIsLoading(false);
    setSelectedTempModality(null);
  }, []));

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Carregando dados do usuário...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <LinearGradient colors={['#121212', '#FF6B00']} style={styles.header}>
        <Text style={styles.headerTitle}>Olá, {currentUser.nome.split(" ")[0]}!</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Selecione o Tipo de Serviço:</Text>
        {TRANSPORT_MODALITIES.map((modality) => {
          const isSelected = selectedTempModality === modality.key;
          const showLoader = isLoading && isSelected;
          return (
            <TouchableOpacity
              key={modality.key}
              style={[
                styles.modalityOption,
                isSelected && { borderColor: '#FF6B00', backgroundColor: '#1C1C1C' }
              ]}
              onPress={() => handleSelectModality(modality.key)}
              disabled={isLoading}
            >
              {showLoader ? (
                <ActivityIndicator size="small" color="#FF6B00" />
              ) : (
                renderModalityIcon(modality)
              )}
              <Text style={[
                styles.modalityText,
                isSelected && { color: '#FF6B00', fontWeight: 'bold' }
              ]}>
                {modality.label}
              </Text>
              {!showLoader && (
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={isSelected ? '#FF6B00' : '#AAAAAA'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 10,
    color: '#bbb',
    fontSize: 16,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileButton: {
    padding: 5,
    borderRadius: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 14,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  modalityText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
});

export default SelecaoModalidadeScreen;
