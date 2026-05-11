import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/assets/services/firebaseConfig';
import {doc, setDoc, increment, getDoc, collection, query, orderBy, limit, getDocs} from 'firebase/firestore';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2/pokemon';

export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  height: number;
  weight: number;
  ability: string;
  sprite: string;
}

// Lista de IDs lendários (principais - pode expandir depois)
const LEGENDARY_IDS = [
  144, 145, 146, 150, 151,  // Kanto
  243, 244, 245, 249, 250, 251,  // Johto
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,  // Hoenn
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,  // Sinnoh
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,  // Unova
  716, 717, 718, 719, 720, 721,  // Kalos
  785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800,  // Alola
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,  // Galar
  1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017,  // Paldea
];

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:7070"; 

export async function getDailyPokemons(): Promise<Pokemon[]> {
  const response = await fetch(`${API_BASE}/api/daily`);
  const data = await response.json();
  return data;
}

function getRangeByDay(day: number): [number, number] {
  const ranges: Record<number, [number, number]> = {
    1: [1, 170],     // Segunda
    2: [171, 341],   // Terça
    3: [342, 512],   // Quarta
    4: [513, 683],   // Quinta
    5: [684, 854],   // Sexta
    6: [855, 1025]   // Sábado
  };
  return ranges[day] || [1, 170];
}

function getRandomIdFromRange([min, max]: [number, number], userId: string): number {
  // TODO: Implementar lógica de não repetição nos últimos 30 dias
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchPokemon(id: number): Promise<Pokemon> {
  try {
    const response = await fetch(`${POKEAPI_BASE}/${id}`);
    const data = await response.json();
    
    return {
      id: data.id,
      name: data.name,
      types: data.types.map((t: any) => t.type.name),
      height: data.height / 10,
      weight: data.weight / 10,
      ability: data.abilities[0]?.ability.name || 'Desconhecida',
      sprite: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default
    };
  } catch (error) {
    console.error('Erro ao buscar Pokémon:', error);
    throw error;
  }
}

export async function saveScoreToFirebase(userId: string, points: number, username: string): Promise<void> {
    const userRef = doc(db, 'ranking', userId);

    await setDoc(userRef, {
        username: username,
        totalScore: increment(points),
        lastPlayDate: new Date().toISOString(),
        updatedAt: new Date()
    }, { merge: true });
}

export async function getGlobalRanking(): Promise<{ name: string; score: number }[]> {
    const rankingRef = collection(db, 'ranking');
    const q = query(rankingRef, orderBy('totalScore', 'desc'), limit(10));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
        name: doc.data().username,
        score: doc.data().totalScore
    }));
}

export async function saveDailyProgress(userId: string, pokemonIndex: number, points: number) {
  const today = new Date().toISOString().split('T')[0];
  const progressRef = doc(db, 'dailyProgress', `${userId}_${today}`);
  
  await setDoc(progressRef, {
    [`pokemon_${pokemonIndex}`]: {
      completed: true,
      points: points,
      date: today
    }
  }, { merge: true });
}

export async function hasCompletedPokemon(userId: string, pokemonIndex: number): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const progressRef = doc(db, 'dailyProgress', `${userId}_${today}`);
  const docSnap = await getDoc(progressRef);
  
  if (docSnap.exists()) {
    return docSnap.data()[`pokemon_${pokemonIndex}`]?.completed || false;
  }
  return false;
}

export async function getTodayCompletedCount(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  console.log('🔍 getTodayCompletedCount - userId:', userId); 
  console.log('🔍 getTodayCompletedCount - today:', today);

  const progressRef = doc(db, 'dailyProgress', `${userId}_${today}`);
  const docSnap = await getDoc(progressRef);
  
  console.log('🔍 Documento existe?', docSnap.exists());

  if (!docSnap.exists()) return 0;
  
  const data = docSnap.data();
  console.log('🔍 Dados do documento:', data)

  let count = 0;
  for (let i = 0; i < 3; i++) {
    if (data[`pokemon_${i}`]?.completed) count++;
  }
  console.log('🔍 Total completado:', count);

  return count;
}