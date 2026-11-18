"""Batida + efeitos do anúncio (sincronizados com os cortes de index.html). → out/musica.wav"""
import wave
import numpy as np

SR, DUR = 48000, 34.5
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)
t_ = lambda d: np.arange(int(d * SR)) / SR


def put(sig, at, g=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.41
    R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.41


def env(n, a, d, k=4.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * k / max(d, 1e-4))


def kick():
    t = t_(.4); f = 48 + 120 * np.exp(-t * 30)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .4) * 1.6)


def hat(d=.06):
    n = int(d * SR); x = rng.standard_normal(n); x = np.diff(x, prepend=0)
    return x / np.abs(x).max() * env(n, .001, d, 6)


def clap():
    n = int(.18 * SR); x = rng.standard_normal(n)
    return x / np.abs(x).max() * env(n, .003, .18, 5) * .8


def whoosh(d=.6):
    n = int(d * SR); x = np.cumsum(rng.standard_normal(n)); x -= np.convolve(x, np.ones(200) / 200, 'same')
    return x / np.abs(x).max() * (np.arange(n) / n) ** 2


def boom(d=1.8):
    t = t_(d); f = 32 + 40 * np.exp(-t * 6)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .005, d, 2.5) * 1.5)


def baixo(freq, d):
    t = t_(d)
    s = np.sign(np.sin(2 * np.pi * freq * t)) * .5 + np.sin(2 * np.pi * freq * t)
    return s * env(len(t), .01, d, 2.0) * .35


BPM = 124; b = 60 / BPM
notas = [55, 55, 65.4, 49]  # A, A, C, G
x = 2.8
k = 0
while x < 30.3:
    put(kick(), x, .55)
    put(hat(), x + b / 2, .14, .3)
    if k % 2 == 1: put(clap(), x, .22)
    if k % 4 == 0: put(baixo(notas[(k // 4) % 4], b * 4), x, .5)
    x += b; k += 1

for c in [2.8, 6.6, 11.9, 16.9, 20.7, 23.6, 27.45]:
    put(whoosh(.5), c - .5, .25)
for c in [12.1, 13.25, 14.4, 15.55]:
    put(hat(.12), c, .4)
for i in range(4):  # gancho: batidas nas palavras
    put(kick(), .05 + i * .38, .5)
put(boom(), 30.3, .8)
put(boom(1.2), 2.8, .5)

mx = np.stack([L, R], 1)
mx = np.tanh(mx / (np.abs(mx).max() + 1e-9) * 1.6) * .85
fade = np.ones(N); fn = int(1.2 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mx *= fade[:, None]
with wave.open("out/musica.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mx * 32767).astype("<i2").tobytes())
print("ok out/musica.wav")
