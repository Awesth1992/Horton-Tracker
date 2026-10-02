# Spørgeskema og validering

Denne fil dokumenterer de felter og svarmuligheder, som er bevaret fra `Hortons_Anfaldsregistrering_Kravspecifikation.docx`.

1. **Dato for anfald** — datovælger.
2. **Starttidspunkt (tt:mm)** — tidsvælger.
3. **Sluttidspunkt eller varighed i minutter** — tidsvælger eller tal; appen beregner varighed.
4. **Hvilken side ramte smerten?** — ét valg:
   - Højre side
   - Venstre side
   - Begge sider (Konstant)
   - Begge sider (Skiftede undervejs)
5. **Smerteintensitet (Maksimal styrke under anfaldet)** — ét valg:
   - 1 - Skygge / murren (Begyndende tegn, ikke fuldt anfald)
   - 2 - Mild (Kan udholdes uden akut medicin)
   - 3 - Medium (Hæmmer mine aktiviteter)
   - 4 - Kraftigt (Decideret, invaliderende anfald)
   - 5 - Maksimal / ubærlig smerte
6. **Hvilke symptomer oplevede du på den smertende side?** — flere valg:
   - Rindende eller rødt øje
   - Gummer/tandkød
   - Spændinger I skulder/nakke
   - Øm hovedbund
   - Hængende eller hævet øjenlåg
   - Mindre pupil
   - Stoppet eller løbende næse
   - Svedtendens i ansigtet eller panden
   - Rastløshed / Trang til at vandre hvileløst rundt
   - Ingen af ovenstående
7. **Vækkede anfaldet dig fra din søvn?** — Ja/Nej. Ved Ja: Nattesøvn/hovedsøvn eller middagslur/hvile i løbet af dagen.
8. **Mulige triggere inden for de sidste 4 timer** — flere valg:
   - Alkohol
   - Nikotin / Cigaretter
   - Kaffe / Koffein
   - Kraftig eller stærk mad
   - Skarpt lys / Skærmarbejde
   - Stærke lugte (parfume, maling etc.)
   - Fysisk anstrengelse
   - Ingen åbenlyse triggere
9. **Hvilken akut medicin eller behandling tog du?** — flere valg:
   - Sumatriptan
   - Pamol
   - Pinex
   - Pamol/Paracetamol
   - Ibuprofen
   - Treo
   - Ilt
   - Tog ingen medicin
10. **Hvor hurtigt virkede den akutte behandling?** — ét valg:
    - Inden for 10-15 minutter (Fuld eller stor effekt)
    - Inden for 30 minutter
    - Tog mere end 30 minutter
    - Ingen effekt overhovedet
    - Ikke relevant (tog ikke medicin)
11. **Eventuelle bemærkninger eller noter** — valgfri fritekst, højst 4.000 tegn.

## Implementeret validering

Spørgsmål 1–10 er obligatoriske; noter er valgfri. Varigheden er 1–1.440 minutter. “Ingen”-valg er eksklusive. Søvntype er obligatorisk ved Ja. Behandling og effekt kontrolleres for logisk sammenhæng.
