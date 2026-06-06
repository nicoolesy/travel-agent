require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdf = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// ── Clients ──────────────────────────────────────────────────────────────────
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Pre-loaded travel guides ──────────────────────────────────────────────────
const TRAVEL_GUIDES = [
  {
    destination: "Tokyo",
    content: `Tokyo Travel Guide. Best time to visit: March-May (cherry blossoms) and Oct-Nov (autumn foliage). 
    Weather: Humid subtropical climate. Summers are hot and humid (30°C), winters are mild with occasional snow (5°C).
    Currency: Japanese Yen (JPY). 1 USD ≈ 150 JPY. Cash is widely used; carry yen.
    Transport: Suica IC card for trains and subway. JR Pass for bullet trains between cities.
    Must-see: Senso-ji Temple in Asakusa, Shibuya Crossing, Shinjuku Gyoen, TeamLab Planets, Tsukiji Outer Market.
    Food: Try ramen at Ichiran, sushi at Tsukiji, yakitori in Yurakucho, izakaya dining in Shinjuku.
    Neighborhoods: Shinjuku (nightlife, shopping), Harajuku (fashion, youth culture), Asakusa (traditional), Ginza (luxury).
    Visa: Many nationalities get 90-day visa-free entry. Check Japan immigration for your country.
    Budget: Mid-range ¥15,000-25,000/day ($100-165). Budget ¥8,000/day ($53). Luxury ¥50,000+/day.
    Packing: Comfortable walking shoes, IC transit card, pocket WiFi or SIM, cash yen, universal adapter.
    Safety: Extremely safe. Low crime. Natural disaster risk: earthquakes — know your hotel evacuation plan.`
  },
  {
    destination: "Paris",
    content: `Paris Travel Guide. Best time to visit: April-June and September-October for mild weather and fewer crowds.
    Weather: Oceanic climate. Mild summers (25°C), cool winters (5°C). Rain year-round; pack a light jacket.
    Currency: Euro (EUR). 1 USD ≈ 0.92 EUR. Cards widely accepted; some small cafes prefer cash.
    Transport: Metro is excellent and cheap. Navigo weekly pass is best value. Vélib bikes for short trips.
    Must-see: Eiffel Tower (book tickets in advance!), Louvre Museum, Musée d'Orsay, Montmartre, Notre-Dame Cathedral.
    Food: Croissants at local boulangeries, steak frites, crêpes on the street, wine at bistros. Try Le Marais for diverse food.
    Neighborhoods: Le Marais (trendy, historic), Saint-Germain (literary, cafes), Montmartre (artists, views), Bastille (nightlife).
    Visa: Schengen visa — US/UK/many nationalities get 90 days visa-free.
    Budget: Mid-range €150-250/day ($165-275). Budget €80/day. Luxury €400+/day.
    Packing: Comfortable shoes (cobblestones!), scarf, light raincoat, EU adapter (Type E plug).
    Safety: Generally safe. Watch for pickpockets around Eiffel Tower and on Metro. Keep bags zipped.`
  },
  {
    destination: "Bali",
    content: `Bali Travel Guide. Best time to visit: April-October (dry season). Avoid November-March (heavy rains).
    Weather: Tropical. Hot and humid year-round (27-33°C). Dry season is sunny; wet season has daily afternoon showers.
    Currency: Indonesian Rupiah (IDR). 1 USD ≈ 15,700 IDR. Cash is king; ATMs available in tourist areas.
    Transport: Rent a scooter ($5-8/day) or hire a private driver ($40-60/day). No reliable public transport.
    Must-see: Ubud Monkey Forest, Tegalalang Rice Terraces, Tanah Lot Temple, Mount Batur sunrise trek, Seminyak Beach.
    Food: Nasi goreng, satay, babi guling (suckling pig), fresh tropical fruits. Eat at warungs for cheap authentic food.
    Areas: Seminyak (luxury, beach clubs), Ubud (culture, yoga), Canggu (surf, cafes), Uluwatu (cliffs, surf).
    Visa: 30-day visa on arrival free for many nationalities. Extendable to 60 days for $35.
    Budget: Budget $30-50/day. Mid-range $80-150/day. Luxury $200+/day.
    Packing: Light cotton clothes, reef-safe sunscreen, mosquito repellent, sarong (required for temples), sandals.
    Safety: Safe for tourists. Watch for scooter accidents (wear helmet!). Avoid tap water — drink bottled.`
  },
  {
    destination: "Barcelona",
    content: `Barcelona Travel Guide. Best time to visit: May-June and September-October. July-August is hot and very crowded.
    Weather: Mediterranean climate. Hot dry summers (30°C), mild winters (13°C). Rarely rains in summer.
    Currency: Euro (EUR). Cards accepted everywhere. Contactless payments very common.
    Transport: T-Casual 10-trip metro card is great value. Buses and trams also good. Walkable city center.
    Must-see: Sagrada Família (book weeks ahead!), Park Güell, Casa Batlló, La Boqueria Market, Gothic Quarter, Barceloneta Beach.
    Food: Tapas, pa amb tomàquet, paella, jamón ibérico, sangria. Locals eat dinner 9-10pm.
    Neighborhoods: Gothic Quarter (historic), El Born (trendy), Gràcia (local feel), Eixample (Gaudí architecture).
    Visa: Schengen — US/UK get 90 days visa-free.
    Budget: Mid-range €120-200/day. Budget €60-80/day. Luxury €300+/day.
    Packing: Comfortable walking shoes, sun cream, light layers for evenings, EU adapter (Type F plug).
    Safety: Watch for pickpockets on Las Ramblas and at tourist sites. Keep valuables secure.`
  },
  {
    destination: "New York City",
    content: `New York City Travel Guide. Best time to visit: April-June and September-November.
    Weather: Humid continental. Hot summers (30°C), cold winters (-3°C to 5°C). Spring and fall are ideal.
    Currency: US Dollar (USD). Cards accepted universally. Tip 18-20% at restaurants.
    Transport: NYC Subway runs 24/7. OMNY contactless tap for subway. Citi Bike for short trips.
    Must-see: Central Park, Times Square, Brooklyn Bridge, Metropolitan Museum of Art, High Line, 9/11 Memorial, Statue of Liberty.
    Food: NYC bagels, pizza by the slice, deli sandwiches, dim sum in Chinatown.
    Neighborhoods: Midtown (tourist hub), Brooklyn (local, trendy), Lower East Side (nightlife), Harlem (culture, food).
    Visa: ESTA required for Visa Waiver Program countries ($21). Other nationalities need B-2 tourist visa.
    Budget: Budget $150/day. Mid-range $250-400/day. Luxury $600+/day.
    Packing: Comfortable walking shoes (you'll walk 10+ miles/day), layers for weather changes, portable charger.
    Safety: Very safe in tourist areas. Normal city precautions apply.`
  }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getEmbedding(text) {
  const model = gemini.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function chunkText(text, size = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return chunks;
}

async function upsertChunks(chunks, source) {
  const vectors = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: `${source}-${Date.now()}-${i}`,
      values: await getEmbedding(chunk),
      metadata: { text: chunk, source },
    }))
  );
  await index.upsert(vectors);
  return vectors.length;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => res.json({ status: "Travel RAG backend running ✅ (Gemini powered)" }));

// Ingest pre-loaded travel guides
app.post("/ingest/guides", async (req, res) => {
  try {
    let total = 0;
    for (const guide of TRAVEL_GUIDES) {
      const chunks = chunkText(guide.content);
      const count = await upsertChunks(chunks, `guide-${guide.destination.toLowerCase()}`);
      total += count;
      console.log(`✅ Ingested ${guide.destination}: ${count} chunks`);
    }
    res.json({ success: true, message: `Ingested ${total} chunks from ${TRAVEL_GUIDES.length} travel guides` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Upload and ingest a PDF
app.post("/ingest/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const data = await pdf(req.file.buffer);
    const source = req.file.originalname.replace(/\s+/g, "-").replace(".pdf", "");
    const chunks = chunkText(data.text);
    const count = await upsertChunks(chunks, `pdf-${source}`);
    res.json({ success: true, message: `Ingested ${count} chunks from ${req.file.originalname}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// RAG query — embed → Pinecone search → Gemini answers with context
app.post("/query", async (req, res) => {
  try {
    const { question, chatHistory = [] } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    // 1. Embed the question
    const queryVector = await getEmbedding(question);

    // 2. Search Pinecone for top 5 relevant chunks
    const results = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
    });

    const chunks = results.matches
      .filter(m => m.score > 0.5)
      .map(m => ({ text: m.metadata.text, source: m.metadata.source, score: m.score }));

    const context = chunks.length > 0
      ? chunks.map(c => `[Source: ${c.source}]\n${c.text}`).join("\n\n---\n\n")
      : "No relevant documents found in the knowledge base.";

    // 3. Build prompt with context + chat history
    const historyText = chatHistory
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `You are a helpful travel assistant. Use the travel knowledge base context below to answer the question. If the context doesn't have enough info, use your general knowledge and say so. Be concise, friendly, and practical.

${historyText ? `Chat history:\n${historyText}\n` : ""}
Knowledge base context:
${context}

User question: ${question}

Answer:`;

    // 4. Gemini generates the answer
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const answer = result.response.text();
    const sources = [...new Set(chunks.map(c => c.source))];

    res.json({ answer, sources, chunksUsed: chunks.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Travel RAG backend on http://localhost:${PORT}`));
