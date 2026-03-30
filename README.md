# qoqa-compta

> Outil open-source personnel pour télécharger automatiquement les factures PDF de Qoqa.ch, les parser, les stocker dans PostgreSQL (Neon.tech) et afficher un beau dashboard de statistiques de dépenses.

---

## Table des matières

- [Aperçu](#aperçu)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Variables d'environnement](#variables-denvironnement)
- [Crawler Python](#crawler-python)
  - [Installation](#installation-crawler)
  - [Lancer le crawler](#lancer-le-crawler)
- [Frontend Next.js](#frontend-nextjs)
  - [Installation](#installation-frontend)
  - [Lancer le frontend](#lancer-le-frontend)
- [Base de données (Neon.tech)](#base-de-données-neontech)
- [Contribuer](#contribuer)

---

## Aperçu

```
┌──────────────────┐     PDFs      ┌──────────────────┐    SQL     ┌──────────────────┐
│   Qoqa.ch        │ ──────────►   │  Crawler Python  │ ────────►  │  PostgreSQL      │
│  (via CDP/Chrome)│               │  (SeleniumBase)  │            │  (Neon.tech)     │
└──────────────────┘               └──────────────────┘            └────────┬─────────┘
                                                                            │
                                                                            ▼
                                                                   ┌──────────────────┐
                                                                   │  Dashboard       │
                                                                   │  (Next.js 16)    │
                                                                   └──────────────────┘
```

---

## Structure du projet

```
qoqa-compta/
├── .env.example              # Variables d'environnement racine
├── .gitignore
├── renovate.json
├── README.md
├── crawler/                  # Code Python
│   ├── .env.example
│   ├── requirements.txt
│   ├── crawler/
│   │   ├── __init__.py
│   │   ├── __main__.py       # Point d'entrée CLI
│   │   ├── sync.py           # Logique principale de synchronisation
│   │   ├── browser.py        # Gestion du navigateur (SeleniumBase CDP)
│   │   ├── db.py             # Connexion et session SQLAlchemy
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── order.py      # Modèle SQLAlchemy QoqaOrder
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── pdf_parser.py # Parsing PDF avec pdfplumber
└── frontend/                 # Application Next.js
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.ts
    ├── components.json       # shadcn/ui config
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx      # Dashboard principal
        │   └── api/
        │       └── orders/
        │           └── route.ts
        ├── components/
        │   ├── ui/           # shadcn/ui auto-générés
        │   ├── stats-cards.tsx
        │   ├── spending-chart.tsx
        │   └── orders-table.tsx
        ├── lib/
        │   ├── db.ts         # Connexion Neon serverless
        │   └── utils.ts
        └── types/
            └── order.ts
```

---

## Prérequis

- **Python 3.11+**
- **Node.js 20+** et **pnpm** (ou npm/yarn)
- **Google Chrome** installé (le crawler réutilise votre profil existant)
- Un compte **Neon.tech** avec une base PostgreSQL (niveau gratuit suffisant)
- Un compte **Qoqa.ch** avec des commandes

---

## Variables d'environnement

Copiez `.env.example` à la racine vers `.env` et adaptez les valeurs :

```bash
cp .env.example .env
```

| Variable            | Description                                               | Exemple                                                                              |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`      | URL de connexion PostgreSQL (Neon.tech)                   | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/qoqa?sslmode=require`     |
| `CHROME_USER_DATA_DIR` | Chemin vers le profil Chrome principal               | `~/.config/google-chrome` (Linux) ou `~/Library/Application Support/Google/Chrome` (macOS) |
| `PDF_DOWNLOAD_DIR`  | Dossier de téléchargement des PDFs                        | `./crawler/pdfs`                                                                     |

> **Note Neon.tech** : votre `DATABASE_URL` se trouve dans le dashboard Neon → votre projet → *Connection Details* → choisir le driver `psycopg`.

---

## Crawler Python

### Installation (crawler)

```bash
cd crawler

# Créer un environnement virtuel
python -m venv .venv
source .venv/bin/activate   # Windows : .venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec votre DATABASE_URL et CHROME_USER_DATA_DIR
```

### Lancer le crawler

```bash
# Depuis le dossier crawler/, avec le venv activé :

# Synchronisation complète (toutes les commandes)
python -m crawler.sync --full

# Synchronisation incrémentale (seulement les nouvelles commandes)
python -m crawler.sync --update

# Afficher l'aide
python -m crawler.sync --help
```

**Important** : fermez toutes les fenêtres Chrome avant de lancer le crawler, car celui-ci réutilise votre profil Chrome principal (cookies inclus → aucune connexion manuelle requise).

---

## Frontend Next.js

### Installation (frontend)

```bash
cd frontend

# Installer les dépendances
pnpm install   # ou: npm install

# Copier et configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec votre DATABASE_URL
```

### Lancer le frontend

```bash
# Mode développement
pnpm dev       # ou: npm run dev

# Build de production
pnpm build && pnpm start
```

Le dashboard sera accessible sur [http://localhost:3000](http://localhost:3000).

---

## Base de données (Neon.tech)

Le crawler crée automatiquement la table `qoqa_orders` au premier lancement (via SQLAlchemy `create_all`).

Structure de la table :

```sql
CREATE TABLE qoqa_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(64) UNIQUE NOT NULL,
    order_date      DATE NOT NULL,
    amount_chf      NUMERIC(10, 2) NOT NULL,
    partner_name    VARCHAR(255),
    pdf_filename    VARCHAR(255),
    raw_text        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Contribuer

Ce projet est personnel mais les PRs sont les bienvenues. Ouvrez une issue avant de soumettre un changement majeur.
