---
status: sprejeto
date: 2026-10-12
---

# Branje podatkov iz računa kot opravilo v ozadju (pg-boss)

## Kontekst in opis problema

Po nalaganju računa mora sistem iz datoteke prebrati podatke za plačilo: pretvoriti PDF v sliko, poiskati UPN QR kodo in po potrebi poslati dokument zunanjemu modelu AI. Klic modela AI traja nekaj sekund, zunanja storitev pa je lahko občasno nedosegljiva ali omeji število zahtevkov. Odločiti se moramo, kdaj in kje se to branje izvede ter kako ravnamo ob napakah.

## Dejavniki odločitve

* Uporabnik po nalaganju ne sme čakati na konec branja (stranka lahko naloži več računov zapored).
* Neuspelo branje se mora samodejno ponoviti, račun pa se ne sme izgubiti.
* Dolgotrajne operacije ne smejo blokirati API-ja za ostale uporabnike.
* Čim manj dodatne infrastrukture za majhno ekipo in enostaven lokalni zagon.
* Ista vrsta naj služi tudi drugim opravilom (zaznavanje podvojitev, pošiljanje obvestil).

## Obravnavane alternative

* Vrsta opravil v PostgreSQL (pg-boss) z ločenim procesom worker
* Sinhrono branje znotraj HTTP zahtevka za nalaganje
* Vrsta opravil BullMQ z Redisom
* Posrednik sporočil (RabbitMQ)

## Sprejeta odločitev

Izbrana alternativa: »Vrsta opravil v PostgreSQL (pg-boss) z ločenim procesom worker«, ker loči dolgotrajno branje od zahtevka uporabnika, omogoča samodejno ponavljanje neuspelih opravil in ne zahteva nobene nove storitve, saj uporablja bazo PostgreSQL, ki jo že imamo ([ADR-0001](0001-postgresql-kot-podatkovna-baza.md)). API po nalaganju ustvari račun s statusom `UPLOADED` in doda opravilo v vrsto – v isti transakciji, zato opravilo ne more »izginiti«. Worker teče kot ločen proces iz iste kode.

### Posledice

* Dobro, ker API takoj vrne odgovor in uporabnik lahko nadaljuje z delom.
* Dobro, ker se neuspela opravila samodejno ponovijo (npr. ob časovni omejitvi storitve AI).
* Dobro, ker je dodajanje opravila v vrsto in ustvarjanje računa v isti transakciji – ni stanja, kjer račun obstaja, opravilo pa ne.
* Dobro, ker worker lahko skaliramo ločeno od API-ja.
* Slabo, ker frontend ne dobi rezultata takoj in mora status računa periodično preverjati (polling).
* Slabo, ker je zmogljivost vrste v PostgreSQL nižja od namenskih rešitev; pri zelo velikem številu opravil bi bilo treba odločitev ponovno presoditi.
* Slabo, ker je razhroščevanje asinhronega toka zahtevnejše kot pri sinhronem klicu.

### Potrditev

Endpoint za nalaganje ne kliče storitve AI neposredno; integracijski test preveri, da po nalaganju v vrsti obstaja opravilo za branje in da worker račun premakne v status `IN_REVIEW`.

## Prednosti in slabosti alternativ

### Sinhrono branje v HTTP zahtevku

* Dobro, ker je najenostavnejše za implementacijo in razhroščevanje.
* Slabo, ker uporabnik čaka več sekund, ob napaki storitve AI pa nalaganje ne uspe.
* Slabo, ker ni samodejnega ponavljanja in so niti strežnika zasedene med čakanjem.

### BullMQ z Redisom

* Dobro, ker je zelo zmogljiv in ima dober nadzorni vmesnik.
* Slabo, ker zahteva dodatno storitev (Redis) in opravilo ni v isti transakciji kot zapis računa v bazo.

### RabbitMQ

* Dobro, ker je robusten posrednik sporočil za velike sisteme.
* Slabo, ker je za naš obseg preveč zapleten – dodatna storitev, nastavitve in znanje.

## Dodatne informacije

Pogoj za ponovno presojo: če povprečna zakasnitev vrste preseže nekaj sekund ali obremenitev baze zaradi vrste postane opazna. Glej tudi [ADR-0004](0004-najprej-upn-qr-nato-ai.md).
