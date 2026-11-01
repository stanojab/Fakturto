---
status: sprejeto
date: 2026-10-12
---

# Datoteke računov v objektni shrambi (MinIO), ne v podatkovni bazi

## Kontekst in opis problema

Vsak račun ima vsaj eno izvirno datoteko (PDF ali fotografijo s telefona), pogosto pa še popravljen izvirnik in potrdilo o plačilu. Datoteke so velike od nekaj sto kilobajtov do več megabajtov, hraniti jih moramo dolgoročno (arhiv), stranka in računovodja pa jih morata hitro odpreti v brskalniku. Odločiti se moramo, kje in kako bomo te datoteke hranili.

## Dejavniki odločitve

* Podatkovna baza naj ostane majhna in hitra (varnostne kopije, poizvedbe, migracije).
* Število datotek bo stalno raslo – vsak mesec za vsako stranko.
* Datoteke morajo biti dostopne samo upravičenim uporabnikom.
* Do datoteke morata dostopati API in worker (branje podatkov).
* Lokalni razvoj mora delovati brez plačljivih storitev v oblaku.
* Kasnejši prehod v produkcijo naj ne zahteva spreminjanja kode.

## Obravnavane alternative

* Objektna shramba, združljiva s S3 (MinIO lokalno)
* Hramba datotek v podatkovni bazi (`BYTEA`)
* Lokalni datotečni sistem strežnika
* Neposredno AWS S3 tudi pri razvoju

## Sprejeta odločitev

Izbrana alternativa: »Objektna shramba, združljiva s S3 (MinIO)«, ker loči velike binarne podatke od relacijskih podatkov, je skupna API-ju in workerju, deluje lokalno v Dockerju brez stroškov in uporablja standardni protokol S3, zato lahko kasneje brez spremembe kode preidemo na katerokoli S3 storitev v oblaku. V bazi hranimo samo metapodatke datoteke (`storage_key`, `mime_type`, `size_bytes`, `sha256`).

### Posledice

* Dobro, ker baza ostane majhna, varnostne kopije in migracije pa hitre.
* Dobro, ker frontend lahko datoteko prenese neposredno iz shrambe prek časovno omejene podpisane povezave, brez obremenjevanja API-ja.
* Dobro, ker lahko API in worker (ločena procesa) dostopata do istih datotek.
* Dobro, ker zgoščena vrednost `sha256` v bazi omogoča zaznavanje podvojenih datotek in preverjanje, da izvirnik ni bil spremenjen.
* Slabo, ker imamo dodatno storitev, ki jo je treba zagnati, nadzorovati in varnostno kopirati.
* Slabo, ker zapis v bazo in v shrambo nista v isti transakciji – ob napaki lahko nastanejo osirotele datoteke, ki jih je treba občasno počistiti.

### Potrditev

Model `document` hrani samo ključ in metapodatke datoteke; v kodi ni tipa `Bytes` za vsebino datotek. Dostop do datotek poteka izključno prek podpisanih povezav, ki jih izda API po preverjanju pravic.

## Prednosti in slabosti alternativ

### Hramba v podatkovni bazi (`BYTEA`)

* Dobro, ker so podatki in datoteka v isti transakciji in eni varnostni kopiji.
* Slabo, ker baza hitro raste, kar upočasni varnostne kopije in obnovo.
* Slabo, ker mora vsaka datoteka potovati skozi API, kar ga obremenjuje.

### Lokalni datotečni sistem strežnika

* Dobro, ker je najenostavnejša za implementacijo.
* Slabo, ker si ločeni vsebniki (API, worker) ne delijo datotečnega sistema brez dodatne nastavitve.
* Slabo, ker ne omogoča podpisanih povezav in je ob prehodu v oblak potrebno spremeniti kodo.

### Neposredno AWS S3

* Dobro, ker ni treba vzdrževati lastne shrambe.
* Slabo, ker vsak razvijalec potrebuje račun in ključe za AWS ter morebitne stroške; lokalni zagon brez interneta ni mogoč.

## Dodatne informacije

Struktura ključev v shrambi: `clients/<slug>/<leto>/<mesec>/<id>.<končnica>`. Glej tudi [03 – Podatkovni model](../03-podatkovni-model.md) in [04 – Arhitektura](../04-arhitektura-in-tehnoloski-sklad.md).
