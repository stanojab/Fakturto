---
status: sprejeto
date: 2026-10-12
---

# Docker Compose za lokalni zagon

## Kontekst in opis problema

Sistem je sestavljen iz več delov: frontend, backend API, worker, PostgreSQL in MinIO. Vsak razvijalec (in ocenjevalec) mora celoten sistem zagnati na svojem računalniku, ki ima lahko Windows, macOS ali Linux. Ročna namestitev in nastavitev vseh storitev je zamudna in vodi v razlike med okolji (»pri meni deluje«). Odločiti se moramo, kako bomo zagotovili enotno lokalno okolje.

## Dejavniki odločitve

* Zagon celotnega sistema z enim ukazom.
* Enake različice storitev (PostgreSQL, MinIO) pri vseh razvijalcih.
* Neodvisnost od operacijskega sistema.
* Nizek prag vstopa – potrebna naj bosta le Git in Docker.
* Nastavitve okolja naj bodo zapisane v repozitoriju.

## Obravnavane alternative

* Docker Compose
* Ročna namestitev storitev na vsak računalnik
* Lokalni Kubernetes (npr. minikube, kind)
* Dev Containers / GitHub Codespaces

## Sprejeta odločitev

Izbrana alternativa: »Docker Compose«, ker v eni datoteki `docker-compose.yml` opiše vseh pet storitev z natančnimi različicami, vrati in odvisnostmi, se zažene z enim ukazom (`docker compose up -d`) na vseh operacijskih sistemih in ne zahteva dodatnega znanja ali infrastrukture, kot ga zahteva Kubernetes.

### Posledice

* Dobro, ker vsak razvijalec v nekaj minutah dobi enako delujoče okolje.
* Dobro, ker je konfiguracija okolja različicirana v Gitu skupaj s kodo.
* Dobro, ker lahko isto datoteko uporabimo za integracijske teste v CI.
* Slabo, ker mora imeti vsak razvijalec nameščen Docker, ki na Windows zahteva WSL 2 in porabi več pomnilnika.
* Slabo, ker je samodejno osveževanje kode (hot reload) prek vsebnikov na Windows lahko počasnejše in zahteva dodatne nastavitve.
* Slabo, ker Docker Compose ni namenjen produkciji; za produkcijsko namestitev bo potrebna ločena odločitev.

### Potrditev

Koraki zagona so zapisani v dokumentu 04 – Arhitektura in tehnološki sklad; preverimo jih na čistem računalniku, kjer sta nameščena le Git in Docker.

## Prednosti in slabosti alternativ

### Ročna namestitev

* Dobro, ker ne potrebuje Dockerja in je zagon kode najhitrejši.
* Slabo, ker imajo razvijalci različne različice storitev in obsežna navodila za vsak operacijski sistem.

### Lokalni Kubernetes

* Dobro, ker je bližje morebitni produkciji v oblaku.
* Slabo, ker je za majhen projekt preveč zapleten in zahteva precej znanja ter virov.

### Dev Containers / Codespaces

* Dobro, ker je tudi urejevalnik vnaprej nastavljen.
* Slabo, ker je vezan na določen urejevalnik ali plačljivo storitev v oblaku in še vedno potrebuje Compose za več storitev.

## Dodatne informacije

Seznam storitev in vrat je v dokumentu [04 – Arhitektura in tehnološki sklad](../04-arhitektura-in-tehnoloski-sklad.md#lokalni-zagon).
