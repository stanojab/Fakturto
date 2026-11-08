# Fakturko

**Fakturko** je spletna platforma za zbiranje in obdelavo prejetih računov med računovodskim servisom in njegovimi strankami.

Stranke (mala podjetja in samostojni podjetniki) račune dobaviteljev naložijo v aplikacijo kot PDF ali fotografijo. Sistem iz računa samodejno prebere podatke za plačilo (najprej iz UPN QR kode, sicer z modelom umetne inteligence), računovodja jih pregleda ob izvirniku in potrdi, nato račun plača v spletni banki in ga označi kot plačan. Stranka ves čas vidi status svojih računov, vsi računi pa ostanejo urejeno arhivirani po strankah, letih in mesecih.

Rešitev ne nadomešča programa za knjiženje – pokriva korak **pred knjiženjem**: zbiranje, branje, odobritev, plačilo in hrambo računov.

## Uporabljene tehnologije

| Področje | Tehnologije |
|---|---|
| Frontend | React, TypeScript, Vite, React Router |
| Backend | Node.js, Express, TypeScript, Zod, Multer |
| Podatkovna baza | PostgreSQL, Prisma ORM, Prisma Migrate |
| Avtentikacija | JWT, osvežitveni žetoni v piškotkih `httpOnly`, Express middleware |
| Shramba datotek | MinIO (S3 združljiva objektna shramba) |
| Branje računov | zxing (UPN QR), pdf.js, zunanji model AI (npr. Claude API) |
| Opravila v ozadju | pg-boss |
| Lokalni razvoj | Docker, Docker Compose, Git, GitHub |

## Struktura repozitorija

```
├── README.md
├── .gitignore
├── frontend/        # odjemalska aplikacija (React)
├── backend/         # zaledje – REST API in worker (Express)
│   └── prisma/      # Prisma shema, migracije in seed skripta
├── docker-compose.yml
└── docs/            # projektna dokumentacija
    ├── wireframes/  # žični okvirji (PNG)
    └── adr/         # arhitekturne odločitve (MADR)
```

## Lokalni zagon

### Predpogoji

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (vključuje Docker Compose)
- [Node.js](https://nodejs.org/) 24 ali novejši

### Koraki

1. **Kloniraj repozitorij**

   ```bash
   git clone https://github.com/stanojab/Fakturto.git
   cd Fakturto
   ```

2. **Nastavi okoljske spremenljivke** – kopiraj predlogo in v `.env` nastavi svoje geslo
   (isto geslo v `POSTGRES_PASSWORD` in v `DATABASE_URL`) ter dolg naključen `JWT_SECRET`
   (ukaz za generiranje je v `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. **Zaženi podatkovno bazo** (PostgreSQL v Dockerju):

   ```bash
   docker compose up -d
   docker compose ps   # fakturko-postgres mora imeti status "healthy"
   ```

4. **Namesti odvisnosti backenda in pripravi bazo:**

   ```bash
   cd backend
   npm install
   npx prisma migrate deploy   # ustvari tabele
   npx prisma generate         # generira Prisma client
   ```

5. **Napolni bazo s testnimi podatki** (≈15.000 izmišljenih zapisov, Faker):

   ```bash
   npm run db:seed
   ```

   Seed se izvede samo na prazni bazi. Za ponoven začetek (**izbriše vse podatke**):
   `npx prisma migrate reset`.

   Testni uporabniki: `admin@fakturko.test`, `racunovodja@fakturko.test`, `stranka@fakturko.test`,
   vsi z geslom `Fakturko123!` (samo za lokalni razvoj). Na obstoječi bazi `npm run db:seed`
   podatkov ne doda, testnim uporabnikom pa nastavi to geslo.

6. **Zaženi backend:**

   ```bash
   npm run dev
   ```

   Preveri na http://localhost:3000/health → `{"status":"ok"}`.

   Naložene datoteke računov se v MVP shranjujejo v mapo `backend/uploads/` (izključena iz Gita,
   glej [ADR 0006](docs/adr/0006-lokalni-disk-za-mvp.md)); mapo lahko spremeniš s `UPLOAD_DIR` v `.env`.

7. **Zaženi frontend** (v novem terminalu, backend mora teči):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Odpri http://localhost:5173 → **prijava** s testnim uporabnikom (glej korak 5). Administrator
   vidi zaslon **Stranke** (pregled, iskanje, dodajanje, urejanje, deaktivacija).
   Zahteve na `/api/...` Vite preusmeri na backend (`http://localhost:3000`).

### Uporabni ukazi (v mapi `backend/`)

| Ukaz | Opis |
|---|---|
| `npm run dev` | Zagon backenda z avtomatskim ponovnim zagonom ob spremembah |
| `npm run build` / `npm start` | Prevajanje v `dist/` in zagon prevedene različice |
| `npm run lint` | Preverjanje kode z ESLint |
| `npm run format` | Oblikovanje kode s Prettier |
| `npm run db:seed` | Polnjenje prazne baze s testnimi podatki |
| `npm test` | Zagon avtomatskih testov (potrebuje zagnano bazo) |
| `npx prisma studio` | Pregled podatkov v brskalniku |

## Dokumentacija

- [01 – Zasnova rešitve](docs/01-zasnova-resitve.md)
- [02 – Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
- [03 – Podatkovni model](docs/03-podatkovni-model.md)
- [04 – Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
- [05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)
- [06 – Wireframes](docs/06-wireframes.md)

### Arhitekturne odločitve (ADR)

Odločitve so zapisane po predlogi [MADR](https://adr.github.io/madr/) ([predloga](docs/adr/adr-template.md)).

| ADR | Odločitev | Status |
|---|---|---|
| [0001](docs/adr/0001-postgresql-kot-podatkovna-baza.md) | PostgreSQL kot podatkovna baza | sprejeto |
| [0002](docs/adr/0002-datoteke-v-objektni-shrambi.md) | Datoteke računov v objektni shrambi (MinIO), ne v bazi | sprejeto |
| [0003](docs/adr/0003-branje-podatkov-kot-opravilo-v-ozadju.md) | Branje podatkov kot opravilo v ozadju (pg-boss) | sprejeto |
| [0004](docs/adr/0004-najprej-upn-qr-nato-ai.md) | Najprej UPN QR koda, nato model AI | sprejeto |
| [0005](docs/adr/0005-docker-compose-za-lokalni-zagon.md) | Docker Compose za lokalni zagon | sprejeto |
| [0006](docs/adr/0006-lokalni-disk-za-mvp.md) | Datoteke računov v MVP na lokalnem disku namesto v MinIO | sprejeto |

## Razvojni proces

Repozitorij uporablja strategijo [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow):

1. Iz veje `main` ustvarimo novo vejo z opisnim imenom (npr. `feature/nalaganje-racunov`, `docs/adr`).
2. Na veji delamo in redno potrjujemo spremembe (commit) ter jih potisnemo na GitHub.
3. Odpremo pull request v `main`.
4. Po pregledu pull request združimo v `main`; veja `main` je vedno v delujočem stanju.

Veja `main` je zaščitena: neposredni push, prisilno prepisovanje zgodovine in brisanje niso dovoljeni, spremembe se združujejo izključno prek pull requestov.
