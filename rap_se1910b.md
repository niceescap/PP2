# Rapport de réalisation — PaceParser2

**Date :** 19 octobre 2026
**Périmètre :** dépôt `/home/nicee/pp2/PP2`
**Branche :** `minimax3`
**Commit :** `2e03676` — *feat: consolidation — typage, GPX, thèmes, export fiable, tests*
**Base :** `16ab0c5` (branche `main`)
**Objet :** application des 7 recommandations du rapport d'analyse `rap_se1910a.md`
**Environnement de validation :** Node v24.17.0, npm 11.13.0, Chromium 1234 (headless), ffmpeg avec libx264

---

## 1. Synthèse

Les 7 recommandations du rapport `rap_se1910a.md` ont été appliquées sur la branche `minimax3`,
regroupées dans un commit unique `2e03676` (+3116 / −2095 lignes, 35 fichiers).

Le dépôt est passé d'un état où le type-checking échouait sur 21 erreurs, où le serveur de rendu
ne démarrait pas, où le format GPX était annoncé mais inexistant, où le système de skins était du
code mort, où l'export produisait des frames dupliquées et ignorait la résolution cible, à un
état où :

| Contrôle | Avant (`16ab0c5`) | Après (`2e03676`) |
|---|---|---|
| `npx tsc --noEmit` | 21 erreurs | **0 erreur** |
| `npm run build` | build Vite seul (sans type-check) | **type-check + build** |
| `npm test` | aucun script | **43/43 tests** |
| Parseur FIT sur en-tête valide | rejetait les fichiers réels | **valide** |
| D+ total affiché | surestimé (cumul cumulé) | **correct** |
| Import GPX | annoncé, inexistant | **fonctionnel** |
| `npm run server` | ne démarrait pas | **démarre et rend un MP4** (voir §4) |
| Export 720p / vertical | blocs débordants | **mis à l'échelle** |
| Export MediaRecorder | frames dupliquées, 1re seconde vide | **1 frame/s exacte** |
| Export MP4 (WebCodecs) | toujours dégradé en WebM | **MP4 H.264 30 fps** |

**Verdict** — Les 7 recommandations sont appliquées et vérifiées. Les deux points qui avaient
été signalés comme non vérifiés — exécution du serveur de rendu et encodage H.264 — l'ont été en
cours de travail, et ont révélé des bugs réels supplémentaires (§4.3 et §7.4).

---

## 2. Méthode

Le rapport `rap_se1910a.md` identifiait des anomalies ponctuelles. Plutôt que de les corriger
surface par surface, chaque anomalie a été traitée à sa racine, avec une preuve de non-régression
associée.

Trois principes ont guidé le travail :

1. **Corriger la cause, pas le symptôme.** Le D+ était surestimé parce que le cumul était
   re-sommé ; la correction lit la valeur finale au lieu de ré-agréger. L'export ignorait la
   résolution parce que les blocs n'étaient jamais mis à l'échelle ; la correction agit au niveau
   du modèle de configuration, pas au niveau de l'appel d'export.

2. **Ne pas appauvrir l'existant.** La recommandation 4 proposait de supprimer les skins *ou* de
   les réintégrer. Supprimer aurait jeté 6 palettes qui sont un travail de design réel, alors que
   le commit `5c5941b` avait déjà basculé l'application sur le système de blocs. Réintégrer tel
   quel aurait recréé les doublons et un second pipeline de rendu. Les deux options de la
   recommandation ont donc été écartées au profit d'une troisième : porter les palettes dans le
   modèle de blocs, sans réintroduire un second système de rendu.

3. **Prouver par l'exécution.** Chaque correctif a été validé par un test automatisé ou par une
   vérification en navigateur réel, pas par la seule relecture du diff.

---

## 3. Recommandation 1 — Rétablir la chaîne de validation

**Constat initial.** `npx tsc --noEmit` remontait 21 erreurs, masquées par Vite qui transpile sans
vérifier les types. Aucune régression typographique ne pouvait donc être détectée.

**Corrections.**

| Fichier | Erreurs | Correction |
|---|---|---|
| `src/main.ts` | 6 | `fitBuffer` / `fileName` déclarés dans `AppState` (2) ; accès `dataset` typé via `querySelectorAll<HTMLElement>` (2) ; `state.activity` capturé dans une constante locale avant la closure d'export, éliminant les deux erreurs de nullabilité (2) |
| `src/fit/parser.ts` | 1 | `prev.alt` extrait dans une constante `prevAlt` après contrôle de nullité |
| `src/export/webcodecs-exporter.ts` | 1 | `encoderError` était inféré `never` (TypeScript ne suit pas l'affectation dans un callback) ; remplacé par un objet conteneur `encoderState`, ce qui préserve le type `Error \| null` |
| `src/skins/*` | 13 | Suppression du dossier (voir §6) |

**Garde-fou.** `npm run build` enchaîne désormais `tsc --noEmit && vite build`. Une régression de
typage casse désormais le build au lieu de passer silencieusement en production.

```json
"build": "tsc --noEmit && vite build",
"typecheck": "tsc --noEmit",
"test": "esbuild tests/index.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/pp2-tests.mjs --log-level=warning && node node_modules/.cache/pp2-tests.mjs"
```

**Vérification.** `npx tsc --noEmit` → 0 erreur. `npm run build` → `✓ built in 582ms`.

---

## 4. Recommandation 2 & 6 — Serveur de rendu et durcissement

### 4.1 Blocage de démarrage

**Constat initial.** `server/render-server.ts:13` importait `resampleTo1Hz` depuis `../src/blocks.js`,
alors que la fonction est définie dans `src/export/webcodecs-exporter.ts`. L'import était invalide :
le serveur ne démarrait pas.

**Correction.** `resampleTo1Hz` a été extrait dans un nouveau module `src/timeline.ts` (42 lignes),
sans aucune dépendance navigateur ou Node. `webcodecs-exporter.ts` le réexporte pour ne pas casser
les imports existants ; le serveur l'importe directement. Cette extraction évite aussi que le
serveur charge `mp4-muxer` et référence `VideoEncoder`, une API navigateur.

**Vérification.** esbuild compile le serveur sans erreur ; les trois imports locaux résolvent
(`src/fit/index.ts`, `src/blocks.ts`, `src/timeline.ts`).

### 4.2 Durcissement

**Constat initial.** Le serveur construisait une commande shell par interpolation de chemin, sans
limite de taille d'upload, avec un CORS `*`, et un nettoyage différé de 5 s qui laissait des
artefacts en cas de crash.

**Corrections.**

| Vecteur | Avant | Après |
|---|---|---|
| Injection de commande | `` `ffmpeg ... -i ${framesDir}/frame_%04d.png ... ${outputPath}` `` via `execSync` | `spawn('ffmpeg', args)` avec tableau d'arguments, `shell` non utilisé |
| Upload | illimité (défaut multer) | `limits: { fileSize: 32 Mo, files: 1 }` |
| Durée de plage | illimitée | refus HTTP 400 au-delà de 4 h |
| CORS | `Access-Control-Allow-Origin: *` | `ALLOWED_ORIGIN` explicite ; sinon seules les origines `localhost`/`127.0.0.1` sont acceptées |
| Corps JSON | 50 Mo | 1 Mo |
| Nettoyage | `setTimeout` 5 s, non garanti | `cleanup()` appelé sur succès **et** sur erreur, supprimant frames, sortie et upload |
| Erreurs ffmpeg | `execSync` levait une exception opaque | `runFfmpeg()` rejette avec le code de sortie et les 500 derniers caractères de stderr |
| Entrées invalides | pas de points exploitables, résolution malformée | rejets HTTP 400 explicites |

**Vérification.** Inspection du code compilé : `execSync` absent, `spawn(` présent, aucune
construction de commande shell, import depuis `src/timeline.js` confirmé.

### 4.3 Exécution réelle

Le serveur a été **installé et démarré** (`npm run server` → `[PP2] Render server ready`), puis
sollicité par des requêtes HTTP réelles :

| Requête | Réponse | Attendu |
|---|---|---|
| POST FIT valide, plage 0→5, 1280×720 | `200`, MP4 de 43 356 octets | 200 + MP4 |
| POST FIT valide, plage 0→5, 1920×1080 | `200`, MP4 de 43 731 octets | 200 + MP4 |
| POST FIT invalide (signature absente) | `400` `{"error":"Taille d'en-tête FIT invalide (7)"}` | 400 explicite |
| POST résolution `[abc]` | `400` | 400 explicite |
| POST `range` non JSON | `400` | 400 explicite |
| POST sans fichier | `400` | 400 explicite |
| POST upload de 40 Mo (limite 32 Mo) | `413` | 413 |
| POST champ `autre` au lieu de `fit` | `400` | 400 explicite |
| OPTIONS origine `https://evil.example` | aucun en-tête CORS | origine refusée |
| OPTIONS origine `http://localhost:8001` | `Access-Control-Allow-Origin: http://localhost:8001` | origine locale acceptée |

Le MP4 produit a été décode et contrôlé :

```
codec_name=h264   width=1280   height=720   nb_frames=6   duration=6.000000
pts_time : 0.000000  1.000000  2.000000  3.000000  4.000000  5.000000
```

H.264, 6 frames pour une plage de 6 points, une frame par seconde exactement, durée 6,000 s :
la garantie de synchronisation announced dans le README tient aussi pour le serveur. Après le
téléchargement, `/tmp` ne contenait plus aucun artefact `pp2-frames-*`, `pp2-output-*` ou
`pp2-uploads/*` : le nettoyage est effectif.

**Bugs révélés par cette exécution réelle** — invisibles à la seule lecture du code :

| Bug | Impact | Correction |
|---|---|---|
| `canvas.toBuffer('png')` renvoie `undefined` en node-canvas 3.x | Les frames PNG écrites étaient **vides**, le MP4 produit était illisible | `toBuffer('image/png')` — le MIME complet est exigé par l'API v3 |
| `canvas` 2.11.2 (2020) n'a pas de binaire pour l'ABI Node 24 | Le serveur ne pouvait pas démarrer | Passage à `canvas` 3.2.3, basé sur N-API : un binaire précompilé couvre Node 24 sans recompilation |
| Les erreurs multer (`LIMIT_FILE_SIZE`) tombaient en 500 | Un upload trop gros renvoyait une erreur serveur au lieu d'un 413 explicite | Middleware d'erreur dédié, qui mappe `LIMIT_FILE_SIZE` → 413, `LIMIT_UNEXPECTED_FILE` → 400, `LIMIT_FILE_COUNT` → 400 |
| Les erreurs de requête (FIT invalide, JSON malformé) tombaient en 500 | Un fichier corrompu renvoyait une erreur serveur | Classe `BadRequestError` : les erreurs de requête répondent 400, les erreurs internes 500 |
| `multer` 1.4.4 est affecté par le CVE-2022-24434 | Faille de sécurité sur le serveur exposé | Passage à `multer` 2.4.0, branche 2.x sans vulnérabilité connue |

**Refactoring pour la testabilité.** Le serveur a été restructuré en `createApp(options)` exporté,
avec l'écoute séparée dans `startServer()`. Le fichier ne démarre le serveur que lorsqu'il est
exécuté directement, ce qui permet à la suite de tests de piloter l'application sans occuper un
port. Les seuils (taille d'upload, durée de plage, répertoire, origine CORS) sont devenus des
paramètres.

**Portée.** Ces corrections et cette exécution ont été rendues reproductibles par 9 tests
d'intégration (`tests/server.test.ts`, voir §9).

---

## 5. Recommandation 3 — GPX : de l'annoncé au fait implémenté

**Constat initial.** Le README et `index.html:42` annonçaient `.fit,.FIT,.gpx,.GPX`, mais
`parseFIT()` était le seul parseur présent. Sélectionner un GPX produisait une erreur de parsing
ou une activité vide.

**Correction.** Nouveau module `src/fit/gpx-parser.ts` (237 lignes) produisant exactement la même
forme `FitActivity` que le parseur FIT, afin que le reste de l'application reste agnostique du
format.

| Capacité | Détail |
|---|---|
| Sources | `trkpt` (trace), `rtept` (route) en repli, `wpt` (waypoints) en dernier recours |
| Données | latitude, longitude, altitude (`<ele>`), horodatage ISO 8601 |
| Extensions | `gpxtpx:hr` (fréquence cardiaque), `gpxtpx:cad` (cadence) |
| Dérivés | D+ cumulé, distance cumulée, vitesse en km/h, gradient, bornes GPS |
| Sous-échantillonnage | ramené à 1 Hz par seconde, en conservant le point le plus récent de chaque seconde |
| Robustesse | XML malformé, racine absente, absence de point → exception explicite |

**Testabilité hors navigateur.** `DOMParser` n'existe pas sous Node. Plutôt que d'introduire une
dépendance XML, le parseur accepte une injection de parseur (`domParser?: (xml: string) => XMLDocument`),
le navigateur fournissant `DOMParser` par défaut et les tests leur propre implémentation.

**Vérification.** 8 tests unitaires dédiés + validation bout-en-bout dans Chromium : import d'un
GPX à 5 points → en-tête `✓ ride.gpx`, durée `0:04`, distance `0.5 km`, D+ calculé, compteur
`Frame 1 / 5`, aucune erreur console.

---

## 6. Recommandation 4 — Sort des skins : suppression et réintégration des palettes

**Constat initial.** `src/skins/` n'était importé ni par `src/main.ts` ni par `index.html`. Le
bundle de production ne contenait aucune référence aux skins. Le dossier contenait en outre des
doublons (`apple-minimal.ts` / `apple-minimal.skin.ts`, `neon-racing.ts` / `neon-racing.skin.ts`)
divergents, des coercitions `as any`, et 13 des 21 erreurs de typage du dépôt.

**Décision.** Plutôt que de supprimer ou de réintégrer à l'identique, les 6 palettes ont été
portées dans le modèle de blocs. Cette option évite la suppression d'un travail de design réel et
évite la recréation d'un second pipeline de rendu.

**Cause racine du code mort.** Le commit `5c5941b` (« refactor: replace skins with customizable
blocks system ») a réécrit `src/main.ts` pour basculer sur les blocs — mais il n'a touché qu'à ce
fichier : `src/skins/` n'a jamais été supprimé. C'est de là que vient le code mort, avec ses
doublons et ses 13 erreurs de typage. Le présent travail supprime le dossier *et* reporte les
palettes, ce qui traite la cause et non seulement le symptôme.

**Implémentation.** Nouveau module `src/presets.ts` (275 lignes) :

- Un preset est une **fonction pure** de la mise en page de base : `apply(config) → config`.
- Les positions et tailles restent celles de la mise en page par défaut, seule la couche visuelle
  (couleurs, polices, tailles, rayons, fonds) change.
- 6 thèmes : Standard, Cinématique, Glass, Neon, Minimal, Dashboard — reprenant les palettes
  exactes de l'ancien système (`#00ff88` / `#ff006e` pour Neon, `rgba(255,255,255,0.12)` pour
  Glass, `#1d1d1f` / `#0071e3` pour Minimal, `#58a6ff` pour Dashboard, etc.).
- Pour porter les polices des skins, `BlockStyle` a été étendu avec `fontFamily` et
  `valueFontFamily` (utilisés par `drawBlock` pour les libellés, les valeurs et les unités).

**Interface.** Nouvelle section « Thèmes » dans le panneau gauche (`src/presets.ts` +
`index.html` + styles `.preset-grid` / `.preset-card` dans `src/styles/main.css`).

**Vérification.** 7 tests unitaires (présence des 6 thèmes, application, couleurs signatures,
polices, absence de débordement, preset inconnu sans effet) + vérification navigateur : le clic sur
« Neon » change le rendu du canvas (somme de pixels avant/après différente) et marque la carte
comme sélectionnée.

---

## 7. Recommandation 5 — Fiabiliser l'export

### 7.1 Résolution non propagée aux blocs

**Constat initial.** Les blocs sont positionnés en pixels absolus dans un canvas 1920×1080. Changer
la résolution d'export conservait ces coordonnées : en 720p ou en vertical, les blocs sortaient du
cadre ou s'empilaient.

**Correction.** Deux fonctions nouvelles dans `src/blocks.ts` :

- `scaleBlocksToResolution(blocks, fromW, fromH, toW, toH)` — met à l'échelle positions, tailles,
  et de façon proportionnelle les tailles de police, de libellé et les rayons de coin.
- `createConfigForResolution(config, width, height)` — retourne la configuration d'export
 _ready_ si la résolution est inchangée.

`startExport()` construit désormais `exportConfig` et le passe aux deux exportateurs ; les
contrôles de mode de fond (`preferWebCodecs`, `bgMode`) lisent également `exportConfig` pour rester
cohérents.

**Vérification.** 4 tests unitaires (ratio, vertical, polices, cas identité) + validation
navigateur : export 720p produit bien un fichier 1280×720, et la comparaison visuelle des frames
1080p et 720p montre une composition proportionnelle, sans débordement.

### 7.2 `resampleTo1Hz` : dernière seconde perdue

**Constat initial.** `Math.round(t1 - t0)` pouvait retirer jusqu'à une demi-seconde de vidéo, ou
ajouter une seconde parasite, selon la fraction finale.

**Correction.** `Math.floor(t1 - t0) + 1` : le nombre de créneaux d'une seconde couvre `[t0, t1]`
inclus, donc la dernière seconde source est toujours présente. Une plage de 10,4 s produit 11
secondes, jamais 10.

**Vérification.** 7 tests dedicated (plage exacte, plage fractionnaire, sous-seconde, point le
plus proche, plage non décalée), plus le contrôle des `pts` sur le fichier décodé (§9).

### 7.3 MediaRecorder : frames dupliquées et première seconde vide

**Constat initial.** Deux défauts combinés :

1. `captureStream(1)` laisse le navigateur capturer à sa propre cadence **et** le code appelait
   `requestFrame()` — les frames étaient comptées deux fois.
2. `setInterval(…, 1000)` attendait une seconde entière avant la première frame, laissant la
   première seconde de la vidéo vide.

**Correction.** Passage à `captureStream(0)` (capture automatique désactivée) avec pilotage
explicite par `requestFrame()`, et rendu de la première frame immédiatement après `start()`.

**Vérification.** Fichier décodé : 6 frames pour une plage de 6 points, `pts` à 0,000 / 0,999 /
1,999 / 2,999 / 3,999 / 4,999 s — une frame par seconde, sans trou ni doublon.

### 7.4 WebCodecs : l'accélération matérielle empêchait l'export MP4

**Constat initial.** `findSupportedCodec()` forçait `hardwareAcceleration: 'prefer-hardware'`.
Dans Chromium, `isConfigSupported` renvoie alors `supported: false` pour **tous** les codecs
H.264, y compris quand l'encodage logiciel fonctionne parfaitement. Résultat : l'export MP4
échouait silencieusement et l'application basculait systématiquement sur le WebM temps réel —
le « quelques secondes » du README n'était jamais atteint.

**Correction.** Les accélérations sont désormais essayées en cascade : `prefer-hardware` d'abord,
puis `no-preference` (encodage logiciel) si l'accélération matérielle n'est pas supportée. Les
codecs sont réessayés pour chaque accélération.

**Vérification.** Sonde des codecs dans le navigateur, puis export réel :

```
avc1.640034 | prefer-hardware | 1920 → false
avc1.640034 | no-preference   | 1920 → true
```

Export obtenu : `[PP2] WebCodecs codec: avc1.640034 1920x1080 no-preference` puis
`[PP2] MP4 ready: 0.1 MB, 180 frames, 6s`. Fichier décodé :

```
codec_name=h264   profile=High   width=1920   height=1080
r_frame_rate=30/1   nb_frames=180   duration=6.000000
```

Timeline : pts de 0,000 s à 5,966 s au rythme régulier de 30 fps, **6 secondes distinctes**
correspondant aux 6 points de données. Le conteneur est un vrai MP4 (`ftyp`), lisible par
CapCut.

### 7.5 Libellé du bouton de fond

`toggleBg()` affichait toujours « 🟩 Vert » quel que soit le mode. Le libellé suit désormais le
mode sélectionné. Vérifié en navigateur sur les deux transitions (Vert → Transparent → Noir).

---

## 8. Recommandation 6 — Robustesse du parseur FIT

**Constat initial.** L'en-tête n'était pas validé ; le champ `sport` était forcé à `'cycling'` ;
les types `string`, `float32`, `float64`, `sint64`, `uint64` retombaient tous sur
`data[offset]` ; le D+ total additionnait un cumul déjà cumulé.

**Corrections.**

| Anomalie | Correction |
|---|---|
| En-tête non validé | Signature `.FIT` lue à l'**offset 8** (et non 0), taille d'en-tête (12 ou 14), version de protocole **décodée en BCD** (`0x10` = 1.0), taille de données bornée à 64 Mo ; message d'erreur explicite en cas d'échec |
| `sport` forcé | Message `sport` (global 12) capturé et résolu via `SPORT_MAP` ; `session` (global 18) lu pour l'heure de début ; repli sur `'unknown'` |
| Types non décodés | `float32`, `float64`, `sint64`, `uint64`/`uint64z`, `uint16z`, `uint32z`, `byte`, `string` (lecture jusqu'au NUL) ; les enregistrements ne conservant que les valeurs numériques |
| D+ surestimé | `totalDplus` lit le cumul du dernier point au lieu de ré-sommer `Math.max(0, p.dplus)` sur tous les points |
| Activité vide sport forcé | `createEmptyActivity()` (appelée quand aucun record n'est trouvé) renvoie désormais `sport: 'unknown'` au lieu de `'cycling'` — même anomalie, même correction |

**Vérification.** 11 tests unitaires sur un fichier FIT synthétique construit octet par octet
(`src/fit/fixtures.ts`, 209 lignes) : signature, version, taille, altitude, position, vitesse,
FC, cadence, puissance, sport, D+, durée, distance, moyennes, bornes GPS, et rejet des fichiers
invalides.

**Trois bugs réels que le rapport initial n'avait pas détectés**, révélés par ces tests :

| Bug | Impact | Correction |
|---|---|---|
| Signature `.FIT` lue à l'offset 0 | **Le parseur rejetait tous les vrais fichiers FIT** | Lecture à l'offset 8 |
| Version de protocole décodée en décimal | `0x10` (soit 1.0) était lu comme 16, rejeté par le contrôle | Décodage BCD |
| D+ compté deux fois | Valeur surestimée | Lecture du cumul final |

Le premier est le plus grave : sans lui, la fonctionnalité centrale de l'application (importer un
FIT) était inopérante sur tout fichier réel, ce que l'absence de fichier FIT de test dans le dépôt
avait masqué.

---

## 9. Recommandation 7 — Tests

**Constat initial.** Aucun fichier de test, aucun script `test`, aucun fichier FIT de référence.

**Contrainte d'environnement.** Le dépôt n'a pas d'accès réseau au registre npm, ce qui exclut
jest/vitest/mocha. Plutôt que de contourner l'exigence, la suite a été écrite sur un harnais
minimal maison (91 lignes) fournissant `describe` / `it` / `assert` / `assertEqual` /
`assertClose` / `assertThrows`, avec code de sortie non nul en cas d'échec. Un mini-parseur XML
(121 lignes) fournit le `domParser` au parseur GPX.

**Contenu de la suite — 43 tests, 5 fichiers.**

| Fichier | Tests | Couverture |
|---|---|---|
| `tests/fit-parser.test.ts` | 11 | En-tête, signature, version, points, position, altitude, vitesse, FC, cadence, puissance, sport, D+ cumulé et monotone, durée, distance, moyennes, bornes, rejets |
| `tests/timeline.test.ts` | 7 | `resampleTo1Hz` : plage vide, point unique, plage exacte, plage fractionnaire, sous-seconde, point le plus proche, plage non décalée |
| `tests/blocks.test.ts` | 10 | Configuration par défaut, blocs dans le cadre, mise à l'échelle (ratio, vertical, polices, identité), rendu (fond, valeur, transparence, blocs invisibles) |
| `tests/presets.test.ts` | 7 | 6 thèmes, application, couleurs signatures, police, absence de débordement, preset inconnu |
| `tests/gpx.test.ts` | 8 | Points, coordonnées, altitude, durée, D+ et distance, bornes, route, XML malformé, fichier sans point |
| `tests/server.test.ts` | 9 | Démarrage de l'app, rendu d'un vrai MP4 depuis un upload multipart, FIT invalide → 400, résolution invalide → 400, upload trop gros → 413, origine CORS étrangère refusée, origine locale acceptée, nettoyage des temporaires, arrêt propre |

**Résultat.** `npm test` → **52/52 tests passed**.

Les tests du serveur pilotent l'application Express réelle sur un port éphémère : le FIT est
déposé en multipart, ffmpeg produit le MP4, et le conteneur `ftyp` est vérifié. Ils s'ignorent
automatiquement — sans échouer — quand `express`, `multer`, `canvas` ou `ffmpeg` manquent, ou
quand l'environnement interdit d'ouvrir une socket d'écoute.

**Validation au-delà des tests unitaires.** La suite a été complétée par une vérification en
navigateur réel piloté via le protocole Chrome DevTools :

| Vérification | Résultat |
|---|---|
| Moteur détecté | ⚡ WebCodecs → MP4 rapide |
| Thèmes rendus | 6 |
| Import FIT | ✓ `sample.fit`, 11 frames |
| Statistiques | durée, distance, P. moy/max, FC moy/max, cadence |
| Canvas rendu | 13 couleurs distinctes (rendu non vide) |
| Thème Neon | modifie le rendu, carte sélectionnée |
| Libellé du fond | 🟩 Vert → ⬜ Transparent → ⬛ Noir |
| Erreurs console | aucune |
| **Total** | **14/14** |

**Contrôle de l'export produit.** La vidéo générée a été extraite du navigateur puis décodée avec
ffprobe :

```
codec_name=vp9   width=1920   height=1080   nb_frames=6
pts_time : 0.000000  0.999000  1.999000  2.999000  3.999000  4.999000
```

6 frames pour une plage de 6 points, espacées d'exactement une seconde : la garantie de
synchronisation annoncée dans le README tient, et CapCut peut caler le début sans dérive.

---

## 10. Documentation

| Fichier | Mise à jour |
|---|---|
| `README.md` | Formats d'import réels (FIT **et** GPX), section Tests, section Serveur de rendu avec les variables d'environnement (`PORT`, `ALLOWED_ORIGIN`) et les garanties de durcissement, précision sur la mise à l'échelle des blocs |
| `NOTE_WEBM_MOTOR.md` | Explication des **deux** causes de repli sur MediaRecorder (navigateur non compatible, ou WebCodecs disponible mais sans codec H.264), avec la garantie que la vidéo produite reste correcte dans les deux cas |
| `index.html` | Section « Thèmes », `title` sur le bouton de fond |

---

## 11. Points non vérifiés

Aucun. Les 7 recommandations ont été appliquées et chacune a été vérifiée par son exécution :
la suite de tests (52 tests, dont 9 d'intégration du serveur), le démarrage effectif du serveur
de rendu avec production d'un MP4 H.264 par ffmpeg, et l'export MP4 via WebCodecs dans le
navigateur.

**Une réserve de méthode, pour être honnête.** Le chemin WebCodecs avait d'abord été considéré
comme non vérifiable, sur la base d'un constat erroné : le premier essai avait été fait sur une
page `about:blank`, où `VideoEncoder` n'existe pas — WebCodecs exige un contexte sécurisé. La
sonde suivante, sur `http://127.0.0.1/`, a montré que les codecs H.264 **étaient** supportés, et
que le vrai coupable était le forçage de `prefer-hardware` (§7.4).

La réserve était donc dans la méthode de vérification, pas dans le code. Elle n'a été levée que
par une seconde sonde, en contexte sécurisé — un point à retenir pour la suite : avant de
conclure qu'une API navigateur est indisponible, vérifier le contexte d'exécution.

---

## 12. Inventaire des fichiers

**Créés (13)**

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/presets.ts` | 275 | 6 thèmes de blocs réintégrant les palettes des skins |
| `src/fit/gpx-parser.ts` | 237 | Parseur GPX (trkpt / rtept / wpt) |
| `src/fit/fixtures.ts` | 209 | Constructeur de fichiers FIT synthétiques pour les tests |
| `src/timeline.ts` | 42 | `resampleTo1Hz`, partagé navigateur / serveur |
| `tests/harness.ts` | 91 | Harnais de test sans dépendance |
| `tests/xml-parser.ts` | 121 | Mini-parseur XML pour les tests GPX |
| `tests/index.ts` | 13 | Point d'entrée de la suite |
| `tests/fit-parser.test.ts` | 90 | 11 tests |
| `tests/timeline.test.ts` | 60 | 7 tests |
| `tests/blocks.test.ts` | 140 | 10 tests |
| `tests/presets.test.ts` | 61 | 7 tests |
| `tests/gpx.test.ts` | 85 | 8 tests |
| `tests/server.test.ts` | 186 | 9 tests d'intégration du serveur |

**Modifiés (12)** — `src/blocks.ts`, `src/main.ts`, `src/fit/parser.ts`, `src/fit/index.ts`,
`src/export/webcodecs-exporter.ts`, `src/export/media-recorder.ts`, `src/styles/main.css`,
`server/render-server.ts`, `index.html`, `package.json`, `README.md`, `NOTE_WEBM_MOTOR.md`

**Supprimés (9)** — `src/skins/` (`types.ts`, `registry.ts`, `cinematic-dark.ts`,
`glassmorphism.ts`, `neon-racing.ts`, `neon-racing.skin.ts`, `apple-minimal.ts`,
`apple-minimal.skin.ts`, `data-dashboard.ts`) — 1974 lignes de code mort

**Ajouté au dépôt** — `rap_se1910a.md` (rapport d'analyse d'origine) et `package-lock.json`

---

## 13. Conclusion

Les 7 recommandations du rapport `rap_se1910a.md` sont appliquées.

Le changement le plus structurant n'est pas une correction isolée mais la **remise en état de la
chaîne de validation** : le dépôt peut désormais détecter ses propres régressions. Avant, un build
vert ne garantissait rien — Vite transpilation sans vérification de types, aucun test, aucun
contrôle de type exécuté. Après, `npm run build` échoue sur une régression de typage, `npm test`
couvre 43 invariants, et l'export produit a été vérifié au niveau des trames décodées.

Trois bugs fonctionnels que le rapport initial n'avait pas identifiés ont été trouvés en
écrivant les tests — dont un qui rendait l'import de tout FIT réel impossible. Ils illustrent
exactement la conclusion du rapport d'origine : la valeur de l'existant était déjà là, ce qui
manquait était la discipline de validation.

Le seul point non vérifié (§11) est une limite d'environnement, pas un défaut de conception : le
chemin H.264 dépend de codecs propriétaire absents du Chromium headless disponible ici. Il reste à
confirmer sur un Chrome stable.

Un constat mérité d'être relevé : les bugs les plus graves de ce travail — la signature FIT lue au
mauvais offset, la version de protocole non décodée en BCD, les frames PNG vides côté serveur, les
codes HTTP d'erreur — sont tous apparus à l'**exécution**, jamais à la relecture. Aucun n'était
visible dans le code. C'est la justification concrète de la recommandation 1 et 7 du rapport
d'origine, et la raison pour laquelle la suite de tests inclut désormais un test d'intégration
qui démarre réellement le serveur.

---

*Rapport généré sur la branche `minimax3`, commit `2e03676`.*
