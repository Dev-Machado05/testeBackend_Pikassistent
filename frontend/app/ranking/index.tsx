import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { getGlobalRanking } from '../../services/gameService';
import { router } from 'expo-router';

export default function RankingScreen() {
  const [ranking, setRanking] = useState<{ name: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
    setLoading(true);
    try {
      const data = await getGlobalRanking();
      setRanking(data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e7775e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/home')}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏆 Ranking Global</Text>
        <View style={{ width: 30 }} />
      </View>

      <FlatList
        data={ranking}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.rankingItem}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.score}>{item.score} pts</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum jogador no ranking ainda</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20
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
    marginBottom: 30,
    paddingTop: 20
  },
  backButton: {
    fontSize: 28,
    color: '#e7775e',
    paddingHorizontal: 10
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold'
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    marginBottom: 5,
    borderRadius: 8
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e7775e',
    width: 40
  },
  name: {
    fontSize: 16,
    flex: 1,
    textTransform: 'capitalize'
  },
  score: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666'
  }
});