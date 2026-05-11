import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, use } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyPokemons, getTodayCompletedCount, hasCompletedPokemon, Pokemon, saveDailyProgress, saveScoreToFirebase } from '../../services/gameService';
import { router } from 'expo-router';
import { auth } from '@/assets/services/firebaseConfig';

export default function GameScreen() {
  const [dailyPokemons, setDailyPokemons] = useState<Pokemon[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameFinished, setGameFinished] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:7070").replace(/\/$/, ""); 
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    loadGame();
  }, []);
  
  const loadGame = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      console.log('🔍 1. userId:', userId); 
      const currentUser = auth.currentUser;
      console.log('Usuário logado UID:', currentUser?.uid);
      console.log('Usuário logado nome:', currentUser?.displayName);
      setUser(currentUser);

      const pokemons = await getDailyPokemons();
      setDailyPokemons(pokemons);
      console.log('🔍 2. Pokémons carregados:', pokemons.length);
      
      if (userId) {
        const completedCount = await getTodayCompletedCount(userId);
        console.log('🔍 3. completedCount:', completedCount)

        if (completedCount >= 3) {
          console.log('🔍 4. Entrou no completedCount >= 3');
          Alert.alert(
            'Dia já jogado!',
            `Você já completou ${completedCount} Pokémon(s) hoje. Continue jogando para completar o restante!`,
            [
              {text: 'ver ranking', onPress: () => router.push('/ranking')},
              {text: 'voltar ao início', onPress: () => router.push('/home')}
            ]
          );
          setGameFinished(true);
          setLoading(false);
          return;
        }

        if (completedCount > 0) {
          console.log('🔍 5. Entrou no completedCount > 0');
          Alert.alert(
            'progresso', 'você já completou ' + completedCount + ' pokémon(s) hoje! continue jogando para completar o restante!',
          )
        }else{
          console.log('🔍 6. userId é undefined ou null');
        }
      }

      const savedScore = await AsyncStorage.getItem(`score_${userId}`);
      if (savedScore) setScore(parseInt(savedScore));
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível carregar o jogo');
    }
    setLoading(false);
  };
  
  const currentPokemon = dailyPokemons[currentIndex];
  
  const getHint = () => {
    const hintsOrder = ['ability', 'height', 'type', 'number'];
    const hintType = hintsOrder[attempts - 1];
    
    switch(hintType) {
      case 'ability': return `⚡ Habilidade: ${currentPokemon?.ability}`;
      case 'height': return `📏 Altura: ${currentPokemon?.height}m | Peso: ${currentPokemon?.weight}kg`;
      case 'type': return `🔥 Tipo: ${currentPokemon?.types?.join('/')}`;
      case 'number': return `🔢 Nº ${currentPokemon?.id} na Pokédex`;
      default: return '';
    }
  };
  
  const calculatePoints = () => {
    const pointsTable = [100, 80, 60, 40, 20];
    return pointsTable[attempts] || 10;
  };
  
  const nextPokemon = () => {
    if (currentIndex + 1 < dailyPokemons.length) {
      setCurrentIndex(currentIndex + 1);
      setAttempts(0);
      setInput('');
      setRevealed(false);
    } else {
      setGameFinished(true);
    }
  };
  
  const checkGuess = async () => {
    if (!input.trim()) {
      Alert.alert('Ops!', 'Digite o nome do Pokémon');
      return;
    }
    
    const isCorrect = input.toLowerCase().trim() === currentPokemon?.name;
    
    if (isCorrect) {
      const points = calculatePoints();
      const newScore = score + points;
      setScore(newScore);
      
      const userId = auth.currentUser?.uid;
      const userName = user?.displayName || 'Anônimo';

      if (userId) {
        const alreadyCompleted = await hasCompletedPokemon(userId, currentIndex);
        if (alreadyCompleted) {
          Alert.alert('Atenção!', 'Você já completou este Pokémon hoje!');
          nextPokemon();
          return;
        }
      }

      console.log('Valores:', { userId, userName, points });
      if (userId && userName){
        console.log('Tentando salvar:', { userId, points, userName });
        const result = await saveScoreToFirebase(userId, points, userName);
        await saveDailyProgress(userId, currentIndex, points);
        console.log('Resultado:', result);
      }else{        console.warn('Usuário ou nome não disponíveis para salvar pontuação');
      }

      Alert.alert('Parabéns!', `Você ganhou ${points} pontos!`);

      setRevealed(true);
      
      Alert.alert(
        '🎉 Acertou!', 
        `Você ganhou ${points} pontos!`,
        [{ text: 'Próximo Pokémon', onPress: nextPokemon }]
      );
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setRevealed(true);
        Alert.alert(
          '❌ Que pena!', 
          `Era ${currentPokemon?.name}!`,
          [{ text: 'Próximo Pokémon', onPress: nextPokemon }]
        );
      } else {
        Alert.alert('❌ Errou!', getHint());
      }
    }
    setInput('');
  };
  
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e7775e" />
      </View>
    );
  }
  
  if (gameFinished) {
    return (
      <View style={styles.center}>
        <Text style={styles.finishedTitle}>🎮 Dia concluído!</Text>
        <Text style={styles.finishedScore}>Pontuação total: {score}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/home')}>
          <Text style={styles.buttonText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!currentPokemon) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/home')}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Qual é esse Pokémon?</Text>
        <Text style={styles.score}>⭐ {score}</Text>
      </View>
      
      <Text style={styles.progress}>
        Pokémon {currentIndex + 1} de {dailyPokemons.length}
      </Text>
      
      <View style={styles.progressContainer}>
        {dailyPokemons.map((_, idx) => (
          <View key={idx} style={styles.progressDot}>
            <Text style={idx <= currentIndex ? styles.progressActive : styles.progressInactive}>
              {idx < currentIndex ? '✅' : '⬜'}
            </Text>
          </View>
        ))}
      </View>

      <Image 
        source={{ uri: currentPokemon.sprite }}
        style={[styles.silhouette, revealed && styles.revealed]}
        resizeMode="contain"
      />
      
      {!revealed && attempts > 0 && (
        <View style={styles.hintsContainer}>
          <Text style={styles.hint}>{getHint()}</Text>
        </View>
      )}
      
      {!revealed && (
        <>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Digite o nome do Pokémon..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity style={styles.button} onPress={checkGuess}>
            <Text style={styles.buttonText}>Adivinhar</Text>
          </TouchableOpacity>
          
          <Text style={styles.attempts}>
            Tentativas: {attempts}/5
          </Text>
        </>
      )}
      
      {revealed && (
        <View style={styles.revealedContainer}>
          <Text style={styles.revealedName}>{currentPokemon.name}</Text>
          <TouchableOpacity style={styles.button} onPress={nextPokemon}>
            <Text style={styles.buttonText}>Próximo →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20
  },
  backButton: {
    fontSize: 28,
    color: '#e7775e',
    paddingHorizontal: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  score: {
    fontSize: 18,
    color: '#e7775e',
    fontWeight: 'bold'
  },
  progress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30
  },
  silhouette: {
    width: 250,
    height: 250,
    tintColor: '#000',
    marginBottom: 30
  },
  revealed: {
    tintColor: undefined
  },
  hintsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%'
  },
  hint: {
    fontSize: 16,
    textAlign: 'center'
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fafafa'
  },
  button: {
    backgroundColor: '#e7775e',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  attempts: {
    fontSize: 14,
    color: '#666'
  },
  finishedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  finishedScore: {
    fontSize: 20,
    marginBottom: 30
  },
  revealedContainer: {
    alignItems: 'center',
    marginTop: 20
  },
  revealedName: {
    fontSize: 24,
    fontWeight: 'bold',
    textTransform: 'capitalize',
    marginBottom: 20
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20
  },
  progressDot: {
    width: 40,
    alignItems: 'center'
  },
  progressActive: {
    fontSize: 20
  },
  progressInactive: {
    fontSize: 20,
    opacity: 0.3
  }
});