# Rapport de compréhension — PaceParser2

**Date :** 19 octobre 2026  
**Périmètre :** dépôt `/home/nicee/pp2/PP2` (branche `main`, commit `16ab0c5`)  
**Objet :** état des lieux de l'existant, sans modification fonctionnelle du code.

---

## 1. Synthèse

PaceParser2 est une application web autonome de génération d'overlays de télémétrie sportive à partir de fichiers FIT. Elle permet d'importer une activité, de visualiser les données sur un canvas, de personnaliser des blocs (position, taille, couleurs), de choisir une plage temporelle puis d'exporter une vidéo destinée au montage (fond vert chroma key pour CapCut).

Le build applicatif passe : `npm run build` réussit. En revanche, l'état du dépôt n'est pas sain sur le plan typage et le serveur de rendu alternatif n'est pas exécutable en l'état. Les fonctions décrites dans le README (GPX, export serveur, skins) ne sont pas toutes réellement disponibles. Aucun fichier FIT réel n'étant fourni, le comportement du parseur n'a pas pu être validé sur données de bout en bout.

**Verdict rapide**

- Application cliente FIT → blocs → export : architecture cohérente, build Vite opérationnel.
- Qualité statique : `npx tsc --noEmit` échoue (21 erreurs), alors que Vite ne fait pas de type-check.
- Serveur de rendu : import invalide et dépendances absentes ; ne démarre pas.
- GPX : annoncé et accepté dans le sélecteur de fichier, mais aucun parseur GPX n'existe.
- Skins : code présent mais mort, non importé par l'application ; doublons et erreurs de types.

---

## 2. Vue d'ensemble du dépôt

| Élément | Rôle |
|---|---|
| `index.html` | Interface mono-page : import, statistiques, timeline, canvas, éditeur de blocs, export |
| `src/main.ts` | Contrôleur principal : état, DOM, import, aperçu, drag & drop, export |
| `src/blocks.ts` | Modèle de blocs et rendu canvas de l'overlay |
| `src/fit/` | Parseur FIT binaire maison et types associés |
| `src/export/` | Deux moteurs d'export : WebCodecs/MP4 et MediaRecorder/WebM |
| `src/skins/` | Système de thèmes alternatif, non branché à l'application |
| `src/styles/main.css` | Styles de l'interface |
| `server/render-server.ts` | Serveur Express optionnel de rendu MP4 via node-canvas + ffmpeg |
| `vite.config.js` | Build Vite, cible ES2022/ESNext, port dev 5173 |
| `package.json` | Scripts dev/build/preview/serve/server |
| `requirements.txt` | Notes d'installation Termux ; aucune dépendance Python |
| `NOTE_WEBM_MOTOR.md` | Aide au diagnostic du moteur d'export dans le navigateur |

Historique récent : le projet a d'abord reposé sur des « skins » (`ISkin`), puis a été refactoré vers un système de blocs personnalisables (`OverlayConfig`). Les commits `5c5941b` et `3bb73fe` matérialisent ce basculement ; le dossier `src/skins` est un vestige de l'ancienne approche, repris partiellement par le serveur et par des tentatives ultérieures.

---

## 3. Architecture et flux de données

### 3.1 Flux nominal

1. L'utilisateur dépose ou sélectionne un fichier dans `#dropzone`.
2. `loadFile()` lit le fichier en `ArrayBuffer` et appelle `parseFIT()`.
3. Le parseur produit un `FitActivity` : liste de `FitPoint` + métadonnées (durée, distance, D+, moyennes/max, présence GPS/puissance/FC/cadence/altitude, bounds GPS).
4. `createDefaultConfig()` construit huit blocs : puissance, vitesse, FC, cadence, distance, D+, temps, trace GPS.
5. `drawOverlay()` rend le fond puis chaque bloc sur `#previewCanvas`.
6. L'utilisateur ajuste la plage d'export via deux curseurs, déplace les blocs au canvas ou édite leurs propriétés dans la liste.
7. `startExport()` découpe les points, choisit WebCodecs ou MediaRecorder, génère un blob et déclenche le téléchargement.

### 3.2 Modèle de données

`FitPoint` contient : `timestamp`, `elapsed`, `lat`, `lon`, `alt`, `hr`, `cad`, `speed`, `power`, `distance`, `dplus`, `pente`, `temp`.  
`FitActivity.meta` agrège les statistiques affichées. Les valeurs absentes sont représentées par `0` ou `null` selon le champ.

### 3.3 Rendu de l'overlay

`drawOverlay()` remplit le fond selon `bgMode` (`green`, `black`, `transparent`) puis délègue à `drawBlock()`. Chaque bloc possède `id`, `type`, `label`, géométrie (`x`, `y`, `w`, `h`), visibilité et style (`bgColor`, `textColor`, `accentColor`, `fontSize`, `labelSize`, `borderRadius`, `showLabel`, `unit`, `decimals`).

Le bloc `map` est spécifique : `drawMapMini()` projette les coordonnées GPS dans le rectangle du bloc, trace la trace complète en gris, la portion parcourue en couleur d'accent et le point courant. Il ne s'agit pas d'une carte géographique (pas de fond de plan, pas de tuiles).

---

## 4. Ce qui fonctionne réellement

- Import FIT binaire dans le navigateur, sans dépendance externe.
- Lecture des champs `record` usuels : position, altitude, FC, cadence, distance, vitesse, puissance, température.
- Calcul de la pente et du D+ cumulé à partir des positions/altitudes successives.
- Statistiques d'activité et timeline de prévisualisation.
- Édition des blocs : visibilité, libellé, géométrie, couleurs, taille de police.
- Déplacement des blocs à la souris sur le canvas (pas de redimensionnement à la souris malgré le drapeau `isResizing`).
- Export MP4 H.264 via WebCodecs avec `mp4-muxer`, à 30 fps, chaque point de données durant une seconde.
- Repli automatique vers WebM via MediaRecorder si WebCodecs échoue ou si le fond est transparent.
- Build de production Vite (`npm run build`) opérationnel.

---

## 5. Anomalies et écarts constatés

### 5.1 Bloquant — le serveur de rendu ne démarre pas

`server/render-server.ts:13` importe `resampleTo1Hz` depuis `../src/blocks.js`, mais cette fonction est définie et exportée dans `src/export/webcodecs-exporter.ts:39`. L'import est donc invalide.

De plus, les dépendances serveur ne sont pas installées dans l'environnement courant : `tsx`, `canvas`, `express` et `multer` sont absents de `node_modules`, ce qui rend les liens de `node_modules/.bin` cassés. Le lancement de `npm run server` n'a produit aucun démarrage du serveur et est resté bloqué, probablement dans l'attente réseau de `npx` ; le test a été interrompu par un délai de garde.

Même après correction de l'import, le serveur appelle `createDefaultConfig()` puis écrit des PNG dans `/tmp` et exécute `ffmpeg` via `execSync` avec un chemin de fichier interpolé sans échappement. Cela suppose `ffmpeg` installé sur la machine et pose une question de robustesse/sécurité si le service est exposé.

### 5.2 Bloquant à moyen terme — le typage est cassé

`npx tsc --noEmit` remonte 21 erreurs. Elles sont masquées par Vite, qui transpile sans vérification de types.

Erreurs principales :

- `src/main.ts:31-32` : `fitBuffer` et `fileName` utilisés dans l'état mais absents de l'interface `AppState`.
- `src/main.ts:275` : `dataset` accédé sur un `Element` non typé.
- `src/main.ts:508-509` : `state.activity` potentiellement `null` dans la closure d'export.
- `src/fit/parser.ts:192` : `prev.alt` potentiellement `null`.
- `src/export/webcodecs-exporter.ts:142` : `encoderError.message` inaccessible car TypeScript infère `never` (affectation dans un callback).
- `src/skins/*` : catégories en français (`épuré`, `énergique`, `moderne`, `professionnel`) incompatibles avec l'union anglaise de `ISkin.category`; propriétés inexistantes (`secondaryAngle`, `secondaryError`); `DEFAULT_CONFIG` manquant dans les variantes `.skin.ts`.

### 5.3 GPX annoncé mais non implémenté

Le README et `index.html:42` annoncent l'acceptation de `.gpx`/`.GPX`. Or `parseFIT()` est le seul parseur présent, et aucune référence à GPX/XML n'existe dans `src/`. Sélectionner un GPX conduit donc à une erreur de parsing ou à une activité vide. Le libellé de l'interface devrait être aligné sur la réalité, ou un parseur GPX doit être ajouté.

### 5.4 Le système de skins est du code mort

`src/skins/registry.ts` et les classes de skins ne sont importés nulle part dans `src/main.ts` ni dans `index.html`. Le bundle de production ne contient aucune référence aux skins. Le dossier conserve par ailleurs des doublons (`apple-minimal.ts` / `apple-minimal.skin.ts`, `neon-racing.ts` / `neon-racing.skin.ts`) avec des divergences de contenu et des coercitions `as any` pour contourner le typage.

Conclusion : l'interface actuelle repose exclusivement sur `OverlayConfig` et `blocks.ts`. `src/skins` est une piste inachevée, pas une fonctionnalité livrée.

### 5.5 Incohérences de durée et de résolution

- Le README affirme « 1 frame = 1 seconde ». C'est vrai pour MediaRecorder (`captureStream(1)`, une frame par seconde) et pour WebCodecs au niveau du contenu (30 frames identiques par point), mais les deux moteurs n'ont pas la même structure de fichier : MP4 à 30 fps, WebM à 1 fps. Le résultat visuel est équivalent, la nature du conteneur ne l'est pas.
- `resampleTo1Hz()` arrondit la durée au plus proche (`Math.round(t1 - t0)`), ce qui peut décaler la fin de la vidéo de jusqu'à 0,5 seconde par rapport à la plage source. Ce point mérite un test avec un FIT réel.
- `MediaRecorder` démarre l'enregistrement puis attend une seconde avant la première frame ; la première seconde peut être vide ou décalée selon le navigateur.
- Le redimensionnement de `state.config` n'est pas propagé aux blocs lors d'un changement de résolution d'export. Les blocs sont positionnés en pixels absolus dans un canvas 1920×1080 ; exporter en 720p ou en vertical conserve donc les coordonnées d'origine, avec risque de débordement ou de mauvaise composition.
- Le bouton de fond ne met pas à jour son libellé après changement : il affiche toujours « 🟩 Vert » alors que le toast indique le mode choisi.

### 5.6 Robustesse du parseur FIT

- L'en-tête FIT n'est pas validé (taille, signature `.FIT`, CRC). Un fichier quelconque peut produire un comportement inattendu plutôt qu'une erreur claire.
- Le champ `sport` est toujours forcé à `'cycling'` dans `buildActivity()` (`src/fit/parser.ts:270`), alors que `sportType` est déclaré et jamais renseigné.
- Les messages de définition avec champs développeur sont lus mais leurs champs ne sont pas exposés.
- Les types `string`, `float32`, `float64`, `sint64`, `uint64` ne sont pas décodés spécifiquement ; `readField()` retombe sur `data[offset]`.
- Le timestamp compressé est reconstruit avec un offset signé approximatif ; ce point est fragile et mérite une validation sur des fichiers réels.
- `totalDplus` additionne `Math.max(0, p.dplus)` pour chaque point (`src/fit/parser.ts:231`), alors que `p.dplus` est déjà un cumul. Le D+ affiché est donc fortement surestimé : il faudrait lire le cumul du dernier point ou additionner les incréments. C'est une anomalie fonctionnelle, pas seulement une redondance.
- Aucun fichier FIT d'exemple n'est présent dans le dépôt, donc aucun test de non-régression sur données réelles n'est possible en l'état.

### 5.7 Sécurité et exploitation

- `server/render-server.ts` active CORS `*`, accepte des uploads sans limite de taille explicite (Multer par défaut) et construit une commande shell par interpolation. Si le serveur est exposé, cela nécessite un durcissement.
- Les fichiers uploadés sont écrits dans `/tmp/pp2-uploads/`, les frames dans `/tmp/pp2-frames-*` et les sorties dans `/tmp/pp2-output-*`, avec un nettoyage différé de 5 secondes. Un crash laisse des artefacts.
- Le serveur n'est pas utilisé par l'application cliente : `startExport()` appelle directement les exporteurs navigateur. Le serveur est donc une voie parallèle, non intégrée à l'UI.

---

## 6. État de validation

| Vérification | Résultat |
|---|---|
| `npm run build` | OK — 12 modules, bundle JS ~58,6 ko |
| `npx tsc --noEmit` | Échec — 21 erreurs |
| `npm run server` | Ne démarre pas — import invalide + dépendances absentes |
| Présence de fichiers FIT/GPX de test | Aucun |
| Tests automatisés | Aucun fichier de test, aucun script `test` |
| Skins dans le bundle | Absents |

---

## 7. Recommandations priorisées

1. **Rétablir la chaîne de validation** : corriger les 21 erreurs TypeScript, puis ajouter `tsc --noEmit` avant `vite build` pour éviter les régressions silencieuses.
2. **Trancher sur le serveur** : soit corriger l'import de `resampleTo1Hz`, installer/vérifier `express`, `multer`, `canvas`, `tsx` et `ffmpeg`, soit retirer le script et le documenter comme non supporté.
3. **Aligner l'interface sur les formats réels** : retirer `.gpx` de l'input tant qu'aucun parseur GPX n'existe, ou implémenter un parseur GPX et l'exposer dans `src/fit/`.
4. **Décider du sort des skins** : les supprimer, ou les réintégrer proprement dans l'UI et le modèle de rendu. En l'état, ils complexifient le dépôt sans valeur fonctionnelle.
5. **Fiabiliser l'export** : tester avec plusieurs FIT réels les bornes de plage, le rendu en 720p/vertical, la première seconde WebM et les fichiers longs.
6. **Durcir le serveur** si conservé : validation de l'en-tête FIT, limite d'upload, `spawn` avec arguments plutôt qu'une commande shell, nettoyage garanti, gestion des erreurs ffmpeg.
7. **Ajouter des tests minimaux** : parseur FIT sur un fichier de référence, `resampleTo1Hz` sur des durées limites, calcul des statistiques, et un test de rendu de bloc.

---

## 8. Conclusion

L'existant est un prototype avancé et cohérent pour l'import FIT et la génération d'overlays personnalisables dans le navigateur. La valeur principale est déjà là : un pipeline complet FIT → canvas → MP4/WebM. Les fragilités ne sont pas dans l'idée ni dans l'UI, mais dans la discipline de validation (typage, tests) et dans des fonctionnalités annoncées ou amorcées qui ne sont pas raccordées (GPX, skins, serveur). Un travail de consolidation ciblé, sans réécriture, suffirait à rendre le dépôt nettement plus fiable.
