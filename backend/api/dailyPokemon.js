const express = require('express');
const router = express.Router();
const {db} = require('../auth/firebaseAdmin'); 

// Cache em memória
let cachedPokemons = null;
let cachedDate = null;

// Lista de lendários
const LEGENDARY_IDS = [
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493
];

router.get('/daily', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try{
    const docRef = db.collection('dailyPokemons').doc(today);
    const doc = await docRef.get();

    if (doc.exists) {
      console.log('Pokémons do dia encontrados no Firestore, retornando cache.', today);
      return res.json(doc.data().pokemons);
    }

    console.log('Nenhum Pokémon do dia encontrado no Firestore, gerando novos.', today);
    const dayOfWeek = new Date().getUTCDay();
    const pokemons = [];

    for (let i = 0; i < 3; i++) {
      let pokemonId;

      if (dayOfWeek === 0) {
        const randomIndex = Math.floor(Math.random() * LEGENDARY_IDS.length);
        pokemonId = LEGENDARY_IDS[randomIndex];
      } else {
        const ranges = {
          1: [1, 170], 2: [171, 341], 3: [342, 512],
          4: [513, 683], 5: [684, 854], 6: [855, 1025]
        };
        const [min, max] = ranges[dayOfWeek] || [1, 170];
        pokemonId = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
      const data = await response.json();

      pokemons.push({
        id: data.id,
        name: data.name,
        types: data.types.map(t => t.type.name),
        height: data.height / 10,
        weight: data.weight / 10,
        ability: data.abilities[0]?.ability.name || 'Desconhecida',
        sprite: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default
      });
    }


    await docRef.set({
      date: today,
      pokemons: pokemons,
      createdAt: new Date()
    });

    res.json(pokemons);
  }catch (error) {
    console.error('Erro ao obter ou salvar os Pokémons do dia:', error);
    res.status(500).json({ error: 'Erro ao obter os Pokémons do dia' });
  }
});
  /* 
  // Se já temos cache para hoje, retorna
  if (cachedDate === today && cachedPokemons) {
    return res.json(cachedPokemons);
  }
  
  // Gerar 3 Pokémon do dia
  const dayOfWeek = new Date().getUTCDay();
  const pokemons = [];
  
  for (let i = 0; i < 3; i++) {
    let pokemonId;
    
    if (dayOfWeek === 0) {
      // Domingo: lendários
      const randomIndex = Math.floor(Math.random() * LEGENDARY_IDS.length);
      pokemonId = LEGENDARY_IDS[randomIndex];
    } else {
      // Dias de semana
      const ranges = {
        1: [1, 170], 2: [171, 341], 3: [342, 512],
        4: [513, 683], 5: [684, 854], 6: [855, 1025]
      };
      const [min, max] = ranges[dayOfWeek] || [1, 170];
      pokemonId = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Buscar da PokeAPI
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const data = await response.json();
    
    pokemons.push({
      id: data.id,
      name: data.name,
      types: data.types.map(t => t.type.name),
      height: data.height / 10,
      weight: data.weight / 10,
      ability: data.abilities[0]?.ability.name || 'Desconhecida',
      sprite: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default
    });
  }
  
  // Salvar no cache
  cachedDate = today;
  cachedPokemons = pokemons;
  
  res.json(pokemons);
}); */

module.exports = router;