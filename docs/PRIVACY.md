# Privatliv

Horton Tracker har ingen egen backend, brugerkonto, analytics, annoncer, cookies eller telemetri. Appkoden hostes som statiske filer.

## Lokal brug

Helbredsdata behandles i browseren og lagres i IndexedDB for den konkrete website-origin. Som standard er de ukrypterede; brugeren kan aktivere kryptering med adgangssætning i appens indstillinger. Repository-ejeren og GitHub Pages modtager ikke formularindholdet. Som almindelig webhost kan GitHub behandle tekniske anmodningsdata, når statiske filer hentes; se GitHubs egne vilkår og privatlivspolitik.

## Valgfri Microsoft-forbindelse

Når brugeren aktivt forbinder OneDrive:

- Microsoft håndterer login og OAuth-tokens;
- en backup uploades til appens særlige OneDrive-mappe; den er krypteret kun, hvis brugeren har slået kryptering til;
- Microsoft kan se filnavn, størrelse og tidsstempler, og kan læse indholdet, hvis kryptering er slået fra;
- Horton Tracker anmoder kun om `Files.ReadWrite.AppFolder` til filer og kan ikke bladre i andre OneDrive-filer;
- når live sync er slået til, uploades lokale ændringer automatisk, og appen kontrollerer for ændringer fra andre enheder cirka hvert 15. sekund, mens den er synlig og online;
- forbindelsen kan afbrydes ved at lukke browsersessionen eller vælge **Afbryd**.

Adgang til appen kan også tilbagekaldes i Microsoft-kontoens side for apps og tjenester. Tidligere uploadede plaintext-backups krypteres ikke automatisk, når kryptering aktiveres; en ny backup skal uploades for at erstatte dem.

## Valgfri Google Drive-forbindelse

Når brugeren aktivt forbinder Google Drive:

- Google håndterer login og udsteder et kortlivet OAuth-token;
- backup gemmes i appens skjulte `appDataFolder`; den er krypteret kun, hvis brugeren har slået kryptering til;
- Google kan se filnavn, størrelse og tidsstempler, og kan læse indholdet, hvis kryptering er slået fra;
- Horton Tracker anmoder kun om `drive.appdata`, ikke adgang til øvrige Drive-filer;
- når live sync er slået til, uploades lokale ændringer automatisk, og appen kontrollerer for ændringer fra andre enheder cirka hvert 15. sekund, mens den er synlig og online;
- tokenet findes kun i `sessionStorage` og forsvinder, når browsersessionen afsluttes.

Brugeren kan afbryde sessionen i appen eller tilbagekalde adgang i Google-kontoens sikkerhedsindstillinger. Drive-appmappen slettes ikke automatisk, når lokale data slettes. Tidligere uploadede plaintext-backups krypteres ikke automatisk, når kryptering aktiveres.

## Eksport

CSV og klinikrapport er bevidst ukrypterede, så de kan læses af en neurolog. Brugeren er selv dataansvarlig for eksportfilen og bør vælge en sikker delingskanal.

## Sletning

**Indstillinger → Slet alt lokalt** fjerner den lokale boks. Browserens sletning af websitedata har samme effekt. Cloud-backups slettes ikke automatisk; OneDrive-backup fjernes i OneDrive-appmappen, og Google Drive-appdata fjernes via Google-kontoens apps/adgang.
