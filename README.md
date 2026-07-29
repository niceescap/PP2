# PaceParser2

Générateur moderne d'overlay vidéo de télémétrie sportive depuis fichiers FIT/GPX.
Export MP4/WebM avec fond vert chroma key pour CapCut.

## Développement

```bash
npm install
npm run dev -- --port 8001
```

Ouvrir http://localhost:8001

## Build production

```bash
npm run build
npm run serve    # sert le dossier dist sur le port 8080
```

## Termux (Android)

```bash
pkg install nodejs
npm install
npm run dev -- --port 8001 --host 0.0.0.0
```

## Workflow

1. Importer un fichier FIT
2. Les données s'affichent automatiquement en blocs personnalisables
3. Glisser les blocs sur le canvas · cliquer dans la liste pour éditer (taille, couleurs, position)
4. Choisir la plage temporelle d'export
5. Générer → le fichier se télécharge en quelques secondes

## Moteurs d'export

| Moteur | Format | Vitesse | Condition |
|---|---|---|---|
| **WebCodecs** | MP4 H.264 | ⚡ Quelques secondes | Chrome/Edge 94+, Firefox 130+, Safari 16.4+ |
| MediaRecorder | WebM VP9/VP8 | 🐢 Temps réel | Fallback universel, transparence alpha |

La durée de la vidéo est **toujours identique** à la plage temporelle source (1 frame = 1 seconde).
Le monteur cale le début dans CapCut — la synchro tient jusqu'à la fin.

## Format de sortie

- Fond : vert chroma key (#00ff66), noir, ou transparent (WebM uniquement)
- Résolutions : 1080p, 720p, vertical 9:16, carré 1:1
- Encodage : H.264 hardware-accelerated (WebCodecs) ou VP9/VP8 (MediaRecorder)
