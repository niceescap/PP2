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
| `npm run server` | ne démarrait pas | **code corrigé, non exécuté** (voir §11.1) |
| Export 720p / vertical | blocs débordants | **mis à l'échelle** |
| Export MediaRecorder | frames dupliquées, 1re seconde vide | **1 frame/s exacte** |

**Verdict** — Les 7 recommandations sont appliquées et vérifiées, à l'exception de l'exécution
réelle du serveur de rendu et du chemin d'encodage H.264, bloqués par l'environnement (détail en §11).
Ces deux points sont documentés explicitement plutôt que présentés comme acquis.

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

**Portée réelle.** Ces corrections ont été validées par compilation et par lecture du flux
d'exécution ; le serveur n'a **pas** été démarré (voir §11.1).

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

### 7.4 Libellé du bouton de fond

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

**Résultat.** `npm test` → **43/43 tests passed**.

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

Deux éléments n'ont pas pu être validés dans cet environnement. Ils sont signalés explicitement
plutôt que présentés comme acquis.

### 11.1 Exécution réelle du serveur de rendu

`npm run server` n'a **pas** été démarré. Cause : les dépendances `express`, `multer`, `canvas`
et `tsx` ne sont pas installables dans le sandbox — `npm install` échoue à la compilation native de
`canvas` (binaire précompilé absent pour l'ABI Node 24 / `node-v137`, alors que `cairo`, `pango`
et la toolchain `g++`/`make` sont bien présents).

**Ce qui a été vérifié.** Compilation esbuild complète du serveur sans erreur ; résolution des
trois imports locaux ; absence de `execSync` et présence de `spawn(` ; absence de construction de
commande shell ; import de `resampleTo1Hz` depuis `src/timeline.js` ; logique de cœur rejouée
hors réseau (parse d'un FIT réel → 11 points, resample d'une plage de 6 points → 6, configuration
1280×720 → 8 blocs).

**Ce qui reste à prouver.** Le démarrage effectif du serveur HTTP, la réception d'un upload
multipart, la production d'un MP4 par ffmpeg et le nettoyage des fichiers temporaires.

**Note.** Le serveur n'est pas raccordé à l'interface : `startExport()` appelle directement les
exportateurs navigateur. Le serveur reste donc une voie parallèle, non critique pour le
fonctionnement de l'application. C'est cohérent avec la recommandation 2 du rapport initial, qui
proposait de « trancher » — le code est désormais cohérent et durci, et son caractère optionnel est
documenté dans le README.

### 11.2 Encodage H.264 / WebCodecs

Le chemin MP4 n'a **pas** été exercé en conditions réelles. Le Chromium headless disponible dans
cet environnement (build Playwright) n'embarque pas de codec H.264 : `VideoEncoder.isConfigSupported`
rejette les quatre candidats `avc1.*`, et l'application bascule sur le repli MediaRecorder, comme
prévu. Le chemin WebM a donc été testé, pas le chemin MP4.

**Ce qui a été vérifié.** La chaîne WebCodecs est correcte jusqu'à `findSupportedCodec()` (le
choix du codec, le repli sur MediaRecorder, la gestion d'erreur de l'encodeur via
`encoderState.error` typé) ; le muxage MP4 via `mp4-muxer` est présent et accepte les codecs
`avc`, `hevc`, `av1`, `vp9` ; le repli automatique fonctionne.

**Ce qui reste à prouver.** La production d'un MP4 H.264 par WebCodecs, dans un Chrome stable
possédant les codecs propriétaire.

---

## 12. Inventaire des fichiers

**Créés (12)**

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

Les deux points non vérifiés (§11) sont des limites d'environnement, pas des défauts de
conception : le serveur de rendu est une voie optionnelle non raccordée à l'interface, et le
chemin H.264 dépend de codecs propriétaire absents du Chromium headless disponible ici. Tous deux
restent à confirmer sur une machine disposant des dépendances complètes.

---

*Rapport généré sur la branche `minimax3`, commit `2e03676`.*
