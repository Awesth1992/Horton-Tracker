# Horton Tracker

En GitHub Pages-klar, installerbar PWA til personlig registrering af Hortons-hovedpine. Appen er statisk, offline-first og uden egen server. Data gemmes lokalt uden adgangskode som standard; du kan når som helst slå kryptering til for at beskytte den eksisterende boks og kræve adgangssætning ved efterfølgende opstarter.

> **Ikke medicinsk udstyr.** Horton Tracker understøtter egenregistrering og dialog med en sundhedsprofessionel. Den giver ikke diagnose eller behandlingsråd.

## Det får du

- Den komplette danske anfaldsformular fra `Hortons_Anfaldsregistrering_Kravspecifikation.docx`, inklusive alle svarmuligheder.
- Validering af de strukturerede spørgsmål og konsistenskontrol mellem behandling og effekt.
- Automatisk varighed fra start-/sluttid, også når et anfald går over midnat, eller direkte varighed i minutter.
- Lokal offline lagring i IndexedDB, ukrypteret som standard eller AES-256-GCM-krypteret efter eget valg.
- Ved aktiveret kryptering: nøgleafledning med PBKDF2-HMAC-SHA-256, 310.000 iterationer og en tilfældig 128-bit salt.
- Historik, redigering, sletning, søgning, datofiltre og simple mønstre.
- Backup/gendannelse som fil, med samme krypteringsstatus som den lokale boks.
- Valgfri OneDrive-backup via Microsoft Graph og **kun** `Files.ReadWrite.AppFolder`.
- Valgfri Google Drive-backup i appens skjulte mappe via Drive API og **kun** `drive.appdata`.
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

Der er ingen build-proces eller npm-afhængigheder. Google Identity Services indlæses fra Googles officielle script-host ved appstart; der bruges ingen cookies eller analytics.

## Hurtig lokal afprøvning

Service workers virker ikke korrekt ved at dobbeltklikke på `index.html`. Kør i stedet en lokal server:

```bash
cd horton-tracker
python3 -m http.server 8080
```

Åbn `http://localhost:8080/`. `localhost` behandles som en sikker kontekst af moderne browsere. Appen starter uden adgangssætning og opretter en ukrypteret lokal boks.

## Kryptering

Kryptering er valgfri og slået fra som standard, så appen kan startes uden adgangssætning og sikkerhedskopieres først. Data på enheden og i cloud-backups er da læsbare. Upload af ukrypterede cloud-backups kræver en ekstra bekræftelse.

Vælg **Indstillinger → Aktivér kryptering** for at kryptere hele den eksisterende lokale boks med AES-256-GCM. Vælg en adgangssætning på mindst 10 tegn. Kryptering kan ikke slås fra igen; adgangssætningen kræves ved hver efterfølgende opstart. Hvis du glemmer den, kan dataene ikke åbnes.

Aktivering krypterer ikke allerede uploadede cloud-backups eller tidligere downloadede filer. Kør **Backup nu** igen for at erstatte cloud-filen med den krypterede version, og slet eventuelle tidligere ukrypterede kopier.

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
7. Vælg **Backup nu**. Med kryptering slået til uploades den krypterede vault-envelope; ellers uploades data ukrypteret efter en ekstra bekræftelse.

Microsoft-tokens ligger kun i `sessionStorage` og forsvinder, når browsersessionen afsluttes. Når kryptering er slået til, sendes adgangssætningen og krypteringsnøglen aldrig til Microsoft.

## Google Drive

Google Drive er **valgfri**. Horton Tracker bruger én OAuth-klient, som appens ejer har konfigureret i Google Cloud. Brugere skal ikke oprette et Google Cloud-projekt eller indtaste et client ID; de skal blot forbinde deres egen Google-konto fra **Backup** og give samtykke.

OAuth-klienten skal have **Google Drive API** aktiveret, ekstern målgruppe og den autoriserede JavaScript-oprindelse `https://tracker.khwesth.dk`. Hvis hostingdomænet ændres, skal den nye oprindelse tilføjes i Google Cloud og client ID'et i appens `app.js` opdateres. Ved generel offentlig brug skal Google Auth Platform sættes til produktion, og konfigurationen skal opfylde Googles aktuelle krav til hjemmeside og privatlivspolitik.

Appen anmoder kun om `https://www.googleapis.com/auth/drive.appdata`, en ikke-følsom scope, der begrænser adgangen til appens egen skjulte Drive-mappe. Selve Google-login og brugersamtykke er stadig nødvendigt. Den korte levetid på Google-access-token kan betyde, at Google beder om ny godkendelse ved en senere backup eller gendannelse.

Backupens indhold følger appens krypteringsindstilling. Med kryptering slået fra er cloud-filen læsbar; aktiver kryptering, før du uploader helbredsdata, du vil beskytte.

## Daglig brug

### Registrér et anfald

1. Vælg **Nyt anfald**.
2. Udfyld spørgsmål 1–10; spørgsmål 11 (noter) er valgfrit.
3. Vælg sluttid eller direkte varighed. En sluttid før/lig med starttid tolkes som næste døgn.
4. Gem. Hele boksen gemmes lokalt, krypteret hvis kryptering er aktiveret.

### Backup og gendannelse

- **Hent backupfil:** downloader hele boksen. Filen er kun krypteret, hvis kryptering er slået til.
- **Gendan fra fil:** erstatter den lokale boks efter bekræftelse. En krypteret fil kræver sin adgangssætning; en ukrypteret fil gør ikke.
- **OneDrive Backup nu:** uploader boksen til appmappen, krypteret hvis kryptering er slået til.
- **OneDrive Gendan:** henter appmappefilen. En krypteret backup kræver sin adgangssætning.
- **Google Drive Backup nu/Gendan:** bruger kun Google Drives skjulte appmappe. Krypterede backups kræver adgangssætningen.

Tag altid en ny backup efter ændring af adgangssætning. En ældre krypteret backup bruger fortsat den gamle adgangssætning.

### Live sync på flere enheder

1. Forbind den samme OneDrive- eller Google-konto på hver enhed.
2. Slå **Hold denne enhed synkroniseret automatisk** til på hver enhed. Hvis kryptering er slået fra, bekræftes først, at cloud-filen bliver læsbar.
3. Hold appen åben og online. Lokale ændringer sendes automatisk efter en kort pause; ændringer fra andre enheder kontrolleres cirka hvert 15. sekund, når appen er synlig.

Poster flettes efter ID og seneste ændringstid; selvstændige poster fra flere enheder bevares. Sletninger synkroniseres også. Profilen bruger sin seneste ændringstid. Undgå at redigere samme post samtidigt på flere enheder; ved konflikt vinder den seneste tidsstemplede version. Status øverst og på cloud-kortene viser synkronisering, seneste succes eller behov for handling.

Når kryptering er slået til, skal enhederne bruge samme krypterede vault og adgangssætning. Gendan først den eksisterende cloud-backup på en ny enhed; opret ikke en separat krypteret boks med en anden adgangssætning. Google bruger kortlivede access-tokens; når tokenet udløber, viser appen, at kontoen skal forbindes igen. OneDrive-sessionen fornyes automatisk, når det er muligt.

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
- **Offline:** Åbn appen én gang online efter deployment. App-shell og ikoner caches. Lokal registrering, historik, indblik, backupfil og eksport virker derefter offline. Microsoft-login, Google-login og cloud-backup kræver netforbindelse.

## Test

Kør smoke-testen med Python Playwright installeret:

```bash
python3 -m http.server 8080 &
python3 tests/smoke_test.py
```

Testen starter uden adgangssætning, gemmer en komplet registrering ukrypteret, aktiverer kryptering og kontrollerer, at genindlæsning derefter kræver adgangssætningen, mens backupfilen ikke afslører registreringsdata.

## Drift og datatab

- Browserens “ryd websitedata” sletter IndexedDB. Brug backup.
- Kryptering er valgfri. Hvis den er slået til, kan adgangssætningen ikke gendannes, og uden den er krypterede data utilgængelige.
- GitHub-repositoriet indeholder kun appkode, aldrig brugerdata.
- En OneDrive-backup slettes ikke, når lokale data slettes.
- En Google Drive-backup slettes ikke, når lokale data slettes.
- Live sync er valgfri pr. enhed og kræver, at appen er åben og online. **Backup nu** og **Gendan** er fortsat tilgængelige som manuelle handlinger.

Se [docs/SECURITY.md](docs/SECURITY.md), [docs/PRIVACY.md](docs/PRIVACY.md), [docs/DATA-FORMAT.md](docs/DATA-FORMAT.md) og [docs/QUESTIONNAIRE.md](docs/QUESTIONNAIRE.md) for detaljer.
