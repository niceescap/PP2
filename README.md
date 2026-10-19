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
npm run build      # tsc --noEmit puis vite build
npm run serve      # sert le dossier dist sur le port 8080
```

## Tests

```bash
npm test           # 43 tests : parseur FIT, GPX, timeline, blocs, thèmes
npm run typecheck  # vérification de types seule
```

La suite ne dépend d'aucun framework externe : elle utilise un harnais
minimal dans `tests/harness.ts` et un mini-parseur XML (`tests/xml-parser.ts`)
pour tester le parseur GPX hors navigateur.

## Termux (Android)

```bash
pkg install nodejs
npm install
npm run dev -- --port 8001 --host 0.0.0.0
```

## Workflow

1. Importer un fichier FIT ou GPX
2. Les données s'affichent automatiquement en blocs personnalisables
3. Appliquer un thème (Standard, Cinématique, Glass, Neon, Minimal, Dashboard)
4. Glisser les blocs sur le canvas · cliquer dans la liste pour éditer (taille, couleurs, position)
5. Choisir la plage temporelle d'export
6. Générer → le fichier se télécharge en quelques secondes

## Formats d'import

| Format | Contenu lu |
|---|---|
| **FIT** | Position, altitude, FC, cadence, distance, vitesse, puissance, température, sport |
| **GPX** | Trace (`trkpt`), route (`rtept`), waypoints (`wpt`), altitude, extensions `gpxtpx:hr` / `gpxtpx:cad` |

Le parseur FIT valide l'en-tête (signature `.FIT`, version de protocole, taille
des données) et rejette un fichier invalide avec un message explicite.

## Moteurs d'export

| Moteur | Format | Vitesse | Condition |
|---|---|---|---|
| **WebCodecs** | MP4 H.264 | ⚡ Quelques secondes | Chrome/Edge 94+, Firefox 130+, Safari 16.4+ |
| MediaRecorder | WebM VP9/VP8 | 🐢 Temps réel | Fallback universel, transparence alpha |

La durée de la vidéo est **toujours identique** à la plage temporelle source
(1 frame = 1 seconde, pts 0, 1, 2… sans trou).
Le monteur cale le début dans CapCut — la synchro tient jusqu'à la fin.

Les blocs sont positionnés en pixels pour la résolution de prévisualisation
(1920×1080) et **mis à l'échelle automatiquement** à la résolution d'export :
720p, vertical ou carré ne produisent jamais de débordement.

## Format de sortie

- Fond : vert chroma key (#00ff66), noir, ou transparent (WebM uniquement)
- Résolutions : 1080p, 720p, vertical 9:16, carré 1:1
- Encodage : H.264 hardware-accelerated (WebCodecs) ou VP9/VP8 (MediaRecorder)

## Serveur de rendu (optionnel)

Rendu MP4 côté serveur via node-canvas + ffmpeg. Le serveur n'est pas
raccordé à l'interface : l'export du navigateur reste le chemin principal.

```bash
npm install          # requiert express, multer, canvas, tsx
npm run server       # POST http://localhost:3000/export
```

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `ALLOWED_ORIGIN` | *(vide)* | Origine CORS autorisée. Sans valeur, seules les requêtes `localhost` sont acceptées |

Le serveur applique une limite d'upload (32 Mo), un plafond de durée de
plage (4 h), lance `ffmpeg` via `spawn` sans shell, et nettoie ses fichiers
temporaires sur tous les chemins de sortie.
