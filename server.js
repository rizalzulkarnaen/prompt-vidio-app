import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const {
  PORT = 3000,
  FAL_KEY,
  VIDEO_MODEL = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  MAX_SECONDS_PER_REQUEST = 10,
  DAILY_REQUEST_CAP = 20,
} = process.env;

if (!FAL_KEY) {
  console.error("❌ FAL_KEY belum diisi di .env");
  process.exit(1);
}

let dailyCount = 0;
let dailyReset = new Date().toDateString();
function checkBudget() {
  const today = new Date().toDateString();
  if (today !== dailyReset) { dailyCount = 0; dailyReset = today; }
  if (dailyCount >= Number(DAILY_REQUEST_CAP)) {
    throw new Error(`Batas harian ${DAILY_REQUEST_CAP} request tercapai. Coba lagi besok.`);
  }
  dailyCount++;
}

const FAL_BASE = "https://queue.fal.run";

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, aspect_ratio = "16:9", duration = 5 } = req.body;
    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ error: "Prompt terlalu pendek." });
    }
    const safeDuration = Math.min(Number(duration) || 5, Number(MAX_SECONDS_PER_REQUEST));
    checkBudget();

    const r = await fetch(`${FAL_BASE}/${VIDEO_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio,
        duration: String(safeDuration),
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });

    return res.json({
      request_id: data.request_id,
      status_url: data.status_url,
      response_url: data.response_url,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const { status_url, response_url } = req.query;
    if (!status_url || !response_url) {
      return res.status(400).json({ error: "status_url & response_url wajib diisi." });
    }

    if (!String(status_url).startsWith(FAL_BASE) || !String(response_url).startsWith(FAL_BASE)) {
      return res.status(400).json({ error: "URL tidak valid." });
    }

    const s = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
    const sData = await s.json();

    if (sData.status !== "COMPLETED") {
      return res.json({ status: sData.status });
    }

    const r = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
    const rData = await r.json();

    return res.json({
      status: "COMPLETED",
      video_url: rData?.video?.url || rData?.videos?.[0]?.url || null,
      raw: rData,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Jalan di http://localhost:${PORT}`);
});
