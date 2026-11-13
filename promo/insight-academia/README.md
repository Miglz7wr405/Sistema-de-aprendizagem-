# Vídeo promocional — Insight Academia

Vídeo vertical (1080×1920, 60 fps, ~56 s) feito em código: `index.html` é a composição
(cada fotograma é calculado por `seek(t)`), `render.mjs` grava os fotogramas com o Chromium
e junta com o FFmpeg, `audio.py` gera o design de som.

```bash
node render.mjs --stills 3,10,22        # fotogramas de teste em out/stills
node render.mjs out/video_mudo.mp4      # vídeo completo (sem som)
python3 audio.py                        # out/sfx.wav
ffmpeg -i out/video_mudo.mp4 -i out/sfx.wav -c:v copy -c:a aac -b:a 192k -shortest out/insight-academia.mp4
```

Números, textos e tempos editáveis no topo do `<script>` em `index.html`
(`NUM_PT`, `NUM_MZ`, `TOTAL_AULAS`, `T`, `CAPS`). Para sincronizar com uma locução nova,
passa `--timing timing.json` ao render e o mesmo ficheiro ao `audio.py`.
