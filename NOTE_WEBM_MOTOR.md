# DIAGNOSTIC : pourquoi le badge affiche « 🐢 MediaRecorder » ?

WebCodecs n'est pas disponible dans le navigateur courant. Deux causes
possibles :

1. **Navigateur non compatible** — Chrome/Edge 94+, Firefox 130+ ou
   Safari 16.4+. Le repli MediaRecorder produit alors un WebM correct,
   mais en temps réel (1 s par seconde de données).
2. **Aucun codec H.264 disponible** — le navigateur expose WebCodecs mais
   refuse l'encodage H.264 (`Aucun codec H.264 supporté par ce navigateur`).
   C'est le cas des builds Chromium sans codecs propriétaire : l'export
   bascule automatiquement sur le WebM.

Dans les deux cas la **vidéo produced est correcte** : 1 frame par seconde,
la synchronisation CapCut tient. Seule la vitesse et le conteneur changent.
