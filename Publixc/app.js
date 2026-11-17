const btn = document.getElementById("btn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const videoEl = document.getElementById("video");
const downloadEl = document.getElementById("download");
const historyEl = document.getElementById("history");

const history = [];

function setStatus(t) { statusEl.textContent = t; }

btn.addEventListener("click", async () => {
  const prompt = document.getElementById("prompt").value.trim();
  const aspect_ratio = document.getElementById("ratio").value;
  const duration = Number(document.getElementById("duration").value);

  if (prompt.length < 3) return setStatus("Prompt minimal 3 karakter.");

  btn.disabled = true;
  resultEl.classList.add("hidden");
  setStatus("⏳ Mengirim permintaan ke AI...");

  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspect_ratio, duration }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || data.error || "Gagal generate.");

    setStatus("🎞️ Sedang diproses AI... (bisa 1–3 menit)");
    const videoUrl = await poll(data);
    if (!videoUrl) throw new Error("Video tidak ditemukan di respons AI.");

    videoEl.src = videoUrl;
    downloadEl.href = videoUrl;
    resultEl.classList.remove("hidden");
    setStatus("✅ Selesai!");

    history.unshift({ prompt, videoUrl });
    renderHistory();
  } catch (e) {
    setStatus("❌ " + e.message);
  } finally {
    btn.disabled = false;
  }
});

async function poll({ status_url, response_url }) {
  const qs = new URLSearchParams({ status_url, response_url }).toString();
  for (let i = 0; i < 120; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    const r = await fetch(`/api/status?${qs}`);
    const d = await r.json();
    if (d.status === "COMPLETED" && d.video_url) return d.video_url;
    if (d.error) throw new Error(typeof d.error === "string" ? d.error : "Error AI");
    setStatus(`🎞️ Status: ${d.status || "..."}`);
  }
  throw new Error("Timeout menunggu video.");
}

function renderHistory() {
  historyEl.innerHTML = "";
  history.slice(0, 8).forEach((h) => {
    const el = document.createElement("div");
    el.className = "hist-item";
    el.textContent = "▶ " + h.prompt;
    el.onclick = () => {
      videoEl.src = h.videoUrl;
      downloadEl.href = h.videoUrl;
      resultEl.classList.remove("hidden");
    };
    historyEl.appendChild(el);
  });
}
