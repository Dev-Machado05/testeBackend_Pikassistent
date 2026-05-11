require("dotenv").config();
const cors = require("cors");
const express = require("express");
const crypto = require("crypto");
const auth = require("./auth/authMiddleware");
const admin = require("./auth/firebaseAdmin");
const Groq = require("groq-sdk");

const app = express();
const db = admin.firestore();
const CARD_ROLL_COST = 5;

// Infra da API: configuracao de CORS e preflight.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Infra da API: habilita leitura de JSON no corpo das requisicoes.
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function normalizeInventoryItem(card) {
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    image: card.image,
    imagem: card.image,
    rarity: card.rarity ?? null,
    set: card.set ?? null,
    quantity: card.quantity ?? 1,
    timestamp: card.timestamp ?? new Date().toISOString(),
  };
}

async function updateUserTokensAndInventory({
  userId,
  card,
  tokenCost = CARD_ROLL_COST,
}) {
  if (!userId) {
    throw new Error("ID do usuário faltando.");
  }

  if (!card?.id) {
    throw new Error("Carta inválida.");
  }

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(userId);
    const userSnapshot = await transaction.get(userRef);

    if (!userSnapshot.exists) {
      throw new Error("Usuário não encontrado.");
    }

    const userData = userSnapshot.data() || {};
    const currentTokenAmount = Number(userData.tokenAmount ?? 0);

    if (
      !Number.isFinite(currentTokenAmount) ||
      currentTokenAmount < tokenCost
    ) {
      throw new Error("Quantidade de tokens insuficiente.");
    }

    const inventory = Array.isArray(userData.inventory)
      ? [...userData.inventory]
      : [];
    const normalizedCard = normalizeInventoryItem(card);
    const existingCardIndex = inventory.findIndex(
      (item) => item.id === normalizedCard.id,
    );

    if (existingCardIndex >= 0) {
      const existingCard = inventory[existingCardIndex];
      inventory[existingCardIndex] = {
        ...existingCard,
        ...normalizedCard,
        quantity: Number(existingCard.quantity ?? 1) + 1,
        timestamp: existingCard.timestamp ?? normalizedCard.timestamp,
      };
    } else {
      inventory.push(normalizedCard);
    }

    const updatedTokenAmount = currentTokenAmount - tokenCost;

    transaction.update(userRef, {
      tokenAmount: updatedTokenAmount,
      inventory,
    });

    return {
      tokenAmount: updatedTokenAmount,
      inventory,
    };
  });
}

async function getUserInventoryById(userId, target) {
  if (!userId) {
    throw new Error("ID do usuário faltando.");
  }

  const userRef = db.collection("users").doc(userId);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    throw new Error("Usuário não encontrado.");
  }

  const userData = userSnapshot.data() || {};

  switch (target) {
    case "all":
      return {
        userId,
        tokenAmount: Number(userData.tokenAmount ?? 0),
        inventory: Array.isArray(userData.inventory) ? userData.inventory : [],
      };
      break;

    case "token": 
      return {
        tokenAmount: Number(userData.tokenAmount ?? 0),
      };
      break;
    
    case "inventory": 
      return {
        inventory: Array.isArray(userData.inventory) ? userData.inventory : [],
      };
      break;
  }
}

let messages = [
  {
    id: crypto.randomUUID(),
    text: "Oi, tudo bem?",
    senderName: "aRandonGuy",
  },
];

// autenticação:
app.get("/profile", auth, (req, res) => {
  res.json({
    message: "Usuário autenticado",
    uid: req.user.uid,
    email: req.user.email,
  });
});

// chat global (memoria local): lista mensagens salvas.
app.get("/api/getMessage", (req, res) => {
  res.status(200).json({ success: true, data: messages });
});

// chat global (memoria local): salva mensagem enviada.
app.post("/api/postMessage", (req, res) => {
  try {
    const { id, message, senderName } = req.body;

    if (!message || !senderName) {
      return res.status(400).json({
        success: false,
        error: "Mensagem ou nome do remetente faltando.",
      });
    }

    const userId = id || `anon_${Date.now()}`;

    messages.push({
      id: userId,
      text: message,
      senderName: senderName || "Anônimo",
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error });
  }
});

// Chatbot IA: recebe mensagem do usuario e gera resposta com Groq.
app.post("/api/chat", async (req, res) => {
  try {
    console.log("🔍 HEADERS:", req.headers);
    console.log("🔍 BODY:", req.body);
    console.log("🔍 Body type:", typeof req.body);
    console.log("🔍 Body keys:", Object.keys(req.body));

    const { message } = req.body;
    console.log("🔍 Message:", message);

    if (!message) {
      console.error("Mensagem faltando no corpo da requisição.");
      return res.status(400).json({
        success: false,
        error: "Mensagem faltando.",
      });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Você é o Pikassistent, um expert em Pokémon da 1ª geração. Seja calmo, paciente e responda em português com o humor de um fã.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const botResponse = completion.choices[0].message.content;

    res.status(200).json({
      success: true,
      response: botResponse,
    });
  } catch (error) {
    console.error("Error generating chat completion:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// "roll" a random card
app.post("/api/rollCard", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "ID do usuário faltando.",
      });
    }

    const resp = await fetch("https://api.carddex.dev/v1/cards/random");
    const data = await resp.json();

    if (!resp.ok || !data?.data?.id) {
      return res.status(502).json({
        success: false,
        error: "Não foi possível sortear uma carta.",
      });
    }

    const cardResp = {
      id: data.data.id,
      cardID: data.data.id,
      name: data.data.name,
      number: data.data.number,
      image: data.data.image_url,
    };

    const updatedUser = await updateUserTokensAndInventory({
      userId,
      card: cardResp,
      tokenCost: CARD_ROLL_COST,
    });

    res.status(200).json({
      success: true,
      cardResp,
      tokenAmount: updatedUser.tokenAmount
    });
  } catch (err) {
    console.error(err);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// pegar todas as cartas do inventário do usuário
app.get("/api/users/:userId/cards", async (req, res) => {
  try {
    const { userId } = req.params;
    const userCards = await getUserInventoryById(userId, "all");

    res.status(200).json({
      success: true,
      ...userCards,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// get the amount of tokens into the user's inventory
app.get("/api/users/:userId/tokens", async (req, res) => {
  try {
    const { userId } = req.params;
    const userTokens = await getUserInventoryById(userId, "token");
    const tokenAmount = Number(userTokens?.tokenAmount ?? 0);

    res.status(200).json({
      success: true,
      tokens: tokenAmount,
      tokenAmount,
    });
  } catch(error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = app;
