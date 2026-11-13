// Render frame a frame: node render.mjs [saida.mp4] [--stills 1,5,10] [--from s --to s] [--fps 60]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const dir = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith("--") ? args[0] : path.join(dir, "out/video.mp4");
const stills = opt("--stills");
const timing = opt("--timing"); // ficheiro JSON com TIMING/CAPS (sincronização com a voz)

const browser = await chromium.launch({ args: ["--disable-gpu-vsync", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
if (timing) {
  const j = JSON.parse(fs.readFileSync(timing, "utf8"));
  await page.addInitScript((j) => { window.TIMING = j.TIMING; if (j.CAPS) window.CAPS = j.CAPS; }, j);
}
page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto("file://" + path.join(dir, "index.html"));
await page.evaluate(() => window.ready);
const fps = Number(opt("--fps", await page.evaluate(() => window.FPS)));
const dur = await page.evaluate(() => window.DURACAO);

if (stills) {
  fs.mkdirSync(path.join(dir, "out/stills"), { recursive: true });
  for (const s of stills.split(",").map(Number)) {
    await page.evaluate((t) => window.seek(t), s);
    await page.screenshot({ path: path.join(dir, `out/stills/t${String(s).padStart(5, "0")}.jpg`), type: "jpeg", quality: 85 });
  }
  await browser.close();
  process.exit(0);
}

const from = Number(opt("--from", 0)), to = Number(opt("--to", dur));
const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
fs.mkdirSync(path.dirname(out), { recursive: true });
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(fps), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const t0 = Date.now();
for (let f = f0; f < f1; f++) {
  await page.evaluate((t) => window.seek(t), f / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((f - f0) % 120 === 0) console.log(`frame ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("ok", out);
