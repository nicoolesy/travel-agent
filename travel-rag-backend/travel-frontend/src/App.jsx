import { useState, useRef, useEffect } from "react";

const GREEN = "#1D9E75";
const DARK_GREEN = "#0F6E56";

async function callRAGChat(messages) {
  const question = messages[messages.length - 1].content;
  const chatHistory = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  try {
    const resp = await fetch("http://localhost:3001/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, chatHistory }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.answer + (data.sources?.length ? "\n\n📚 Sources: " + data.sources.join(", ") : "");
  } catch {
    return "Sorry, I couldn't reach the travel knowledge base. Make sure the backend is running on localhost:3001.";
  }
}

function parseMarkdown(text) {
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const parseBold = (str) => {
      // First split on **bold**, then on *italic*
      const boldParts = str.split(/\*\*(.*?)\*\*/g);
      return boldParts.flatMap((p, j) => {
        if (j % 2 === 1) return [<strong key={`b${j}`} style={{ fontWeight: 700 }}>{p}</strong>];
        // Handle *italic* within non-bold parts
        const italicParts = p.split(/\*(.*?)\*/g);
        return italicParts.map((ip, k) =>
          k % 2 === 1
            ? <em key={`i${j}-${k}`} style={{ fontStyle: "italic", fontWeight: 600, color: DARK_GREEN }}>{ip}</em>
            : ip
        );
      });
    };

    // Detect markdown table (| col | col |)
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().startsWith("|---")) {
      const headers = line.split("|").filter(h => h.trim()).map(h => h.trim());
      i += 2; // skip header and separator
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cols = lines[i].split("|").filter(c => c.trim()).map(c => c.trim());
        rows.push(cols);
        i++;
      }
      result.push(
        <div key={i} style={{ overflowX: "auto", marginBottom: 12, borderRadius: 10, border: "1px solid #E0EDE8" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "sans-serif" }}>
            <thead>
              <tr style={{ background: "#1D9E75", color: "#fff" }}>
                {headers.map((h, j) => (
                  <th key={j} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "#F7FBF9" : "#fff", borderBottom: "0.5px solid #E0EDE8" }}>
                  {row.map((col, ci) => (
                    <td key={ci} style={{ padding: "8px 14px", color: ci === 0 ? "#0F6E56" : "#1D1D1B", fontWeight: ci === 0 ? 600 : 400 }}>{col}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // DAY header
    if (line.match(/^DAY\s+\d+/i)) {
      result.push(
        <div key={i} style={{ background: "#1D3A2F", color: "#fff", padding: "8px 14px", borderRadius: "8px 8px 0 0", marginTop: 16, fontFamily: "sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
          {line}
        </div>
      );
      i++; continue;
    }

    // Horizontal rule
    if (line.trim() === "---") { result.push(<hr key={i} style={{ border: "none", borderTop: "0.5px solid #E8E8E4", margin: "12px 0" }} />); i++; continue; }

    // Bullet
    if (line.match(/^[-•*]\s+/)) {
      result.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
          <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0 }}>✦</span>
          <span>{parseBold(line.replace(/^[-•*]\s+/, ""))}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      const num = line.match(/^(\d+)\./)[1];
      result.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
          <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{num}.</span>
          <span>{parseBold(line.replace(/^\d+\.\s+/, ""))}</span>
        </div>
      );
      i++; continue;
    }

    // Sources
    if (line.startsWith("📚")) {
      result.push(<p key={i} style={{ fontSize: 11, color: "#aaa", borderTop: "0.5px solid #e5e5e5", marginTop: 10, paddingTop: 8, fontStyle: "italic" }}>{line}</p>);
      i++; continue;
    }

    // Heading ###
    if (line.startsWith("### ")) {
      result.push(<p key={i} style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 15, margin: "12px 0 4px", color: DARK_GREEN }}>{parseBold(line.replace("### ", ""))}</p>);
      i++; continue;
    }

    // Empty line
    if (line.trim() === "") { result.push(<div key={i} style={{ height: 6 }} />); i++; continue; }

    // Normal line
    result.push(<p key={i} style={{ margin: "0 0 4px", lineHeight: 1.65 }}>{parseBold(line)}</p>);
    i++;
  }
  return result;
}

function Dots() {
  return (
    <>
      <style>{`@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
      {[0, 200, 400].map(d => (
        <span key={d} style={{ width: 7, height: 7, borderRadius: 4, background: GREEN, display: "inline-block", margin: "0 2px", animation: `blink 1.2s ${d}ms infinite` }} />
      ))}
    </>
  );
}

function ChatPanel() {
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "Hola, fellow wanderer! 🌍✈️ I'm Rico, your hilariously over-enthusiastic travel assistant! I've got MongoDB-powered travel knowledge AND a suitcase full of puns. Ask me ANYTHING about travel and I promise to inform you AND make you groan at my jokes. Let's get this show on the ROAM! 🎒"
  }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);
  const suggestions = ["Best time to visit Tokyo?", "What to pack for Bali?", "Do I need a visa for Paris?", "Budget for NYC trip?"];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setThinking(true);
    const reply = await callRAGChat(next);
    setMsgs(prev => [...prev, { role: "assistant", content: reply }]);
    setThinking(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#FAFAF8", fontFamily: "Georgia, serif" }}>
      {/* Magazine header */}
      <div style={{ padding: "16px 28px", borderBottom: "2px solid #1D1D1B", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#888", fontFamily: "sans-serif" }}>Your personal</p>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1D1D1B", fontFamily: "Georgia, serif", letterSpacing: -0.5 }}>Travel Concierge</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22c55e" }} />
          <span style={{ fontSize: 11, color: "#888", fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>Rico · Live</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>✈</div>
                <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#888", fontFamily: "sans-serif" }}>Rico</span>
              </div>
            )}
            {m.role === "user" && (
              <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#888", fontFamily: "sans-serif", marginBottom: 6 }}>You</span>
            )}
            <div style={{
              maxWidth: "85%",
              padding: m.role === "user" ? "10px 16px" : "16px 20px",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
              background: m.role === "user" ? GREEN : "#fff",
              color: m.role === "user" ? "#fff" : "#1D1D1B",
              fontSize: 14,
              fontFamily: m.role === "user" ? "sans-serif" : "Georgia, serif",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: m.role === "assistant" ? "0.5px solid #E8E8E4" : "none",
              lineHeight: 1.65,
              textAlign: "left",
            }}>
              {m.role === "assistant" ? parseMarkdown(m.content) : m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>✈</div>
              <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#888", fontFamily: "sans-serif" }}>Rico</span>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#fff", border: "0.5px solid #E8E8E4", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <Dots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {msgs.length === 1 && (
        <div style={{ padding: "0 28px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggestions.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, border: "0.5px solid #D0D0C8", background: "#fff", color: "#555", cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 0.2 }}>{q}</button>
          ))}
        </div>
      )}

      <div style={{ height: "0.5px", background: "#E8E8E4", margin: "0 28px" }} />

      {/* Input */}
      <div style={{ padding: "14px 28px 20px", display: "flex", gap: 10, alignItems: "center", background: "#FAFAF8" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask Rico about your next adventure…"
          style={{ flex: 1, padding: "11px 18px", fontSize: 14, borderRadius: 24, border: "0.5px solid #D0D0C8", background: "#fff", color: "#1D1D1B", outline: "none", fontFamily: "Georgia, serif", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        />
        <button onClick={send} disabled={!input.trim() || thinking} style={{ width: 42, height: 42, borderRadius: 21, border: "none", background: input.trim() && !thinking ? GREEN : "#E8E8E4", color: input.trim() && !thinking ? "#fff" : "#aaa", cursor: input.trim() && !thinking ? "pointer" : "default", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>→</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#FAFAF8" }}>
      {/* Magazine masthead */}
      <div style={{ padding: "10px 28px", background: "#1D1D1B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>✈</span>
          <div>
            <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#aaa", fontFamily: "sans-serif" }}>TravelMind AI · </span>
            <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: GREEN, fontFamily: "sans-serif" }}>Rico</span>
          </div>
        </div>
        <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#666", fontFamily: "sans-serif" }}>MongoDB RAG + Gemini</span>
      </div>

      {/* Full screen chat */}
      <div style={{ flex: 1, overflow: "hidden", maxWidth: 800, width: "100%", margin: "0 auto", alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
        <ChatPanel />
      </div>
    </div>
  );
}