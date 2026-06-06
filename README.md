# ✈️ AI Travel Planner — TravelMind AI

> A RAG-powered travel chatbot built with MongoDB Atlas, Gemini AI, React, and Node.js — featuring Rico, your hilariously enthusiastic travel concierge.

---

## 🌍 Project Overview

TravelMind AI is a full-stack AI travel planning application that uses **Retrieval-Augmented Generation (RAG)** to provide grounded, accurate travel advice. Instead of relying solely on an AI model's training data, Rico retrieves relevant information from a curated knowledge base before generating responses.

**Built for:** IWU Graduate Coursework — AIML-501  
**Team:** Group 8

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Vector Database | MongoDB Atlas (vector search) |
| Embeddings | Gemini Embedding 001 (768 dims) |
| Generation | Gemini 2.5 Flash |
| Styling | Custom CSS-in-JS (magazine theme) |

---

## 🤖 How RAG Works

```
INGEST (once):
Travel guide text → chunk (150 words) → Gemini embedding → store in MongoDB

QUERY (every message):
User question → embed → MongoDB vector search → top 5 chunks → Gemini prompt → Rico's answer
```

---

## 📁 Project Structure

```
travel_agent_iwu/
├── travel-rag-backend/     # Node.js Express API
│   ├── server.js           # Main server with RAG pipeline
│   ├── .env                # API keys (not committed)
│   └── package.json
└── travel-frontend/        # React + Vite web app
    ├── src/
    │   ├── App.jsx         # Main app with magazine-style chat UI
    │   └── index.css
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- MongoDB Atlas account (free M0 tier)
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))

### 1. Clone the repo

```bash
git clone https://github.com/nicoolesy/travel-agent.git
cd travel-agent
```

### 2. Set up the backend

```bash
cd travel-rag-backend
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/travel_rag?appName=Cluster0
MONGODB_DB=travel_rag
PORT=3001
```

Start the backend:

```bash
node server.js
```

### 3. Ingest the travel knowledge base

```bash
curl -X POST http://localhost:3001/ingest/guides
```

This loads 5 curated travel guides (Tokyo, Paris, Bali, Barcelona, NYC) into MongoDB as vector embeddings.

### 4. Set up the frontend

```bash
cd ../travel-frontend
npm install
npm run dev
```

Open **http://localhost:5174** in your browser.

---

## 💬 Features

- **Rico the Travel Chatbot** — funny, punny, travel-obsessed AI assistant
- **RAG Pipeline** — answers grounded in real knowledge base, not hallucinations
- **PDF Upload** — users can add their own travel docs to the knowledge base
- **Itinerary Generator** — ask Rico for a day-by-day plan and get a formatted table
- **Guardrails** — Rico only answers travel-related questions
- **Fallback mechanism** — returns full knowledge base when no vector matches found
- **Model fallback chain** — gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite

---

## 🗺️ Knowledge Base

Pre-loaded travel guides covering:
- 🇯🇵 Tokyo, Japan
- 🇫🇷 Paris, France
- 🇮🇩 Bali, Indonesia
- 🇪🇸 Barcelona, Spain
- 🇺🇸 New York City, USA

Users can extend the knowledge base by uploading PDF travel documents via the `/ingest/pdf` endpoint.

---

## 🔒 Guardrails & Validation

- System prompt restricts Rico to travel-only topics
- Off-topic questions trigger a friendly redirect response
- Vector search fallback ensures users always get a response
- Multi-model fallback handles Gemini API downtime

---

## 🌐 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | Coming soon |
| Backend | Render | Coming soon |
| Database | MongoDB Atlas | Free M0 tier |

---

## 📝 License

MIT — feel free to fork and build your own travel assistant!

---

> *"Let's get this show on the ROAM!"* — Rico ✈️
