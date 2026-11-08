---
status: sprejeto
date: 2026-11-08
---

# Datoteke računov v MVP na lokalnem disku namesto v MinIO

## Kontekst in opis problema

[ADR 0002](0002-datoteke-v-objektni-shrambi.md) določa, da so datoteke računov shranjene v objektni shrambi MinIO. Obseg MVP je bil zmanjšan (glej razdelek »Obseg MVP« v [02 – Funkcionalnosti in obseg](../02-funkcionalnosti-in-obseg.md)): v MVP ni workerja za samodejno branje, zato do datotek dostopa samo API. Vprašanje je, ali MinIO za MVP sploh potrebujemo.

## Dejavniki odločitve

* MVP naj bo končan čim prej, z najmanj nastavitvami.
* Do datotek v MVP dostopa samo en proces (API).
* Kasnejši prehod na MinIO naj zahteva čim manj sprememb kode.

## Obravnavane alternative

* MinIO že v MVP (kot v ADR 0002)
* Lokalni disk zaledja za MVP, MinIO kasneje

## Sprejeta odločitev

Izbrana alternativa: »Lokalni disk zaledja za MVP, MinIO kasneje«, ker v MVP ni ločenega workerja, ki bi potreboval skupno shrambo, in odpade dodatna storitev v Docker Compose, nastavitev vedra in S3 odjemalec. Datoteke so shranjene v mapi `backend/uploads/` (izključena iz Gita) z enako strukturo ključev kot v ADR 0002: `clients/<slug>/<leto>/<mesec>/<id>.<končnica>`. Vsa koda za shranjevanje in branje datotek je v enem modulu, zato je za prehod na MinIO treba zamenjati samo ta modul. Model `document` ostane nespremenjen (`storage_key`, `mime_type`, `size_bytes`, `sha256`).

ADR 0002 ostaja ciljna rešitev; ta odločitev velja samo za MVP.

### Posledice

* Dobro, ker MVP ne potrebuje dodatne storitve in nastavitev.
* Dobro, ker je prehod na MinIO omejen na en modul.
* Slabo, ker datoteke ni mogoče prenesti prek podpisane povezave; API jih pošlje sam, po preverjanju pravic.
* Slabo, ker datoteke niso v Docker volumnu in jih je treba ob selitvi prenesti ročno.

### Potrditev

Shranjevanje datotek je v enem modulu zaledja; drugi deli kode ne uporabljajo neposredno datotečnega sistema za datoteke računov.
