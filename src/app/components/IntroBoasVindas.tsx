import { useEffect, useRef } from "react";

import { primeiroNome } from "@/lib/utils";

/*
 * Intro de entrada ao estilo "TV CRT com falhas", em versão clara (cores Insight).
 * Desenhada em canvas a 24 fps (o salto entre fotogramas faz parte do efeito);
 * o som é gerado com Web Audio e começa logo que o navegador o permite.
 */

const FPS = 24;
const NAVY = "#0f1e37";
const AZUL = "#0033ff";
const VERMELHO = "#ff2d55";
const CIANO = "#00b7ff";

type Linha = { texto: string; peso: number; tam: number; espaco: number; cor: string };
type Cena = { de: number; ate: number; linhas: Linha[]; logo?: boolean };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function construirCenas(nome: string, soSaudacao: boolean): Cena[] {
  const cenas: Cena[] = [];
  let t = 0;
  if (!soSaudacao) {
    cenas.push({ de: 0, ate: 2.7, linhas: [{ texto: "BEM-VINDO", peso: 700, tam: 1, espaco: 0.06, cor: NAVY }] });
    cenas.push({
      de: 2.7,
      ate: 5.0,
      logo: true,
      linhas: [
        { texto: "INSIGHT", peso: 700, tam: 1, espaco: 0.04, cor: NAVY },
        { texto: "ACADEMIA", peso: 600, tam: 0.3, espaco: 0.55, cor: "#55627a" },
      ],
    });
    t = 5.0;
  }
  if (nome) {
    cenas.push({
      de: t,
      ate: t + 2.3,
      linhas: [
        { texto: "SEJA BEM-VINDO,", peso: 600, tam: 0.34, espaco: 0.3, cor: "#55627a" },
        { texto: nome.toUpperCase(), peso: 700, tam: 1, espaco: 0.04, cor: AZUL },
      ],
    });
  }
  return cenas;
}

/** Desenha o bloco de texto (e o logo) num canvas à parte, numa só cor. */
function blocoTexto(cena: Cena, largura: number, cor: string | null) {
  const base = Math.min(largura * 0.105, 92);
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const medidas = cena.linhas.map((l) => {
    g.font = `${l.peso} ${base * l.tam}px "Space Grotesk", sans-serif`;
    const larg = [...l.texto].reduce((s, ch) => s + g.measureText(ch).width, 0) + l.espaco * base * l.tam * (l.texto.length - 1);
    return { l, larg, alt: base * l.tam };
  });
  const maxL = Math.max(...medidas.map((m) => m.larg));
  const escala = maxL > largura * 0.86 ? (largura * 0.86) / maxL : 1;
  const logoAlt = cena.logo ? base * 0.75 * escala : 0;
  const gap = base * 0.22 * escala;
  const W = Math.ceil(maxL * escala + 40);
  const H = Math.ceil(logoAlt + (cena.logo ? gap : 0) + medidas.reduce((s, m) => s + m.alt * escala * 1.05, 0) + gap * (medidas.length - 1) + 40);
  c.width = W;
  c.height = H;
  let y = 20;
  if (cena.logo) {
    const r = logoAlt / 2, cx = W / 2, cy = y + r;
    g.strokeStyle = cor ?? AZUL;
    g.lineWidth = logoAlt * 0.13;
    g.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      g.beginPath();
      g.moveTo(cx - Math.cos(a) * r * 0.78, cy - Math.sin(a) * r * 0.78);
      g.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      g.stroke();
    }
    y += logoAlt + gap;
  }
  for (const { l, larg, alt } of medidas) {
    const tam = alt * escala;
    g.font = `${l.peso} ${tam}px "Space Grotesk", sans-serif`;
    g.fillStyle = cor ?? l.cor;
    g.textBaseline = "top";
    let x = (W - larg * escala) / 2;
    for (const ch of l.texto) {
      g.fillText(ch, x, y);
      x += g.measureText(ch).width + l.espaco * tam;
    }
    y += tam * 1.05 + gap;
  }
  return c;
}

/* ── som (Web Audio) ── */
function criarSom() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const mestre = ac.createGain();
  mestre.gain.value = 0.55;
  mestre.connect(ac.destination);
  const ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  function estatica(dur: number, ganho: number, f = 3000) {
    const s = ac.createBufferSource(); s.buffer = ruido;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 0.7;
    const gn = ac.createGain(); const t = ac.currentTime;
    gn.gain.setValueAtTime(ganho, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(bp).connect(gn).connect(mestre); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function bip(f: number, dur: number, ganho: number, tipo: OscillatorType = "square") {
    const o = ac.createOscillator(); o.type = tipo; o.frequency.value = f;
    const gn = ac.createGain(); const t = ac.currentTime;
    gn.gain.setValueAtTime(ganho, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(mestre); o.start(t); o.stop(t + dur + 0.02);
  }
  function batida() {
    const o = ac.createOscillator(); o.type = "sine"; const t = ac.currentTime;
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.9, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(gn).connect(mestre); o.start(t); o.stop(t + 0.65);
  }
  const tocar = (tipo: string) => {
    if (ac.state !== "running") return;
    if (tipo === "liga") { batida(); estatica(0.5, 0.35, 1800); }
    else if (tipo === "canal") estatica(0.09, 0.3, 2000 + Math.random() * 4000);
    else if (tipo === "falha") { estatica(0.12, 0.35, 5000); bip(180 + Math.random() * 900, 0.05, 0.12); bip(60 + Math.random() * 80, 0.08, 0.15, "sawtooth"); }
    else if (tipo === "corte") { estatica(0.25, 0.45, 1200); batida(); }
  };
  return { ac, tocar };
}

export function IntroBoasVindas({
  nome,
  soSaudacao = false,
  onFim,
}: {
  nome?: string | null;
  soSaudacao?: boolean;
  onFim: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nomeRef = useRef(nome ? primeiroNome(nome) : "");
  nomeRef.current = nome ? primeiroNome(nome) : "";
  const fimRef = useRef(onFim);
  fimRef.current = onFim;
  const saltarRef = useRef(false);

  useEffect(() => {
    const cv = canvasRef.current!;
    const g = cv.getContext("2d")!;
    const som = criarSom();
    const desbloquear = () => som?.ac.resume().catch(() => {});
    window.addEventListener("pointerdown", desbloquear, { once: true });
    som?.ac.resume().catch(() => {});

    let W = 0, H = 0, dpr = 1;
    const tamanho = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
    };
    tamanho();
    window.addEventListener("resize", tamanho);

    const cache = new Map<string, HTMLCanvasElement>();
    const bloco = (cena: Cena, cor: string | null) => {
      const k = cena.linhas.map((l) => l.texto).join("|") + (cor ?? "") + W;
      let c = cache.get(k);
      if (!c) { c = blocoTexto(cena, W, cor); cache.set(k, c); }
      return c;
    };

    const eventosFeitos = new Set<string>();
    const evento = (id: string, tipo: string) => {
      if (eventosFeitos.has(id)) return;
      eventosFeitos.add(id);
      som?.tocar(tipo);
    };

    let raf = 0, t0 = 0, fimEm = -1, ultimoF = -1;
    const fontes = document.fonts?.load('700 40px "Space Grotesk"').catch(() => {}) ?? Promise.resolve();

    const desenhar = (agora: number) => {
      raf = requestAnimationFrame(desenhar);
      if (!t0) t0 = agora;
      const t = (agora - t0) / 1000;
      const f = Math.floor(t * FPS);
      if (f === ultimoF) return; // 24 fps "aos solavancos", como na referência
      ultimoF = f;

      const cenas = construirCenas(nomeRef.current, soSaudacao);
      const total = cenas[cenas.length - 1]?.ate ?? 0.5;
      if (saltarRef.current && fimEm < 0) fimEm = t;
      if (t >= total && fimEm < 0) fimEm = t;

      const R = rng(f * 7919 + 17);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#fbfcff";
      g.fillRect(0, 0, W, H);

      const ini = cenas[0]?.de ?? 0;
      const lt = t - ini;
      const cena = cenas.find((c) => t >= c.de && t < c.ate) ?? cenas[cenas.length - 1];

      // ── 1. "canais" CRT a ligar (início) ──
      const fasesCRT = soSaudacao ? 0.45 : 1.5;
      if (lt < fasesCRT) {
        const tipos = ["curvo", "curvo", "texto", "azul", "clarao", "clarao", "painel", "painel", "texto", "curvo", "texto", "clarao"];
        const tipo = tipos[Math.floor(lt * 8) % tipos.length];
        evento(`canal${Math.floor(lt * 8)}`, Math.floor(lt * 8) === 0 ? "liga" : "canal");
        crt(g, tipo, W, H, R, f);
      }

      // ── 2. ruído digital (tracinhos) ──
      ruidoDigital(g, W, H, rng(Math.floor(f / 3) * 131 + 7));

      // ── 3. faixas de riscas curvas e barras de luz ──
      const ciclo = lt % 1.3;
      if (lt > fasesCRT && ciclo < 0.42) faixaMoire(g, W, H, H * (0.3 + 0.4 * ((Math.floor(lt / 1.3) * 0.61) % 1)) + ciclo * H * 0.25, H * (0.14 + 0.08 * R()));
      if (lt > fasesCRT && R() < 0.1) barraLuz(g, W, H, R);

      // ── 4. texto com falhas ──
      if (cena) {
        const rel = t - cena.de;
        const rajadas = [[0, 0.32], [0.62, 0.74], [1.15, 1.3], [1.7, 1.78]];
        let forca = rajadas.some(([a, b]) => rel >= a && rel < b) ? 1 : 0;
        if (!forca && R() < 0.06) forca = 0.5;
        if (lt < fasesCRT && R() < 0.35) forca = 1;
        if (fimEm >= 0) forca = 1;
        rajadas.forEach(([a], i) => { if (rel >= a) evento(`f${cena.de}-${i}`, i === 0 && cena.de > 0 ? "corte" : "falha"); });

        const base = bloco(cena, null);
        const x = (W - base.width) / 2, y = (H - base.height) / 2;
        if (!forca) {
          g.drawImage(base, x, y);
        } else {
          const vermelho = bloco(cena, VERMELHO), ciano = bloco(cena, CIANO);
          const amp = W * 0.012 * forca;
          const off = (3 + R() * 7) * forca;
          const fase = R() * 10;
          const forte = R() < 0.5;
          g.globalCompositeOperation = "multiply";
          for (let yy = 0; yy < base.height; yy += 3) {
            const dx = Math.sin(yy * 0.09 + fase) * amp * (forte ? 2.4 : 1) + (R() < 0.04 ? (R() - 0.5) * W * 0.12 : 0);
            g.globalAlpha = 0.85;
            g.drawImage(vermelho, 0, yy, base.width, 3, x + dx + off, y + yy, base.width, 3);
            g.drawImage(ciano, 0, yy, base.width, 3, x + dx - off, y + yy, base.width, 3);
            g.globalAlpha = 1;
            g.drawImage(base, 0, yy, base.width, 3, x + dx, y + yy, base.width, 3);
          }
          g.globalCompositeOperation = "source-over";
          // linha tracejada por baixo (como na referência)
          if (R() < 0.5) {
            g.fillStyle = "rgba(15,30,55,.35)";
            for (let k = 0; k < W; k += 8) g.fillRect(k, y + base.height * (0.55 + R() * 0.3), 2, 10);
          }
        }
      }

      // ── ecrã: linhas de varrimento + vinheta suave ──
      g.fillStyle = "rgba(15,30,55,.035)";
      for (let yy = (f % 2); yy < H; yy += 3) g.fillRect(0, yy, W, 1);
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(230,236,255,0)");
      vg.addColorStop(1, "rgba(180,198,240,.45)");
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);

      // ── 5. saída: clarão branco ──
      if (fimEm >= 0) {
        const p = Math.min(1, (t - fimEm) / 0.45);
        g.globalAlpha = p;
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        if (p >= 1) {
          cancelAnimationFrame(raf);
          fimRef.current();
        }
      }
    };
    fontes.then(() => { raf = requestAnimationFrame(desenhar); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", tamanho);
      window.removeEventListener("pointerdown", desbloquear);
      som?.ac.close().catch(() => {});
    };
  }, [soSaudacao]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#fbfcff]" role="presentation">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <button
        type="button"
        className="absolute bottom-6 right-6 rounded-full px-3 py-1 text-xs font-medium text-text-low hover:text-text-mid"
        onClick={() => { saltarRef.current = true; }}
      >
        Saltar
      </button>
    </div>
  );
}

/* ── camadas visuais ── */

function crt(g: CanvasRenderingContext2D, tipo: string, W: number, H: number, R: () => number, f: number) {
  if (tipo === "texto") return;
  const vinheta = (cor1: string, cor2: string, cx = W / 2, cy = H / 2) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
    gr.addColorStop(0, cor1);
    gr.addColorStop(1, cor2);
    g.fillStyle = gr;
  };
  if (tipo === "curvo") {
    // ecrã curvo com anéis concêntricos (padrão ondulado)
    vinheta("#eef3fc", "#b9c7e4", W * 0.7, H * 0.5);
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(40,70,140,.16)";
    g.lineWidth = 1;
    const cx = W * (0.9 + (f % 3) * 0.05), cy = H * 0.5;
    for (let r = 4; r < Math.max(W, H) * 1.4; r += 3.2) {
      g.beginPath(); g.ellipse(cx, cy, r, r * 1.1, 0, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,.55)";
    g.fillRect(W * (0.55 + R() * 0.2), H * (0.62 + R() * 0.1), W * 0.3, H * 0.1);
  } else if (tipo === "azul") {
    g.fillStyle = "#dfe8ff"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#4d7bff"; g.fillRect(0, H * 0.18, W * 0.88, H * 0.34);
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 1.2;
    for (let x = 0; x < W * 0.88; x += 4) {
      g.beginPath(); g.moveTo(x, H * 0.18); g.quadraticCurveTo(x + (x - W * 0.44) * 0.05, H * 0.35, x, H * 0.52); g.stroke();
    }
  } else if (tipo === "clarao") {
    vinheta("#ffffff", "#a8c4ff");
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(160,235,255,.55)";
    g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.62, H * 0.3, 0, 0, Math.PI * 2); g.fill();
  } else if (tipo === "painel") {
    g.fillStyle = "#e8eeff"; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(${40 + R() * 60},${80 + R() * 80},${200 + R() * 55},${0.25 + R() * 0.35})`;
      g.fillRect(R() * W, R() * H, W * (0.1 + R() * 0.4), H * (0.04 + R() * 0.15));
    }
    g.strokeStyle = "rgba(0,51,255,.18)";
    for (let x = W * 0.1; x < W; x += 3.5) { g.beginPath(); g.moveTo(x, H * 0.25); g.lineTo(x, H * 0.75); g.stroke(); }
  }
}

function ruidoDigital(g: CanvasRenderingContext2D, W: number, H: number, R: () => number) {
  g.fillStyle = "rgba(60,80,120,.16)";
  for (let k = 0; k < 340; k++) {
    const w = 2 + R() * 18;
    g.fillRect(R() * W, R() * H, w, R() < 0.8 ? 1 : 2);
  }
  // blocos de "dados" corrompidos
  g.fillStyle = "rgba(0,51,255,.07)";
  for (let k = 0; k < 6; k++) g.fillRect(R() * W, R() * H, 20 + R() * 90, 2 + R() * 6);
}

function faixaMoire(g: CanvasRenderingContext2D, W: number, H: number, cy: number, alt: number) {
  g.save();
  g.strokeStyle = "rgba(0,51,255,.22)";
  g.lineWidth = 1;
  for (let x = -20; x < W + 20; x += 3) {
    const curva = ((x - W / 2) / (W / 2)) ** 2 * alt * 0.18;
    g.beginPath();
    g.moveTo(x, cy - alt / 2 + curva);
    g.lineTo(x + (x - W / 2) * 0.03, cy + alt / 2 - curva);
    g.stroke();
  }
  g.restore();
}

function barraLuz(g: CanvasRenderingContext2D, W: number, H: number, R: () => number) {
  const y = H * (0.2 + R() * 0.6), h = H * (0.03 + R() * 0.05);
  const gr = g.createLinearGradient(0, y - h, 0, y + h);
  const cor = R() < 0.5 ? "120,200,255" : "160,140,255";
  gr.addColorStop(0, `rgba(${cor},0)`);
  gr.addColorStop(0.5, `rgba(${cor},.55)`);
  gr.addColorStop(1, `rgba(${cor},0)`);
  g.fillStyle = gr;
  g.fillRect(0, y - h, W, h * 2);
}
