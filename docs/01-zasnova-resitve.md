# Zasnova rešitve

## Ime rešitve

**Fakturko** – spletna platforma za zbiranje in obdelavo prejetih računov med računovodskim servisom in njegovimi strankami.

## Namen rešitve in problem, ki ga naslavlja

Manjši računovodski servisi za svoje stranke (podjetja in samostojne podjetnike) pogosto ne opravljajo le knjiženja, ampak tudi plačevanje prejetih računov prek spletne banke. V praksi to poteka zelo neorganizirano:

- stranke pošiljajo račune po različnih kanalih: osebno v papirnati obliki, po e-pošti, prek Vibra ali WhatsAppa, kot fotografije s telefona ali PDF datoteke;
- računi se izgubljajo v sporočilih in e-poštnih predalih, zato računovodja težko preveri, ali je prejel vse račune;
- računovodja mora podatke (IBAN, znesek, sklic, rok plačila) ročno prepisovati iz računa v spletno banko, kar je počasno in pred vsem lahko povzroča napake;
- ni jasne evidence, kateri računi so že plačani, kateri čakajo in katerim se izteka rok plačila;
- stranka ne ve, ali je bil njen račun že plačan, zato mora računovodjo klicati ali mu pisati;

**Fakturko** te težave rešuje tako, da vse prejete račune zbere na enem mestu, ločeno po strankah. Iz naloženega računa samodejno prebere podatke, potrebne za plačilo, uvede jasen postopek pregleda ter vodi evidenco o tem, kdo je kaj naredil in kdaj je bil račun plačan.

Rešitev ne nadomešča programa za knjiženje. Pokriva korak **pred knjiženjem**: zbiranje, branje, odobritev in plačilo računov ter njihovo urejeno hrambo.

## Ciljni uporabniki

1. **Računovodski servisi** , ki za svoje stranke vodijo poslovanje in plačujejo prejete račune. Računovodja aplikacijo uporablja vsak dan na računalniku v pisarni.
2. **Stranke računovodskega servisa** – mala podjetja in samostojni podjetniki (npr. obrtniki, trgovine, storitvene dejavnosti), ki prejemajo račune dobaviteljev in jih morajo posredovati računovodji:
3. **Administrator** (običajno lastnik računovodskega servisa), ki upravlja uporabnike, stranke in dodeljuje stranke računovodjem.

## Primer uporabe

Podjetje **VIAR d.o.o.** prejme račun dobavitelja za material v višini 1.240,00 €.

1. Zaposlena pri podjetju račun naloži v program. Ni ji treba pošiljati e-pošte ali sporočila na Viber.
2. Sistem račun shrani v mapo stranke VIAR d.o.o. in iz njega samodejno prebere podatke: izdajatelja, prejemnika, številko računa, datum izdaje, rok plačila, znesek, IBAN in sklic. Če ima račun UPN QR kodo, podatke prebere iz nje; sicer uporabi model umetne inteligence za branje dokumentov.
3. Računovodja v pregledu vidi sliko računa ob prebranih podatkih, popravi morebitne napake in podatke potrdi.
4. Lastnik podjetja VIAR prejme obvestilo.
5. Račun se računovodji prikaže na seznamu računov, pripravljenih za plačilo, razvrščen po roku plačila. Računovodja s klikom kopira IBAN, znesek in sklic v spletno banko, izvede plačilo in račun označi kot plačan z datumom plačila.
6. Stranka v aplikaciji vidi, da je bil račun plačan in kdaj. Račun ostane arhiviran in ga je mogoče kadarkoli poiskati.

## Kratek opis delovanja rešitve

Fakturko je spletna aplikacija, ki deluje v brskalniku na računalniku.

**Zbiranje računov:** stranka naloži račun kot PDF datoteko ali fotografijo. Vsak račun pripada točno določeni stranki, zato so računi samodejno urejeni po strankah, letih in mesecih.

**Samodejno branje podatkov:** sistem v ozadju iz računa prebere podatke, potrebne za plačilo in evidenco. Najprej poskusi prebrati UPN QR kodo (natančni podatki), če je ni, pa uporabi model umetne inteligence za branje dokumentov. Sistem opozori tudi na morebitne podvojene račune (isti izdajatelj in ista številka računa).

**Postopek obdelave računa:** vsak račun gre skozi jasno določene statuse:

`Naložen → V obdelavi → V pregledu → Pripravljen za plačilo → Plačan → Arhiviran`

**Način plačila po stranki:** za vsako stranko je mogoče nastaviti, ali račune plačuje računovodja (prek pooblastila za poslovni račun stranke) ali stranka sama. V drugem primeru stranka po plačilu račun sama označi kot plačan.

**Pregled rokov in evidenca:** računovodja na nadzorni plošči vidi račune, ki zapadejo v kratkem ali so že zapadli.

**Hramba:** izvirne datoteke računov se varno hranijo v objektni shrambi, podatki o računih pa v podatkovni bazi. Stranke vidijo izključno svoje račune.
