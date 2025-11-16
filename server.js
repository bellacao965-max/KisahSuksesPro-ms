import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const __dirnamePath = path.resolve();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static from public
app.use(express.static(path.join(__dirnamePath, "public")));

// Health
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Quotes
const QUOTES = [
  "Tetap berjuang — waktumu akan tiba.",
  "Tidak ada usaha yang sia-sia.",
  "Kamu jauh lebih kuat dari yang kamu pikirkan.",
  "Fokus hari ini menentukan masa depanmu.",
  "Langkah kecil hari ini adalah kemenangan besar esok."
];
app.get("/api/quote", (req, res) => {
  res.json({ quote: QUOTES[Math.floor(Math.random() * QUOTES.length)] });
});

// AI endpoint: prefer GROQ, fallback to OpenAI
app.post("/api/ai", async (req, res) => {
  const { prompt, model } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  const chosen = model || process.env.DEFAULT_MODEL || "llama3-70b-8192";

  // Try GROQ first if key exists
  if (process.env.GROQ_API_KEY) {
    try {
      const Groq = (await import('groq-sdk')).default;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const result = await groq.chat.completions.create({
        model: chosen,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 600
      });
      return res.json({ reply: result.choices?.[0]?.message?.content || "" });
    } catch (e) {
      console.warn("GROQ call failed, falling back to OpenAI HTTP:", e.message || e);
    }
  }

  // Fallback to OpenAI if OPENAI_API_KEY present
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: chosen.startsWith("gpt") ? chosen : "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600
        })
      });
      const data = await resp.json();
      return res.json({ reply: data?.choices?.[0]?.message?.content || "" });
    } catch (e) {
      console.error("OpenAI call failed:", e.message || e);
      return res.status(500).json({ error: "AI backend error", detail: String(e) });
    }
  }

  return res.status(503).json({ error: "No AI key configured. Set GROQ_API_KEY or OPENAI_API_KEY." });
});

// social helper
app.post("/api/social", (req, res) => {
  const { platform, text, url } = req.body || {};
  if (!platform) return res.status(400).json({ error: "Missing platform" });
  const t = encodeURIComponent(text || "");
  const u = encodeURIComponent(url || "");
  let share = "";
  switch ((platform+"").toLowerCase()) {
    case "facebook": share = `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`; break;
    case "twitter": share = `https://twitter.com/intent/tweet?text=${t}&url=${u}`; break;
    case "instagram": share = "https://www.instagram.com/"; break;
    case "tiktok": share = `https://www.tiktok.com/search?q=${t}`; break;
    default: share = url || "";
  }
  res.json({ shareUrl: share });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirnamePath, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
