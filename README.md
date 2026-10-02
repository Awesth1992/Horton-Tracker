# Horton Tracker

En GitHub Pages-klar, installerbar PWA til personlig registrering af Hortons-hovedpine. Appen er statisk, offline-first og uden egen server. Alle helbredsdata krypteres i browseren, før de skrives til IndexedDB eller valgfrit sikkerhedskopieres til brugerens personlige OneDrive.

> **Ikke medicinsk udstyr.** Horton Tracker understøtter egenregistrering og dialog med en sundhedsprofessionel. Den giver ikke diagnose eller behandlingsråd.

## Det får du

- Den komplette danske anfaldsformular fra `Hortons_Anfaldsregistrering_Kravspecifikation.docx`, inklusive alle svarmuligheder.
- Validering af de strukturerede spørgsmål og konsistenskontrol mellem behandling og effekt.
- Automatisk varighed fra start-/sluttid, også når et anfald går over midnat, eller direkte varighed i minutter.
- Lokal offline lagring i IndexedDB, krypteret med AES-256-GCM.
- Nøgleafledning med PBKDF2-HMAC-SHA-256, 310.000 iterationer og en tilfældig 128-bit salt.
- Historik, redigering, sletning, søgning, datofiltre og simple mønstre.
- Krypteret backup/gendannelse som fil.
- Valgfri krypteret backup i OneDrive-appmappen via Microsoft Graph og **kun** `Files.ReadWrite.AppFolder`.
- CSV-eksport og udskrifts-/PDF-venlig klinikrapport til neurolog.
- Responsivt layout til telefon, tablet og computer samt service worker/manifest til installation.

## Filstruktur

```text
horton-tracker/
├── index.html
├── app.js
├── styles.css
├── manifest.webmanifest
├── sw.js
├── .nojekyll
├── icons/
├── docs/
│   ├── QUESTIONNAIRE.md
│   ├── SECURITY.md
│   ├── PRIVACY.md
│   └── DATA-FORMAT.md
├── tests/
│   └── smoke_test.py
├── LICENSE
└── README.md
```

Der er ingen build-proces, npm-afhængigheder, CDN'er, cookies eller analytics.

## Hurtig lokal afprøvning

Service workers virker ikke korrekt ved at dobbeltklikke på `index.html`. Kør i stedet en lokal server:

```bash
cd horton-tracker
python3 -m http.server 8080
```

Åbn `http://localhost:8080/`. `localhost` behandles som en sikker kontekst af moderne browsere. Første gang skal du oprette en adgangssætning på mindst 10 tegn.

## Udrulning på GitHub Pages

1. Opret et repository på GitHub, fx `horton-tracker`.
2. Kopiér **indholdet** af denne mappe til repository-roden og push til `main`.
3. Gå til **Settings → Pages**.
4. Under **Build and deployment** vælges **Deploy from a branch**.
5. Vælg branch `main`, mappe `/(root)`, og gem.
6. Vent på Pages-deploymenten. Appen ligger typisk på:
   `https://DIT-BRUGERNAVN.github.io/horton-tracker/`
7. Åbn URL'en, opret din boks, og brug browserens **Installér app** eller **Føj til hjemmeskærm**.

`.nojekyll` er inkluderet, og alle appstier er relative, så projektet virker under et GitHub Pages-repository-prefix.

### Opdatering

Push ændringer til den publicerede branch. Ved ændringer i cachede appfiler skal cache-navnet øverst i `sw.js` ændres (fx `horton-tracker-v1.0.1`), så eksisterende installationer modtager den nye version. Test altid backup/gendannelse før større ændringer i datamodellen.

## Opsætning af personlig OneDrive

OneDrive er **valgfri**. Appen fungerer fuldt lokalt uden Microsoft-konto.

### 1. Opret din egen appregistrering

1. Åbn Microsoft Entra admin center og gå til **Identity → Applications → App registrations → New registration**.
2. Navngiv appen, fx `Horton Tracker – personlig`.
3. Vælg en supported account type, der omfatter personlige Microsoft-konti. Til kun privat OneDrive er appens standard-authority `consumers`; vælg `common` i Horton Tracker, hvis registreringen også skal bruges med arbejds-/skolekonti.
4. Opret registreringen, og kopiér **Application (client) ID**.
5. Gå til **Authentication → Add a platform → Single-page application**.
6. Tilføj den præcise HTTPS-URL, som Horton Tracker viser under **Indstillinger → Microsoft OneDrive**, fx `https://DIT-BRUGERNAVN.github.io/horton-tracker/`.
7. Slå ikke implicit grant til. Horton Tracker bruger Authorization Code Flow med PKCE.
8. Opret **ikke** en client secret. En hemmelighed kan ikke beskyttes i en browserapp og er ikke nødvendig for en SPA.

### 2. Begræns Graph-tilladelsen

1. Gå til **API permissions → Add a permission → Microsoft Graph → Delegated permissions**.
2. Tilføj kun `Files.ReadWrite.AppFolder`.
3. Fjern `User.Read`, hvis portalen automatisk har tilføjet den, og du ønsker den beskrevne minimumsopsætning.
4. `openid`, `profile` og `offline_access` er OpenID Connect-scopes til selve login-sessionen; de giver ikke adgang til andre OneDrive-filer.

`Files.ReadWrite.AppFolder` begrænser filadgangen til appens særlige appmappe. Horton Tracker bruger Microsoft Graph-stien `me/drive/special/approot` og filen `horton-tracker.vault.json`.

### 3. Forbind i appen

1. Åbn **Indstillinger** i Horton Tracker.
2. Indsæt Application (client) ID.
3. Vælg `consumers`, `common` eller `organizations` efter appregistreringens supported account types.
4. Kontrollér, at den viste redirect-URI er registreret præcist i Entra, og gem.
5. Åbn **Backup → Forbind Microsoft-konto**.
6. Giv samtykke til appmappetilladelsen.
7. Vælg **Backup nu**. Kun den allerede krypterede vault-envelope uploades.

Microsoft-tokens ligger kun i `sessionStorage` og forsvinder, når browsersessionen afsluttes. Adgangssætningen og krypteringsnøglen sendes aldrig til Microsoft.

## Daglig brug

### Registrér et anfald

1. Vælg **Nyt anfald**.
2. Udfyld spørgsmål 1–10; spørgsmål 11 (noter) er valgfrit.
3. Vælg sluttid eller direkte varighed. En sluttid før/lig med starttid tolkes som næste døgn.
4. Gem. Hele boksen genkrypteres med en ny AES-GCM nonce og gemmes lokalt.

### Backup og gendannelse

- **Hent backupfil:** downloader den krypterede envelope. Gem filen et sikkert sted.
- **Gendan fra fil:** erstatter den lokale boks efter bekræftelse og kræver backupfilens adgangssætning.
- **OneDrive Backup nu:** uploader den samme krypterede envelope til appmappen.
- **OneDrive Gendan:** henter appmappefilen og kræver dens adgangssætning.

Tag altid en ny backup efter ændring af adgangssætning. En gammel backup bruger fortsat den gamle adgangssætning.

### Eksport til neurolog

- **CSV:** semikolonsepareret UTF-8 med BOM, egnet til dansk Excel. Multi-select-værdier adskilles med semikolon inde i cellen.
- **Klinikrapport:** åbner et udskriftsvenligt A4-landskabsformat. Brug browserens udskriftsdialog til at gemme som PDF.

Begge eksporttyper er **ukrypterede**. Del dem kun via en passende sikker kanal.

## Validering

Spørgsmål 1–10 skal udfyldes. Derudover gælder:

- varighed skal være 1–1.440 minutter;
- mindst ét symptom eller “Ingen af ovenstående”;
- hvis anfaldet vækkede brugeren, skal søvntype vælges;
- mindst én trigger eller “Ingen åbenlyse triggere”;
- mindst én behandling eller “Tog ingen medicin”;
- “Tog ingen medicin” kræver effekten “Ikke relevant (tog ikke medicin)”;
- registreret behandling må ikke kombineres med “Ikke relevant”.

“ingen”-valgene er gensidigt udelukkende med de øvrige valg i samme gruppe.

## Installation

- **Chrome/Edge på computer eller Android:** brug installationsikonet i adresselinjen eller appens download-ikon, når browseren tilbyder det.
- **Safari på iPhone/iPad:** Del → **Føj til hjemmeskærm**.
- **Offline:** Åbn appen én gang online efter deployment. App-shell og ikoner caches. Lokal registrering, historik, indblik, backupfil og eksport virker derefter offline. Microsoft-login og OneDrive kræver netforbindelse.

## Test

Kør smoke-testen med Python Playwright installeret:

```bash
python3 -m http.server 8080 &
python3 tests/smoke_test.py
```

Testen opretter en ny krypteret boks i en isoleret browserkontekst, validerer et komplet anfald, genindlæser siden og kontrollerer, at data kan dekrypteres igen.

## Drift og datatab

- Browserens “ryd websitedata” sletter IndexedDB. Brug backup.
- Adgangssætningen kan ikke gendannes. Uden den er krypterede data matematisk utilgængelige.
- GitHub-repositoriet indeholder kun appkode, aldrig brugerdata.
- En OneDrive-backup slettes ikke, når lokale data slettes.
- Appen synkroniserer ikke automatisk mellem samtidige enheder. Brug **Backup nu** og **Gendan** bevidst for at undgå at overskrive nyere data.

Se [docs/SECURITY.md](docs/SECURITY.md), [docs/PRIVACY.md](docs/PRIVACY.md), [docs/DATA-FORMAT.md](docs/DATA-FORMAT.md) og [docs/QUESTIONNAIRE.md](docs/QUESTIONNAIRE.md) for detaljer.
