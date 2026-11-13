"""Design de som do vídeo (sincronizado com os tempos das cenas em index.html).
Uso: python3 audio.py [timing.json] -> out/sfx.wav  (48 kHz, estéreo)
"""
import json, sys, os, wave
import numpy as np

SR = 48000
DUR = 61.0
T = dict(hook=0, logo=5.2, home=8.6, sec=14.5, play=19.5, car=27.0, num=42.5, vs=48.5, cta=52.5)
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    T.update(json.load(open(sys.argv[1]))["TIMING"])
N = int(SR * DUR)
L = np.zeros(N); Rr = np.zeros(N)
rng = np.random.default_rng(5)


def put(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.41
    Rr[i:i + len(sig)] += sig * gain * r * 1.41


def t_(d): return np.arange(int(d * SR)) / SR


def lp_fast(x, fc):
    # passa-baixo por FFT (suave)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def bp_fast(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / np.sqrt(1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def env(n, a, d, shape=3.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * shape / max(d, 1e-4))
    return e


def boom(d=2.5, f0=55, f1=32):
    t = t_(d); f = f1 + (f0 - f1) * np.exp(-t * 5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env(len(t), .005, d, 2.2)
    click = bp_fast(rng.standard_normal(len(t)), 800, 5000) * env(len(t), .001, .03, 6) * .4
    return np.tanh((s + click) * 1.6) * .9


def whoosh(d=1.2, rev=False, lo=300, hi=6000):
    n = int(d * SR); x = rng.standard_normal(n)
    x = bp_fast(x, lo, hi)
    t = np.arange(n) / n
    e = np.sin(np.pi * t) ** 2 if not rev else t ** 3
    return x / (np.abs(x).max() + 1e-9) * e


def riser(d=2.0, f0=200, f1=1800):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .25 + whoosh(d, rev=True, lo=1500, hi=12000) * .5
    return s * (t / d) ** 2


def tick(f=2200, d=.06):
    t = t_(d); return np.sin(2 * np.pi * f * t) * env(len(t), .001, d, 5)


def pop(f=900, d=.18):
    t = t_(d); ff = f * (1 + 1.2 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * env(len(t), .002, d, 4)


def bell(freqs, d=4.0):
    t = t_(d); s = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for h, a in ((1, 1), (2.01, .35), (3.02, .15)):
            s += np.sin(2 * np.pi * f * h * t + i) * a * np.exp(-t * (1.2 + h * .6))
    return s / len(freqs) * env(len(t), .01, d, 1.2)


def kick(d=.45):
    t = t_(d); f = 45 + 110 * np.exp(-t * 28)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, d, 4) * 1.4)


def hat(d=.07):
    n = int(d * SR); x = bp_fast(rng.standard_normal(n), 6000, 15000)
    return x / (np.abs(x).max() + 1e-9) * env(n, .001, d, 6)


def pad(freqs, d, lpf=1400):
    t = t_(d); s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.12, 0, 0.11):
            ff = f * (2 ** (det / 12))
            s += 2 * ((t * ff) % 1) - 1  # saw
    s = lp_fast(s, lpf) / (len(freqs) * 3)
    a = np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.2)
    return s * a


def heartbeat():
    return boom(.6, 70, 40) * .9


# ── GANCHO: batimentos em câmara lenta + drone ──
for i, at in enumerate([0.35, 1.45, 2.4, 3.2, 3.9, 4.45, 4.85]):
    put(heartbeat(), at, .55 + i * .04)
    put(heartbeat(), at + .22, .3 + i * .03)
put(pad([55, 82.4, 110], T["logo"] + .3, 600), 0, .5)
for i in range(9):
    put(whoosh(1.6, lo=200, hi=2500), 0.25 + i * .18, .12, pan=(i % 3 - 1) * .6)
put(riser(2.4, 120, 1500), T["logo"] - 2.4, .45)
put(whoosh(.9, rev=True, lo=500, hi=14000), T["logo"] - .9, .5)

# ── LOGO: impacto + brilho ──
put(boom(3.2), T["logo"], 1.0)
put(bell([523.25, 659.25, 783.99, 1046.5], 5), T["logo"] + .05, .38)
put(whoosh(2.2, lo=2000, hi=14000), T["logo"] + .1, .18, pan=.4)

# ── CAMA MUSICAL (home → cta) ──
prog = [[110, 164.8, 220, 261.6], [87.3, 130.8, 174.6, 220], [130.8, 196, 261.6, 329.6], [98, 146.8, 196, 246.9]]
bar = 60 / 96 * 4
t0 = T["home"] - .4
i = 0
while t0 < T["cta"] + 8.4:
    put(pad(prog[i % 4], bar + 1.2, 1200 if t0 < T["car"] else 2200), t0, .32)
    t0 += bar; i += 1
beat = 60 / 96
b = T["home"]
n = 0
while b < T["cta"] + 6:
    if not (T["vs"] - .05 < b < T["vs"] + 2.0):  # quebra antes do "tu tens todos"
        put(kick(), b, .42 if b < T["car"] else .55)
        if b >= T["car"]:
            put(hat(), b + beat / 2, .12, pan=.3)
            if n % 2: put(hat(.12), b, .07, pan=-.3)
    b += beat; n += 1

# ── transições ──
for c in ("home", "sec", "car", "num", "cta"):
    put(whoosh(.8, rev=True, lo=400, hi=12000), T[c] - .8, .35)
    put(boom(1.6, 60, 36), T[c], .55)
for i in range(5):
    put(whoosh(.9, lo=500, hi=7000), T["sec"] + .55 + i * .12, .16, pan=(i - 2) * .35)

# ── PLAY ──
put(pop(1400, .12), T["play"] + 1.5, .5)
put(pop(1100, .12), T["play"] + 2.28, .55)
put(whoosh(1.2, lo=200, hi=9000), T["play"] + 2.4, .4)
put(boom(2.0, 48, 30), T["play"] + 2.55, .5)
# "tape stop" ao sair da aula
ts = t_(.9); fts = 220 * np.exp(-ts * 3)
put(np.sin(2 * np.pi * np.cumsum(fts) / SR) * env(len(ts), .01, .9, 1.5) * .5, T["car"] - 1.45, .5)
put(whoosh(1.3, lo=300, hi=8000), T["car"] - 1.2, .4)

# ── CARROSSEL ──
F0 = T["car"] + .6
for i in range(1, 5):
    put(whoosh(.7, lo=800, hi=9000), F0 + i * 3.0 - .55, .22, pan=.5 - (i % 2))
    put(tick(1800 + i * 90, .08), F0 + i * 3.0 - .05, .3)

# ── NÚMEROS ──
put(riser(1.2, 300, 2400), T["num"] + .3, .35)
put(bell([880, 1318.5], 2.2), T["num"] + 1.5, .35)
for i, at in enumerate([1.8, 2.6, 3.2, 3.8, 4.6]):
    put(pop(700 + i * 120), T["num"] + at, .35, pan=(-1) ** i * .4)

# ── CONTRASTE ──
put(boom(2.4, 40, 28), T["vs"], .7)
put(bp_fast(rng.standard_normal(int(.35 * SR)), 1500, 7000) * env(int(.35 * SR), .01, .35, 3) * .35, T["vs"] + 1.2, .6)
for i in range(12):
    put(tick(1200 + i * 110, .1), T["vs"] + 1.9 + i * .05, .18, pan=(i % 3 - 1) * .5)
put(boom(2.6), T["vs"] + 2.1, .7)

# ── CTA ──
for i in range(12):
    put(tick(3200 + rng.integers(0, 600), .03), T["cta"] + 1.6 + i * (1.1 / 12), .25)
put(whoosh(.5, lo=1500, hi=12000), T["cta"] + 2.9, .4)
put(pop(1500, .1), T["cta"] + 3.05, .5)
put(pop(1900, .08), T["cta"] + 3.7, .35)
put(whoosh(.8, lo=400, hi=8000), T["cta"] + 3.5, .3, pan=-.5)
put(whoosh(.8, lo=400, hi=8000), T["cta"] + 3.8, .3, pan=.5)
put(boom(3.5, 50, 30), T["cta"] + 6.2, .7)
put(bell([440, 554.37, 659.25, 880], 6), T["cta"] + 6.2, .45)
put(pad([110, 164.8, 220, 277.2], 3.2, 1800), T["cta"] + 5.0, .4)

# ── reverb simples (IR de ruído decrescente) ──
def reverb(x, d=2.2, mix=.22):
    n = int(d * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir = lp_fast(ir, 5000); ir /= np.abs(ir).sum() ** .5 * 14
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x + y * mix
L = reverb(L); Rr = reverb(Rr)

mx = np.stack([L, Rr], 1)
# fade final + normalização com limitador suave
fade = np.ones(N); fn = int(1.2 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mx *= fade[:, None]
mx = np.tanh(mx / (np.abs(mx).max() + 1e-9) * 1.8) * .89
os.makedirs("out", exist_ok=True)
with wave.open("out/sfx.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mx * 32767).astype("<i2").tobytes())
print("ok out/sfx.wav", DUR, "s")
