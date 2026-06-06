// require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdf = require("pdf-parse");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// ── MongoDB ───────────────────────────────────────────────────────────────────
let db, collection;
async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "travel_rag");
  collection = db.collection("documents");
  console.log("✅ Connected to MongoDB Atlas");
}

// ── Pre-loaded travel guides ──────────────────────────────────────────────────
const TRAVEL_GUIDES = [
  { source: "guide-tokyo", content: "Tokyo Travel Guide. Best time to visit: March-May cherry blossoms and Oct-Nov autumn foliage. Weather: Humid subtropical climate. Summers hot and humid 30C, winters mild with occasional snow 5C. Currency: Japanese Yen JPY. 1 USD is 150 JPY. Cash widely used carry yen. Transport: Suica IC card for trains and subway. JR Pass for bullet trains. Must-see: Senso-ji Temple Asakusa, Shibuya Crossing, Shinjuku Gyoen, TeamLab Planets, Tsukiji Outer Market. Food: Ramen at Ichiran, sushi at Tsukiji, yakitori in Yurakucho, izakaya in Shinjuku. Visa: Many nationalities get 90-day visa-free entry. Budget: Mid-range 15000-25000 yen per day 100-165 USD. Safety: Extremely safe. Low crime." },
  { source: "guide-paris", content: "Paris Travel Guide. Best time to visit: April-June and September-October for mild weather and fewer crowds. Weather: Oceanic climate. Mild summers 25C, cool winters 5C. Rain year-round pack a light jacket. Currency: Euro EUR. 1 USD is 0.92 EUR. Cards widely accepted. Transport: Metro excellent and cheap. Navigo weekly pass best value. Must-see: Eiffel Tower book tickets ahead, Louvre Museum, Musee d Orsay, Montmartre, Notre-Dame. Food: Croissants at boulangeries, steak frites, crepes, wine at bistros. Visa: Schengen US UK 90 days visa-free. Budget: Mid-range 150-250 euros per day. Safety: Watch for pickpockets around Eiffel Tower and Metro." },
  { source: "guide-bali", content: "Bali Travel Guide. Best time to visit: April-October dry season. Avoid November-March heavy rains. Weather: Tropical. Hot and humid 27-33C year-round. Currency: Indonesian Rupiah IDR. 1 USD is 15700 IDR. Cash is king. Transport: Rent scooter 5-8 dollars per day or private driver 40-60 dollars per day. Must-see: Ubud Monkey Forest, Tegalalang Rice Terraces, Tanah Lot Temple, Mount Batur sunrise trek, Seminyak Beach. Food: Nasi goreng, satay, babi guling, tropical fruits. Eat at warungs for cheap food. Visa: 30-day visa on arrival free. Extendable 60 days for 35 dollars. Budget: Budget 30-50 dollars per day. Mid-range 80-150 dollars per day. Safety: Wear helmet on scooters. Drink bottled water." },
  { source: "guide-barcelona", content: "Barcelona Travel Guide. Best time to visit: May-June and September-October. July-August hot and crowded. Weather: Mediterranean. Hot dry summers 30C, mild winters 13C. Currency: Euro EUR. Cards accepted everywhere. Transport: T-Casual metro card great value. Walkable city center. Must-see: Sagrada Familia book weeks ahead, Park Guell, Casa Batllo, La Boqueria Market, Gothic Quarter, Barceloneta Beach. Food: Tapas, paella, jamon iberico, sangria. Locals eat dinner 9-10pm. Visa: Schengen US UK 90 days visa-free. Budget: Mid-range 120-200 euros per day. Safety: Watch for pickpockets on Las Ramblas." },
  { source: "guide-new-york", content: "New York City Travel Guide. Best time to visit: April-June and September-November. Weather: Humid continental. Hot summers 30C, cold winters -3C to 5C. Currency: US Dollar USD. Tip 18-20 percent at restaurants. Transport: NYC Subway runs 24 hours 7 days. OMNY contactless tap. Citi Bike for short trips. Must-see: Central Park, Times Square, Brooklyn Bridge, Metropolitan Museum of Art, High Line, 9/11 Memorial, Statue of Liberty. Food: NYC bagels, pizza by the slice, deli sandwiches, dim sum in Chinatown. Visa: ESTA required for Visa Waiver Program countries 21 dollars. Budget: Budget 150 dollars per day. Mid-range 250-400 dollars per day. Safety: Very safe in tourist areas." },
];

// ── Gemini Embedding ──────────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "models/gemini-embedding-001", content: { parts: [{ text }] } }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error("Embedding error: " + JSON.stringify(data));
  const values = data?.embedding?.values;
  if (!values?.length) throw new Error("Empty embedding returned");
  return values;
}

// ── Gemini Generation ─────────────────────────────────────────────────────────
async function callGemini(prompt, model = "gemini-2.0-flash") {
  const models = [model, "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];
  for (const m of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await res.json();
      if (res.status === 503 || res.status === 429) {
        console.log(`${m} unavailable, waiting 2s before trying next model...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) throw new Error("Gemini error: " + JSON.stringify(data));
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      if (m === models[models.length - 1]) throw err;
      console.log(`${m} failed, trying next...`);
    }
  }
  throw new Error("All Gemini models unavailable. Please try again shortly.");
}

// ── Chunk text ────────────────────────────────────────────────────────────────
function chunkText(text, size = 150, overlap = 20) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ");
    if (chunk.trim().length > 0) chunks.push(chunk);
    if (i + size >= words.length) break;
  }
  return chunks;
}

// ── Ingest docs into MongoDB ──────────────────────────────────────────────────
async function ingestDocs(docs) {
  let total = 0;
  for (const doc of docs) {
    const chunks = chunkText(doc.content);
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      await collection.insertOne({
        source: `${doc.source}-chunk${i}`,
        content: chunks[i],
        embedding,
        createdAt: new Date(),
      });
      total++;
    }
    console.log(`✅ Ingested ${doc.source}: ${chunks.length} chunks`);
  }
  return total;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", async (req, res) => {
  const count = await collection.countDocuments();
  res.json({ status: "Travel RAG backend running (MongoDB + Gemini)", totalDocs: count });
});

// Ingest pre-loaded travel guides
app.post("/ingest/guides", async (req, res) => {
  try {
    // Check if already ingested
    const existing = await collection.countDocuments({ source: /^guide-/ });
    if (existing > 0) {
      return res.json({ message: `Travel guides already ingested (${existing} chunks found). Skipping.` });
    }
    const total = await ingestDocs(TRAVEL_GUIDES);
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
    const sourceName = req.file.originalname.replace(/\s+/g, "-").replace(".pdf", "");
    const total = await ingestDocs([{ source: `pdf-${sourceName}`, content: data.text }]);
    res.json({ success: true, message: `Ingested ${total} chunks from ${req.file.originalname}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get destination suggestions
app.post("/suggestions", async (req, res) => {
  try {
    const { prefs, destination, duration, budget, style } = req.body;
    const prompt = `Find 3 travel destinations for someone who likes: ${prefs.join(", ")}. Destination hint: "${destination || "none"}". Duration: ${duration}. Budget: "${budget || "flexible"}". Travel style: ${style}. Respond ONLY with valid JSON array (no markdown, no extra text):
[{"name":"...","country":"...","tagline":"...","why":"...","bestFor":["..."],"budgetRange":"...","season":"..."}]`;
    const answer = await callGemini(prompt);
    const parsed = JSON.parse(answer.replace(/```json|```/g, "").trim());
    res.json({ suggestions: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get itinerary + budget
app.post("/itinerary", async (req, res) => {
  try {
    const { destination, country, duration, style, prefs, budget } = req.body;
    const [itinRaw, bdgRaw] = await Promise.all([
      callGemini(`Create a real day-by-day itinerary for ${destination}, ${country}. Duration: ${duration}. Style: ${style}. Preferences: ${prefs.join(", ")}. Include real restaurant and attraction names. Respond ONLY with valid JSON (no markdown):
{"days":[{"day":1,"title":"...","morning":"...","afternoon":"...","evening":"..."}]}`),
      callGemini(`Estimate costs in USD for a ${style.toLowerCase()} trip to ${destination}, ${country} for ${duration}. Budget hint: "${budget || "flexible"}". Respond ONLY with valid JSON (no markdown):
{"flights":0,"accommodation":0,"food":0,"activities":0,"transport":0,"tips":"..."}`)
    ]);
    const itinerary = JSON.parse(itinRaw.replace(/```json|```/g, "").trim());
    const budgetData = JSON.parse(bdgRaw.replace(/```json|```/g, "").trim());
    res.json({ itinerary, budget: budgetData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// RAG query — embed → MongoDB vector search → Gemini answers with context
app.post("/query", async (req, res) => {
  try {
    const { question, chatHistory = [] } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    // 1. Embed the question
    const queryEmbedding = await getEmbedding(question);

    // 2. MongoDB Atlas Vector Search
    const results = await collection.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 20,
          limit: 5,
        },
      },
      {
        $project: { content: 1, source: 1, score: { $meta: "vectorSearchScore" } },
      },
    ]).toArray();

    // Fallback: if vector search returns nothing, use all docs as context
    let context;
    if (results.length > 0) {
      context = results.map(r => `[Source: ${r.source}]\n${r.content}`).join("\n\n---\n\n");
    } else {
      console.log("No vector matches — using full knowledge base as fallback");
      const allDocs = await collection.find({}, { projection: { content: 1, source: 1 } }).limit(5).toArray();
      context = allDocs.length > 0
        ? allDocs.map(r => `[Source: ${r.source}]\n${r.content}`).join("\n\n---\n\n")
        : "No documents found in knowledge base.";
    }

    console.log(`Query: "${question}" → ${results.length} docs matched`);

    // 3. Build RAG prompt with guardrail
    const historyText = chatHistory
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `You are Rico, a hilariously enthusiastic travel assistant for the AI Travel Planner app. You LOVE travel more than anything in the world and can't help but be funny, punny, and overly dramatic about it.

Your personality rules:
- Use travel puns whenever possible
- Be dramatically excited about every destination
- Add fun emojis naturally throughout your answers ✈️🌍🗺️🎒
- Make witty observations about travel struggles
- Keep answers genuinely helpful AND entertaining

IMPORTANT FORMATTING RULE — ITINERARY DETECTION:
If the user asks for a travel plan, itinerary, schedule, trip plan, or "what to do in X for Y days", you MUST respond using this exact structured format:

---
🌍 [DESTINATION] [DURATION] ITINERARY

DAY 1 — [Theme Title]
| Time | Activity |
|------|----------|
| Morning | [activity with emoji] |
| Noon | [activity with emoji] |
| Afternoon | [activity with emoji] |
| Evening | [activity with emoji] |

DAY 2 — [Theme Title]
| Time | Activity |
|------|----------|
| 上午 Morning | [activity with emoji] |
| 中午 Noon | [activity with emoji] |
| 下午 Afternoon | [activity with emoji] |
| 晚上 Evening | [activity with emoji] |

[continue for all days...]

💡 Tips:
- [practical tip 1]
- [practical tip 2]
- [practical tip 3]
---

Use real attraction names, real restaurants, real neighborhoods. Be specific and funny in the activity descriptions. Include relevant emojis for each activity type (🍜 food, 🏛️ museum, 🌸 nature, 🛍️ shopping, ☕ cafe, etc.)

If the user asks about ANYTHING outside of travel, respond with:
"Whoa whoa whoa, I think your GPS is miscalibrated! 🗺️ I only navigate travel questions — destinations, weather, packing, visas, you name it. Non-travel stuff? That's way outside my boarding zone! ✈️"

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}Travel knowledge base context:
${context}

User question: ${question}

Answer (Rico style — funny, helpful, and use the itinerary table format if they asked for a plan!):`;

    // 4. Gemini generates the answer
    const answer = await callGemini(prompt);
    const sources = [...new Set(results.map(r => r.source))];

    res.json({ answer, sources, docsUsed: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Travel RAG backend on http://localhost:${PORT}`));
}).catch(err => {
  console.error("Failed to connect to MongoDB:", err.message);
  process.exit(1);
});