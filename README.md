# Bulles Sereines

Mini-jeu contemplatif pour travailler l’attention douce, l’attente et l’inhibition sans score ni mise en échec.

## Intention

Ce jeu est conçu pour un enfant présentant une anxiété de performance et des difficultés attentionnelles non liées à un TDAH.

Principes retenus :

- aucun score ;
- aucun chrono ;
- aucun message d’échec ;
- pas de niveau à réussir ;
- feedback sensoriel positif ;
- attention visuelle ;
- attente du bon moment ;
- rythme respiratoire implicite.

## Mécanique

Les bulles respirent lentement.  
Quand une bulle devient lumineuse, elle est prête.  
Si l’enfant la touche à ce moment, elle éclate avec un son rond et satisfaisant.  
Si elle est touchée trop tôt, elle continue simplement à flotter.

## Compétences visées

- attention soutenue visuelle ;
- inhibition douce de l’impulsion ;
- tolérance à l’essai non parfait ;
- synchronisation attention/action ;
- régulation physiologique indirecte par rythme lent.

Ce jeu ne prétend pas traiter l’anxiété ni remplacer un accompagnement professionnel.

## Installation

```bash
npm install
npm run dev
```

Puis ouvrir l’URL indiquée par Vite, généralement :

```bash
http://localhost:5173
```

## Build production

```bash
npm run build
```

Le dossier de sortie est :

```bash
dist/
```

## Netlify

Réglages :

```txt
Build command: npm run build
Publish directory: dist
```

## GitHub Pages

Si ton repo s’appelle `bulles-sereines-chloe`, tu peux adapter `vite.config.js` ainsi :

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/bulles-sereines-chloe/",
});
```

Pour Netlify, garde plutôt la configuration actuelle sans `base`.

## Note audio

Les navigateurs, surtout iOS, ne permettent de lancer le son qu’après une première interaction utilisateur. C’est normal.
