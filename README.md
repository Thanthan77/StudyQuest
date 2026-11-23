# StudyQuest

StudyQuest est une application web gamifiée de gestion de tâches quotidiennes, de séries (*streaks*) et de groupes d'étude avec classement en direct. Elle réunit le suivi des objectifs du quotidien, la protection des séries par gels (*streak freeze*), un système de badges évolutif et des groupes collaboratifs pour maintenir la régularité. Le projet combine un frontend modulaire en **HTML/CSS/JavaScript**, une base de données relationnelle **Supabase (PostgreSQL)** et un déploiement continu sur **GitHub Pages**.

## Aperçu du projet

StudyQuest est une application web dynamique structurée en **HTML, CSS et JavaScript (ES Modules)** qui s'appuie sur **Supabase** pour la persistance des données utilisateurs, des tâches, des badges et des groupes.

Le projet inclut :
- une authentification avec pseudo unique en minuscules, code PIN à 4 chiffres obligatoire (`NOT NULL`) et gestion de session via `localStorage`,
- un tableau de bord (`accueil.html`) en grille Bento aux angles droits affichant le profil, les statistiques de base et un *countdown* dynamique (`timer-badge`),
- un gestionnaire de tâches complet avec sections (*Aujourd'hui*, *À venir*, *Flexibles*, tâches manquées), filtres par catégories (*Personnel*, *École*) et tâches récurrentes,
- un mécanisme de *streaks* et de gels (*streak freeze*) avec obtention tous les 7 jours et suivi des gels utilisés,
- une page dédiée aux statistiques et aux 10 badges officiels,
- un module de groupes et de classement (*Leaderboard*) avec codes d'invitation, gestion des rôles (`admin` / `member`) et actions contextuelles (**Quitter** / **Supprimer**).

---

## Fonctionnalités principales

### 🔹 Fonctionnalités clés

- **Authentification & Session** : inscription et connexion via des interfaces dédiées avec pseudo unique en minuscules, code PIN à 4 chiffres (`NOT NULL`) et session persistée via `localStorage`.
- **Tableau de bord Bento-Grid (`accueil.html`)** : interface modulaire en thème sombre aux coins non arrondis intégrant le pseudo, les statistiques de base et un *countdown* horaire (`timer-badge`).
- **Gestionnaire de tâches** : ajout, modification, suppression et validation des tâches dans la table `tasks`, avec limite de 10 tâches par jour, défilement (*scroll*), redirection vers la section cible à l'ajout et conservation des cases cochées après rafraîchissement.
- **Organisation & Catégories** : navigation entre *Aujourd'hui*, *À venir*, *Flexibles* et tâches manquées, filtrage par catégories (*Personnel* et *École*), gestion des tâches récurrentes *(réinitialisation / reset à revoir)* et mise à jour du compteur total de tâches créées (`+1` à l'ajout, `-1` à la suppression).
- **Séries (*Streaks*) & Gels** : calcul des jours consécutifs d'utilisation, protection par gel de série (*streak freeze*), obtention d'un gel tous les 7 jours, notifications visuelles d'obtention ou d'utilisation et compteur de gels utilisés.
- **Badges & Statistiques** : 10 badges officiels attribués automatiquement, affichage des badges débloqués, vue élargie (au-delà de 4 badges), suivi de progression sur les badges restants, record absolu de *streak*, gels disponibles/utilisés, répartition par catégories et vue d'ensemble (*complétées, créées, manquées, en cours*).
- **Groupes & Classement (*Leaderboard*)** : création et adhésion aux groupes via code d'invitation, gestion des rôles (`admin` / `member`), classement en direct des membres et bouton **Quitter** (membre) ou **Supprimer** (administrateur) selon le rôle.

### 🔹 Fonctionnalités techniques

- Persistance relationnelle dans **Supabase (PostgreSQL)** sur les tables `profiles`, `tasks`, `badges`, `user_badges`, `groups` et `group_members` avec politiques RLS configurées.
- Gestion de session et de code PIN côté client (`auth.js`, `session.js`, `pin.js`, `localStorage`).
- Code modulaire en JavaScript (`accueil.js`, `taskManager.js`, `countdown.js`, `badges.js`, `stats.js`, `groups.js`, `groupRanking.js`, `utils.js`, `app.js`) et feuilles de style organisées par mise en page et composant.
- Déploiement automatisé sur **GitHub Pages** via un workflow **GitHub Actions** (`.github`).

---

## Technologies utilisées

| Catégorie | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Bento-Grid, Flexbox, Grid), JavaScript (Modules ES6 / Vanilla JS) |
| **Base de données & Auth** | Supabase (PostgreSQL), Row Level Security (RLS), `localStorage` |
| **Déploiement** | GitHub Actions, GitHub Pages |
| **Outils** | Git, GitHub, Markdown |

---

## Structure du projet

```plaintext
StudyQuest/
│
├── .github/
├── css/
│   ├── general.css
│   ├── layout/
│   │   └── grid.css
│   └── components/
│       ├── accueil.css
│       ├── groups.css
│       ├── login.css
│       └── statistiques.css
├── design/
│   ├── Page_accueil.png
│   ├── Page_groupes.png
│   ├── Page_login.png
│   ├── Page_signup.png
│   └── Page_Statistiques.png
├── js/
│   ├── accueil.js
│   ├── app.js
│   ├── auth.js
│   ├── badges.js
│   ├── countdown.js
│   ├── groupRanking.js
│   ├── groups.js
│   ├── pin.js
│   ├── session.js
│   ├── stats.js
│   ├── supabaseClient.js
│   ├── taskManager.js
│   └── utils.js
└── pages/
    ├── accueil.html
    └── groups.html
```

---

##  Liens importants

| Type               | Lien                                                                 |
|--------------------|----------------------------------------------------------------------|
| **Site déployé**   | [https://thanthan77.github.io/StudyQuest/](https://thanthan77.github.io/StudyQuest/)           |
| **Repository GitHub** | [https://github.com/Thanthan77/StudyQuest](https://github.com/Thanthan77/StudyQuest) |

