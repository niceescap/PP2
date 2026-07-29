# PaceParser2

Générateur moderne d'overlay vidéo de télémétrie sportive depuis fichiers FIT/GPX.
Export WebM avec fond vert chroma key pour CapCut.

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
2. Les données s'affichent automatiquement
3. Personnaliser les blocs (position, taille, couleurs) en cliquant dessus dans la liste ou en les glissant sur le canvas
4. Choisir la plage temporelle d'export
5. Générer → le fichier WebM se télécharge avec la durée exacte de la plage

## Export

- Format : WebM VP9 (ou VP8 selon le navigateur)
- Fond : vert chroma key (#00ff66), transparent, ou noir
- Durée : identique à la plage temporelle source (1 frame = 1 seconde)
- Résolution : 1080p, 720p, vertical, carré
