---
status: sprejeto
date: 2026-10-12
---

# PostgreSQL kot podatkovna baza

## Kontekst in opis problema

Fakturko hrani uporabnike, stranke, članstva, dodelitve računovodjem, prejete račune z njihovimi statusi, datoteke in obvestila. Podatki so med seboj tesno povezani (vsak račun pripada točno eni stranki, uporabnik je lahko član več strank, računovodja obdeluje več strank) in vključujejo denarne zneske, ki jih uporabljamo za dejansko plačilo. Potrebujemo podatkovno bazo, ki zagotavlja celovitost teh podatkov, natančno hrambo zneskov in omogoča shranjevanje manj strukturiranih rezultatov branja računov.

## Dejavniki odločitve

* Podatki so relacijski – potrebni so tuji ključi in omejitve enoličnosti (npr. `UNIQUE (user_id, client_id)`).
* Prehodi statusov računa in zapis plačila morajo biti transakcijski.
* Zneski morajo biti shranjeni natančno, brez napak plavajoče vejice.
* Rezultat branja (zanesljivost po posameznih poljih) nima fiksne strukture.
* Za opravila v ozadju želimo čim manj dodatne infrastrukture (glej [ADR-0003](0003-branje-podatkov-kot-opravilo-v-ozadju.md)).
* Dobra podpora v Prisma ORM in enostaven lokalni zagon v Dockerju.

## Obravnavane alternative

* PostgreSQL
* MySQL / MariaDB
* MongoDB (dokumentna baza)
* SQLite

## Sprejeta odločitev

Izbrana alternativa: »PostgreSQL«, ker edina hkrati izpolni vse dejavnike: je polno relacijska s transakcijami in omejitvami, ima tip `NUMERIC` za natančne zneske, tip `JSONB` z indeksiranjem za podatke o zanesljivosti branja, poleg tega pa lahko služi tudi kot vrsta opravil (pg-boss), zato ne potrebujemo ločenega posrednika sporočil.

### Posledice

* Dobro, ker baza sama zagotavlja celovitost podatkov (tuji ključi, enoličnost), zato je manj možnosti za neskladne podatke, npr. račun brez stranke.
* Dobro, ker so zneski shranjeni kot `NUMERIC(12,2)` in pri plačilu ne pride do zaokrožitvenih napak.
* Dobro, ker `JSONB` omogoča shranjevanje zanesljivosti branja brez dodatnih tabel.
* Dobro, ker ista baza služi tudi za vrsto opravil, kar poenostavi arhitekturo in lokalni zagon.
* Slabo, ker je treba spremembe sheme izvajati z migracijami (Prisma Migrate), kar zahteva disciplino v ekipi.
* Slabo, ker je PostgreSQL ob vrsti opravil kritična točka sistema – če baza ne deluje, ne deluje niti obdelava v ozadju.

### Potrditev

Shema v `schema.prisma` uporablja tuje ključe, omejitve enoličnosti, `Decimal` (`NUMERIC(12,2)`) za zneske in `Json` (`JSONB`) za zanesljivost branja; preveri se ob pregledu pull requesta.

## Prednosti in slabosti alternativ

### MySQL / MariaDB

* Dobro, ker je relacijska, razširjena in podpira tip `DECIMAL`.
* Slabo, ker je podpora za JSON manj zmogljiva (ni ekvivalenta `JSONB` z GIN indeksi).
* Slabo, ker pg-boss deluje samo na PostgreSQL – potrebovali bi ločeno rešitev za vrsto opravil.

### MongoDB

* Dobro, ker prožna shema ustreza spremenljivim rezultatom branja.
* Slabo, ker naši podatki niso dokumentni, ampak izrazito relacijski (N:M povezave med uporabniki in strankami); celovitost bi morali preverjati v aplikaciji.
* Slabo, ker so transakcije čez več dokumentov zahtevnejše.

### SQLite

* Dobro, ker ne potrebuje strežnika in je zelo enostavna za razvoj.
* Slabo, ker ni primerna za hkratno pisanje več procesov (API in worker).
* Slabo, ker nima pravega tipa `NUMERIC` z natančnostjo niti `JSONB`.

## Dodatne informacije

Podrobnosti sheme so v dokumentu [03 – Podatkovni model](../03-podatkovni-model.md).
