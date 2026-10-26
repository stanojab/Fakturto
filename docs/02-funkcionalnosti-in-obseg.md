# Funkcionalnosti in obseg

## Uporabniške vloge

Vloga predstavlja nabor pravic, ne nujno ločene osebe. En uporabnik ima lahko več vlog. V računovodskem servisu z enim zaposlenim je na primer računovodja hkrati tudi administrator.

### 1. Lastnik ali direktor podjetja stranke

**Lahko:**
- nalaga račune (PDF ali fotografija) za svoje podjetje,
- vidi seznam računov svojega podjetja in njihove statuse,
- dopolni ali ponovno naloži račun, ki ga je računovodja vrnil.
- označi račun kot plačan, če ima podjetje nastavljeno, da račune plačuje samo.

**Nima pravic:**
- videti računov drugih podjetij,
- upravljati uporabnikov.
- dostopati do revizijske sledi in nastavitev računovodskega servisa.

### 2. Računovodja

Zaposleni v računovodskem servisu, ki obdeluje in plačuje račune strank.

**Lahko:**
- vidi in obdeluje račune strank, ki so mu dodeljene,
- pregleda prebrane podatke, jih popravi in potrdi,
- vrne račun stranki z razlogom (npr. neberljiva slika),
- označi odobren račun kot plačan z datumom plačila,
- uporablja nadzorno ploščo rokov plačila in arhiv svojih strank,
- naloži račun v imenu stranke (npr. ko ga stranka prinese osebno).

**Nima pravic:**
- videti strank, ki mu niso dodeljene,
- izbrisati računa ali spreminjati revizijske sledi,
- upravljati uporabnikov in dodeljevati strank.

### 3. Administrator

Lastnik ali vodja računovodskega servisa.

**Lahko:**
- ustvarja, ureja in deaktivira stranke in uporabnike,
- dodeljuje stranke računovodjem,
- nastavi način plačila za posamezno stranko (plača računovodja / plača stranka),
- vidi vse stranke, vse račune in celotno revizijsko sled.

**Nima pravic:**
- spreminjati ali brisati zapisov v revizijski sledi,
- spreminjati vsebine izvirne datoteke računa,
- odobriti plačila v imenu stranke.

## Predvidene funkcionalnosti

Funkcionalnosti, označene z **[MVP]**, so del prve delujoče različice. Funkcionalnosti, označene z *(domensko specifična)*, so značilne za to rešitev in niso zgolj osnovne operacije nad podatki.

1. **[MVP] Nalaganje računov s strani stranke**
   Zaposleni pri stranki naloži račun kot PDF datoteko ali fotografijo, tudi neposredno s kamero telefona. Račun se samodejno uvrsti k pravi stranki ter po letu in mesecu.

2. **[MVP] Samodejno branje podatkov iz računa** *(domensko specifična)*
   Sistem v ozadju iz računa prebere izdajatelja, prejemnika, številko računa, datum izdaje, rok plačila, znesek, IBAN in sklic. Najprej poskusi prebrati UPN QR kodo, sicer uporabi model umetne inteligence za branje dokumentov. Za vsak podatek shrani tudi vir (QR koda, AI) in stopnjo zanesljivosti.

3. **[MVP] Pregled in potrditev podatkov ob izvirniku** *(domensko specifična)*
   Računovodja vidi sliko ali PDF računa ob prebranih podatkih, popravi napačne vrednosti in jih potrdi. Podatki z nizko zanesljivostjo so posebej označeni. Če račun ni uporaben, ga vrne stranki z razlogom.


4. **[MVP] Plačilo in evidenca plačila** *(domensko specifična)*
   Računovodja vidi seznam računov, pripravljenih za plačilo, razvrščen po roku plačila. Ob vsakem računu lahko z enim klikom kopira IBAN, znesek, sklic in namen plačila za vnos v spletno banko. Po plačilu račun označi kot plačan z datumom plačila in po želji priloži potrdilo banke.

5. **[MVP] Prijava, vloge in ločenost podatkov strank**
   Uporabniki se prijavijo z e-pošto in geslom. Vsak uporabnik vidi samo podatke, do katerih ima pravico. Stranka nikoli ne vidi računov drugih strank, računovodja pa le stranke, ki so mu dodeljene.

6. **Nadzorna plošča rokov plačila** *(domensko specifična)*
   Računovodja vidi račune, ki zapadejo v naslednjih dneh, in že zapadle neplačane račune, združene po strankah. Tako nobenemu računu ne poteče rok po pomoti.

7. **Zaznavanje podvojenih računov** *(domensko specifična)*
   Sistem opozori, če je bila ista datoteka že naložena (primerjava zgoščene vrednosti SHA-256) ali če račun z isto številko in istim izdajateljem pri tej stranki že obstaja. S tem se prepreči dvojno plačilo.

8. **Arhiv računov po strankah z iskanjem**
    Pregled računov v obliki map (stranka → leto → mesec) ter iskanje in filtriranje po izdajatelju, znesku, statusu in časovnem obdobju.

9. **Nastavitev načina plačila po stranki** *(domensko specifična)*
    Administrator za vsako stranko določi, ali račune plačuje računovodja ali stranka sama. Glede na nastavitev sistem dovoli korak »označi kot plačano« ustrezni vlogi.

10. **Obvestila ob spremembah**
    Uporabniki prejmejo obvestilo v aplikaciji in e-poštno sporočilo, ko: 
      Stranka ko je račun plačan; 
      Stranka je račun vrnjen (če ni jasen);
      Računovodja- je račun naložen.

11. **Izvoz arhiva in podatkov**
    Prenos vseh računov stranke za izbrano obdobje kot ZIP datoteke z enako strukturo map kot v aplikaciji ter tiskanje računov .

## Kasnejše nadgradnje

1. **Izdajanje računov s predlogo**
   Stranka ali računovodja v imenu stranke lahko izda račun svojemu kupcu. Uporabnik izbere predlogo, vnese kupca, postavke, količine, cene in DDV, sistem pa samodejno izračuna zneske, dodeli zaporedno številko računa in pripravi PDF, da ga kupec lahko enostavno plača. Podatki o izdajatelju (naziv, naslov, davčna številka, IBAN) se izpolnijo samodejno iz podatkov stranke. Izdani računi se hranijo ločeno od prejetih in imajo svoj status (izdan, poslan, plačan).

2. **Namizna aplikacija za računovodjo**
   Različica za namizje, ki samodejno sinhronizira arhiv računov v mapo na računalniku in omogoča pregled starejših računov brez internetne povezave.

3. **Mobilna aplikacija za stranko**
   Stranka lahko prek mobilne aplikacije fotografira račun s kamero telefona ali naloži obstoječi dokument v obliki PDF oziroma slike

4. **Prejemanje računov po e-pošti**
   Vsaka stranka dobi svoj e-poštni naslov. Računi, posredovani na ta naslov, se samodejno naložijo k pravi stranki.

5. **Pregled stroškov za stranko**
   Grafi in povzetki stroškov po dobaviteljih in mesecih, ki stranki pomagajo spremljati poslovanje.

6. **Večjezičnost**
   Uporabniški vmesnik v slovenščini in angleščini.

## Izven obsega (Out of scope)

- Rešitev **ne izvaja dejanskih plačil** prek banke. Neposredna povezava z bankami  zahteva licence in certifikate, zato računovodja plačilo izvede sam v spletni banki.
- Rešitev **ni program za knjiženje**: ne vodi glavne knjige, ne pripravlja obračuna DDV, bilanc in drugih računovodskih izkazov.
- Rešitev **ne vključuje obračuna plač** in drugih kadrovskih storitev.
- Rešitev **ne poroča davčni upravi** (FURS, eDavki) in ne nadomešča davčnega potrjevanja računov.
- **Izdajanje računov** v prvi različici ni podprto; rešitev obravnava samo prejete račune (izdajanje je predvideno kot nadgradnja).
- Podprta je **samo valuta EUR**; računi v tujih valutah in tečajne razlike niso obravnavani.
- **Ni izvornih mobilnih aplikacij** (iOS, Android); rešitev deluje kot odzivna spletna aplikacija v brskalniku telefona.
- **Branje ročno napisanih računov** ni podprto oziroma ni zagotovljeno.
