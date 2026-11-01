---
status: sprejeto
date: 2026-10-12
---

# Najprej branje UPN QR kode, nato model AI

## Kontekst in opis problema

Glavna vrednost Fakturka je, da računovodji ni treba ročno prepisovati IBAN-a, zneska, sklica in roka plačila v spletno banko. Ti podatki morajo biti točni, saj napaka pomeni napačno plačilo. Slovenski računi pogosto vsebujejo UPN QR kodo s strukturiranimi plačilnimi podatki, veliko računov (npr. tujih dobaviteljev ali fotografiranih) pa je nima. Odločiti se moramo, kako bomo podatke iz računov brali.

## Dejavniki odločitve

* Točnost plačilnih podatkov (IBAN, znesek, sklic).
* Stroški – vsak klic zunanjega modela AI je plačljiv.
* Pokritost – podpreti moramo tudi račune brez QR kode in fotografije.
* Sledljivost – računovodja mora vedeti, od kod podatek prihaja in koliko mu lahko zaupa.
* Aplikacija mora delovati tudi brez ključa za storitev AI (lokalni razvoj, testiranje).

## Obravnavane alternative

* Najprej UPN QR koda, šele nato model AI (kaskada)
* Samo model AI za vse račune
* Klasičen OCR (npr. Tesseract) in pravila/regularni izrazi
* Samo ročni vnos podatkov

## Sprejeta odločitev

Izbrana alternativa: »Najprej UPN QR koda, šele nato model AI«, ker so podatki iz UPN QR kode strukturirani, natančni in brezplačni za branje, model AI pa uporabimo samo za račune, ki kode nimajo. Tako dobimo najvišjo točnost pri najnižjih stroških in hkrati pokrijemo vse vrste računov. Za vsak podatek shranimo vir (`UPN_QR`, `AI`, `MANUAL`) in zanesljivost, končna potrditev pa je vedno na računovodji.

### Posledice

* Dobro, ker so pri računih z UPN QR kodo plačilni podatki praktično brez napak.
* Dobro, ker se število plačljivih klicev AI zmanjša na račune brez kode.
* Dobro, ker aplikacija deluje tudi brez ključa AI (bere samo QR kode, ostalo vnese računovodja), kar omogoča brezplačen lokalni razvoj.
* Dobro, ker vir in zanesljivost podatka omogočata, da vmesnik posebej označi negotove podatke.
* Slabo, ker moramo vzdrževati dve poti branja in ju združiti v enoten rezultat.
* Slabo, ker UPN QR koda ne vsebuje vseh podatkov (npr. številke računa ali davčne številke izdajatelja), zato je lahko kljub kodi potreben dodaten korak branja.
* Slabo, ker smo za račune brez kode odvisni od zunanje storitve AI in njenih sprememb.

### Potrditev

Testi s primeri računov z UPN QR kodo in brez nje preverijo, da se storitev AI pokliče samo, ko koda ni najdena, in da je polje `extraction_method` pravilno nastavljeno.

## Prednosti in slabosti alternativ

### Samo model AI

* Dobro, ker je ena sama, enostavnejša pot branja, ki prebere tudi ostale podatke.
* Slabo, ker je vsak račun plačljiv in ker lahko model »izmisli« ali napačno prebere IBAN tudi tam, kjer bi bila koda natančna.

### Klasičen OCR in pravila

* Dobro, ker je brezplačen in teče lokalno.
* Slabo, ker so računi zelo raznoliki po obliki; pravila bi bila krhka in bi pogosto odpovedala, posebej pri fotografijah.

### Samo ročni vnos

* Dobro, ker je najenostavnejši in brez zunanjih odvisnosti.
* Slabo, ker ne reši osnovnega problema – računovodja bi še vedno prepisoval podatke.

## Dodatne informacije

Odločitev je povezana z [ADR-0003](0003-branje-podatkov-kot-opravilo-v-ozadju.md), saj obe poti branja tečeta v workerju. Branje ročno napisanih računov je izven obsega (glej [02 – Funkcionalnosti in obseg](../02-funkcionalnosti-in-obseg.md)).
