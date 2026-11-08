# Uporabniške zgodbe

Uporabniške zgodbe izhajajo iz funkcionalnosti v dokumentu `02-funkcionalnosti-in-obseg.md`. Uporabljene so vloge **Stranka**, **Računovodja** in **Administrator** ter statusi računa:

`Naložen → V obdelavi → V pregledu → Pripravljen za plačilo → Plačan → Arhiviran`, z vejo `V pregledu → Vrnjen stranki → V obdelavi`.

Zgodbe, označene z **MVP**, so del prve delujoče različice. Obseg MVP je bil zmanjšan (glej razdelek »Obseg MVP« v `02-funkcionalnosti-in-obseg.md`): US-02, US-04, US-05 in US-09 so prestavljene za MVP, pri US-08 je v MVP samo preverjanje prehodov v zaledju.

## Pregled

| Oznaka | Naslov | Vloga | Funkcionalnost | MVP |
|---|---|---|---|---|
| US-01 | Nalaganje računa | Stranka | Nalaganje računov s strani stranke | ✓ |
| US-02 | Samodejno branje podatkov | Računovodja | Samodejno branje podatkov iz računa | |
| US-03 | Pregled in potrditev podatkov | Računovodja | Pregled in potrditev podatkov ob izvirniku | ✓ |
| US-04 | Vrnitev računa stranki | Računovodja | Pregled in potrditev podatkov ob izvirniku | |
| US-05 | Ponovno nalaganje vrnjenega računa | Stranka | Potek obdelave s pravicami po vlogah | |
| US-06 | Seznam računov za plačilo | Računovodja | Plačilo in evidenca plačila | ✓ |
| US-07 | Označitev računa kot plačanega | Računovodja | Plačilo in evidenca plačila | ✓ |
| US-08 | Veljavni prehodi statusov | Administrator | Potek obdelave s pravicami po vlogah | ✓ |
| US-09 | Ustvarjanje uporabnika in povabilo | Administrator | Prijava, vloge in ločenost podatkov strank | |
| US-10 | Prijava in ločenost podatkov | Stranka | Prijava, vloge in ločenost podatkov strank | ✓ |
| US-11 | Nadzorna plošča rokov plačila | Računovodja | Nadzorna plošča rokov plačila | |
| US-12 | Opozorilo na podvojen račun | Računovodja | Zaznavanje podvojenih računov | |
| US-13 | Arhiv računov z iskanjem | Stranka | Arhiv računov po strankah z iskanjem | |
| US-14 | Dodelitev računovodij in način plačila | Administrator | Nastavitev načina plačila po stranki | |
| US-15 | Obvestila o vrnjenih in plačanih računih | Stranka | Obvestila ob spremembah | |
| US-16 | Izvoz arhiva stranke | Računovodja | Izvoz arhiva in podatkov | |

---

## US-01 – Nalaganje računa

- **Funkcionalnost:** Nalaganje računov s strani stranke (MVP)
- **Vloga:** Stranka

**Kot** stranka **želim** naložiti račun dobavitelja kot PDF datoteko ali fotografijo s telefona, **da** mi ga ni treba pošiljati računovodji po e-pošti ali Vibru.

**Kriteriji sprejemljivosti:**
- Sistem sprejme datoteke PDF, JPG in PNG velikosti do 10 MB. Pri drugi vrsti ali večji datoteki prikaže sporočilo »Podprte so datoteke PDF, JPG in PNG do 10 MB« in računa ne ustvari.
- Na telefonu je na voljo gumb »Fotografiraj račun«, ki odpre kamero naprave.
- Če je uporabnik član več podjetij, mora pred nalaganjem izbrati podjetje; račun se shrani k izbranemu podjetju.
- Po uspešnem nalaganju se račun v največ 2 sekundah prikaže na vrhu seznama »Moji računi« s statusom »V obdelavi«.
- Datoteka se shrani v objektno shrambo pod potjo `clients/<stranka>/<leto>/<mesec>/`, v bazi pa se ustvarita zapisa `invoice` in `document`.

## US-02 – Samodejno branje podatkov

- **Funkcionalnost:** Samodejno branje podatkov iz računa (po MVP)
- **Vloga:** Računovodja

**Kot** računovodja **želim**, da sistem podatke za plačilo iz naloženega računa prebere samodejno, **da** jih ne prepisujem ročno.

**Kriteriji sprejemljivosti:**
- Če ima račun UPN QR kodo, sistem iz nje izpolni IBAN, znesek, sklic, namen plačila in prejemnika ter kot vir podatkov zapiše `UPN_QR`.
- Če UPN QR kode ni, sistem dokument pošlje modelu AI in izpolni izdajatelja, davčno številko izdajatelja, številko računa, datum izdaje, rok plačila, znesek, IBAN in sklic. Za vsako polje shrani zanesljivost med 0 in 1.
- Po zaključenem branju se status računa spremeni v »V pregledu«. Pri datoteki do 10 MB se to zgodi v največ 60 sekundah po nalaganju.
- Če branje ne uspe niti po 3 poskusih, račun preide v »V pregledu« s praznimi polji in opombo »Samodejno branje ni uspelo, vnesite podatke ročno«.
- Če ključ za storitev AI ni nastavljen, sistem bere samo UPN QR kode, ostali računi pa preidejo v »V pregledu« s praznimi polji.

## US-03 – Pregled in potrditev podatkov

- **Funkcionalnost:** Pregled in potrditev podatkov ob izvirniku (MVP)
- **Vloga:** Računovodja

**Kot** računovodja **želim** videti izvirnik računa ob prebranih podatkih in jih po potrebi popraviti, **da** pred plačilom preverim, da so podatki pravilni.

**Kriteriji sprejemljivosti:**
- Zaslon prikazuje izvirnik računa (PDF ali sliko) z možnostjo povečave na levi in obrazec s prebranimi podatki na desni.
- Polja z zanesljivostjo branja pod 0,8 so obarvana rumeno in imajo opombo »Nizka zanesljivost branja – preverite na izvirniku«.
- Gumb »Potrdi podatke« deluje samo, če so izpolnjeni izdajatelj, IBAN, znesek in rok plačila. Manjkajoča polja so označena s sporočilom »Obvezen podatek«.
- IBAN se preveri po kontrolni vsoti (ISO 13616). Neveljaven IBAN ali znesek, ki ni večji od 0, prepreči potrditev z ustreznim sporočilom ob polju.
- Po potrditvi račun preide v status »Pripravljen za plačilo«, v polje `reviewed_by_id` pa se zapiše prijavljeni računovodja.

## US-04 – Vrnitev računa stranki

- **Funkcionalnost:** Pregled in potrditev podatkov ob izvirniku (po MVP)
- **Vloga:** Računovodja

**Kot** računovodja **želim** račun vrniti stranki z razlogom, **da** stranka ve, kaj mora popraviti, kadar je račun neberljiv, nepopoln ali napačen.

**Kriteriji sprejemljivosti:**
- Gumb »Vrni stranki« je na voljo samo pri računih s statusom »V pregledu«.
- Vnos razloga je obvezen in mora vsebovati vsaj 10 znakov.
- Po vrnitvi ima račun status »Vrnjen stranki«, razlog pa je shranjen v polju `status_reason`.
- Stranka razlog vidi pri računu na seznamu »Moji računi«.
- Vrnjen račun ni več prikazan na seznamu »Za pregled«.

## US-05 – Ponovno nalaganje vrnjenega računa

- **Funkcionalnost:** Potek obdelave s pravicami po vlogah (po MVP)
- **Vloga:** Stranka

**Kot** stranka **želim** k vrnjenemu računu naložiti novo datoteko, **da** se račun obdela naprej, ne da bi ustvarjala nov račun.

**Kriteriji sprejemljivosti:**
- Gumb »Naloži znova« je prikazan samo pri računih s statusom »Vrnjen stranki«.
- Nova datoteka se shrani kot nov zapis `document` vrste `ORIGINAL`; prejšnja datoteka ostane shranjena.
- Po nalaganju račun preide v status »V obdelavi« in samodejno branje podatkov se izvede znova.
- Razlog vrnitve se po ponovnem nalaganju ne prikazuje več pri računu.

## US-06 – Seznam računov za plačilo

- **Funkcionalnost:** Plačilo in evidenca plačila (MVP)
- **Vloga:** Računovodja

**Kot** računovodja **želim** videti vse račune, pripravljene za plačilo, razvrščene po roku plačila, in njihove podatke kopirati z enim klikom, **da** plačila v spletni banki opravim hitro in brez napak pri prepisovanju.

**Kriteriji sprejemljivosti:**
- Seznam vsebuje samo račune s statusom »Pripravljen za plačilo« pri strankah, ki so dodeljene prijavljenemu računovodji. Administrator vidi račune vseh strank.
- Računi so razvrščeni po roku plačila naraščajoče. Računi s preteklim rokom so označeni rdeče z besedilom »Zapadel pred X dnevi«.
- Ob IBAN-u, znesku in sklicu je gumb za kopiranje. Po kliku je vrednost v odložišču (IBAN brez presledkov, znesek v obliki `1240,00`), prikaže pa se obvestilo, npr. »IBAN kopiran«.
- Seznam je mogoče filtrirati po stranki in iskati po izdajatelju ali sklicu.
- Stran prikaže največ 20 računov, ostali so dostopni s straničenjem.

## US-07 – Označitev računa kot plačanega

- **Funkcionalnost:** Plačilo in evidenca plačila (MVP)
- **Vloga:** Računovodja

**Kot** računovodja **želim** račun po plačilu v spletni banki označiti kot plačan z datumom plačila, **da** imata servis in stranka jasno evidenco, kaj je plačano.

**Kriteriji sprejemljivosti:**
- Gumb »Označi kot plačano« odpre okno s povzetkom računa (stranka, izdajatelj, znesek, IBAN, sklic), poljem za datum plačila in neobveznim nalaganjem potrdila banke.
- Datum plačila je obvezen, privzeto je nastavljen na današnji datum in ne sme biti v prihodnosti.
- Naloženo potrdilo banke (PDF, JPG ali PNG do 10 MB) se shrani kot `document` vrste `PAYMENT_CONFIRMATION`.
- Po potrditvi ima račun status »Plačan«, shranita se `paid_on` in `paid_by_id`, račun pa ni več prikazan na seznamu »Za plačilo«.
- Stranka pri računu vidi besedilo »Plačan dne <datum>«.

## US-08 – Veljavni prehodi statusov

- **Funkcionalnost:** Potek obdelave s pravicami po vlogah (MVP)
- **Vloga:** Administrator

**Kot** administrator **želim**, da sistem dovoli samo vnaprej določene prehode statusov računa glede na vlogo uporabnika, **da** noben račun ne more biti označen kot plačan brez pregleda računovodje.

**Kriteriji sprejemljivosti:**
- Sistem dovoli samo prehode iz tabele prehodov v dokumentu `02-funkcionalnosti-in-obseg.md`. Vsak drug prehod API zavrne z odgovorom `409 Conflict`, status računa pa ostane nespremenjen.
- Če uporabnik poskusi prehod, ki za njegovo vlogo ni dovoljen (npr. stranka potrdi podatke), API vrne odgovor `403 Forbidden`.
- Uporabniški vmesnik prikaže samo gumbe za prehode, ki so dovoljeni za trenutni status in vlogo uporabnika.
- Podatkov računa s statusom »Plačan« ali »Arhiviran« ni mogoče več urejati.
- Pravila prehodov so definirana na enem mestu in pokrita z enotskimi testi za vsak dovoljen prehod in vsaj en nedovoljen prehod iz vsakega statusa.

## US-09 – Ustvarjanje uporabnika in povabilo

- **Funkcionalnost:** Prijava, vloge in ločenost podatkov strank (po MVP)
- **Vloga:** Administrator

**Kot** administrator **želim** ustvariti uporabniški račun in novemu uporabniku poslati povabilo, **da** do sistema dostopajo samo osebe, ki sodelujejo z računovodskim servisom.

**Kriteriji sprejemljivosti:**
- Obrazec zahteva ime in priimek, e-pošto in vlogo (Stranka, Računovodja ali Administrator). Pri vlogi Stranka je treba izbrati vsaj eno podjetje.
- Če uporabnik z isto e-pošto že obstaja, sistem prikaže sporočilo »Uporabnik s tem e-poštnim naslovom že obstaja« in novega uporabnika ne ustvari.
- Novi uporabnik prejme e-pošto s povezavo za nastavitev gesla, ki velja 72 ur in jo je mogoče uporabiti samo enkrat.
- Geslo mora imeti vsaj 10 znakov in se shrani zgoščeno z algoritmom Argon2.
- Aplikacija nima javne strani za registracijo.

## US-10 – Prijava in ločenost podatkov

- **Funkcionalnost:** Prijava, vloge in ločenost podatkov strank (MVP)
- **Vloga:** Stranka

**Kot** stranka se **želim** prijaviti z e-pošto in geslom ter videti samo račune svojih podjetij, **da** so moji poslovni podatki zaščiteni pred drugimi strankami.

**Kriteriji sprejemljivosti:**
- Pri napačni e-pošti ali geslu sistem vedno prikaže enako sporočilo »Napačna e-pošta ali geslo«, ne glede na to, kateri podatek je napačen.
- Po 5 zaporednih neuspelih poskusih je prijava za ta e-poštni naslov onemogočena 15 minut.
- Seznami računov vsebujejo samo račune podjetij, katerih član je uporabnik (prek tabele `client_membership`).
- Če stranka odpre povezavo do računa drugega podjetja (npr. z ročno spremembo URL-ja), API vrne odgovor `404 Not Found` in podatki računa niso prikazani.
- Deaktiviran uporabnik se ne more prijaviti, njegovi obstoječi žetoni pa so preklicani.

## US-11 – Nadzorna plošča rokov plačila

- **Funkcionalnost:** Nadzorna plošča rokov plačila
- **Vloga:** Računovodja

**Kot** računovodja **želim** na enem mestu videti zapadle račune in račune, ki zapadejo v kratkem, **da** noben račun ne ostane neplačan po roku.

**Kriteriji sprejemljivosti:**
- Nadzorna plošča prikazuje število zapadlih neplačanih računov in število računov, ki zapadejo v naslednjih 7 dneh.
- Upoštevani so samo računi s statusoma »V pregledu« in »Pripravljen za plačilo« pri strankah, dodeljenih računovodji.
- Klik na posamezno število odpre seznam ustreznih računov, razvrščen po roku plačila.
- Zapadli računi so združeni po strankah, pri vsaki stranki pa je prikazan skupni znesek zapadlih računov.

## US-12 – Opozorilo na podvojen račun

- **Funkcionalnost:** Zaznavanje podvojenih računov
- **Vloga:** Računovodja

**Kot** računovodja **želim** prejeti opozorilo, kadar je bil račun morda že naložen, **da** istega računa ne plačam dvakrat.

**Kriteriji sprejemljivosti:**
- Če ima naložena datoteka enako zgoščeno vrednost SHA-256 kot obstoječa datoteka pri isti stranki, se na zaslonu za pregled prikaže opozorilo »Ta datoteka je bila že naložena«.
- Če pri isti stranki obstaja račun z enako davčno številko izdajatelja in enako številko računa, se na zaslonu za pregled prikaže opozorilo s povezavo do obstoječega računa.
- Opozorilo ne prepreči potrditve: računovodja lahko račun potrdi ali ga vrne stranki z razlogom »Podvojen račun«.
- Preverjanje se izvede samodejno po zaključenem branju podatkov, brez dejanja uporabnika.

## US-13 – Arhiv računov z iskanjem

- **Funkcionalnost:** Arhiv računov po strankah z iskanjem
- **Vloga:** Stranka

**Kot** stranka **želim** pregledati vse svoje račune, urejene po letih in mesecih, in med njimi iskati, **da** hitro najdem starejši račun in preverim, ali je bil plačan.

**Kriteriji sprejemljivosti:**
- Arhiv prikazuje strukturo podjetje → leto → mesec, pri vsakem mesecu pa število računov.
- Iskanje deluje po izdajatelju in številki računa; delna ujemanja se prikažejo, ko uporabnik vnese vsaj 3 znake.
- Rezultate je mogoče filtrirati po statusu in obdobju (od–do datuma izdaje).
- Vsak rezultat prikazuje izdajatelja, znesek, datum izdaje, status in datum plačila, če je račun plačan.
- Klik na račun odpre izvirno datoteko prek začasne povezave, ki velja 5 minut.

## US-14 – Dodelitev računovodij in način plačila

- **Funkcionalnost:** Nastavitev načina plačila po stranki
- **Vloga:** Administrator

**Kot** administrator **želim** stranki dodeliti računovodje in nastaviti, kdo plačuje njene račune, **da** sistem upošteva dogovor, ki ga ima servis s posamezno stranko.

**Kriteriji sprejemljivosti:**
- Na strani stranke je mogoče dodati ali odstraniti dodeljene računovodje. Odstranjeni računovodja takoj izgubi dostop do računov te stranke.
- Način plačila je mogoče nastaviti na »Plača računovodja« ali »Plača stranka«; pri novi stranki je privzeto »Plača računovodja«.
- Pri načinu »Plača stranka« ima stranka pri računih s statusom »Pripravljen za plačilo« gumb »Označi kot plačano«, računovodja pa ga nima.
- Pri načinu »Plača računovodja« stranka gumba ne vidi, API pa njen poskus označitve plačila zavrne z odgovorom `403 Forbidden`.
- Sprememba načina plačila velja za vse še neplačane račune stranke.

## US-15 – Obvestila o vrnjenih in plačanih računih

- **Funkcionalnost:** Obvestila ob spremembah
- **Vloga:** Stranka

**Kot** stranka **želim** prejeti obvestilo, ko je moj račun vrnjen ali plačan, **da** računovodje ni treba klicati in spraševati o stanju računov.

**Kriteriji sprejemljivosti:**
- Ko račun preide v status »Vrnjen stranki«, vsi člani podjetja prejmejo obvestilo v aplikaciji in e-pošto z razlogom vrnitve.
- Ko račun preide v status »Plačan«, vsi člani podjetja prejmejo obvestilo v aplikaciji z datumom plačila.
- Število neprebranih obvestil je prikazano ob ikoni obvestil. Klik na obvestilo odpre račun in obvestilo označi kot prebrano.
- Uporabnik lahko v profilu izklopi e-poštna obvestila; obvestila v aplikaciji ostanejo vklopljena.

## US-16 – Izvoz arhiva stranke

- **Funkcionalnost:** Izvoz arhiva in podatkov
- **Vloga:** Računovodja

**Kot** računovodja **želim** prenesti vse račune stranke za izbrano obdobje, **da** imam lokalno kopijo ali podatke posredujem v program za knjiženje.

**Kriteriji sprejemljivosti:**
- Računovodja izbere stranko in obdobje (od–do), sistem pa pripravi datoteko ZIP z mapami `leto/mesec`.
- Datoteke v ZIP-u so poimenovane po vzorcu `<datum izdaje>_<izdajatelj>_<številka računa>.<končnica>`.
- ZIP vsebuje tudi datoteko `racuni.csv` s stolpci: izdajatelj, številka računa, datum izdaje, rok plačila, znesek, IBAN, sklic, status in datum plačila.
- Izvoz je mogoč samo za stranke, ki so dodeljene računovodji.
- Če v izbranem obdobju ni računov, sistem prikaže sporočilo »V izbranem obdobju ni računov« in datoteke ne pripravi.

---

## Skladnost z načeli INVEST

- **Independent (neodvisne):** zgodbe je mogoče razvijati ločeno. Na primer, US-06 (seznam za plačilo) in US-07 (označitev plačila) delujeta tudi brez US-02, saj lahko računovodja podatke vnese ročno.
- **Negotiable (pogajalne):** zgodbe opisujejo cilj, ne konkretne rešitve. Mejne vrednosti (npr. 0,8 za nizko zanesljivost, 20 računov na stran) je mogoče prilagoditi po pogovoru z uporabniki.
- **Valuable (vredne):** vsaka zgodba vsebuje razlog (»da …«), ki opisuje konkretno korist za stranko, računovodjo ali servis.
- **Estimable (ocenljive):** zgodbe se nanašajo na jasno določene zaslone, statuse in polja podatkovnega modela, zato je mogoče oceniti obseg dela.
- **Small (majhne):** večje funkcionalnosti so razdeljene na več zgodb, npr. pregled podatkov (US-03) in vrnitev računa (US-04) ali seznam za plačilo (US-06) in označitev plačila (US-07).
- **Testable (preverljive):** vsak kriterij sprejemljivosti opisuje preverljiv rezultat z mejnimi vrednostmi, besedili sporočil, statusi in odgovori API-ja.
