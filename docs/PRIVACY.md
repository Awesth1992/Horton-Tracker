# Privatliv

Horton Tracker har ingen egen backend, brugerkonto, analytics, annoncer, cookies eller telemetri. Appkoden hostes som statiske filer.

## Lokal brug

Helbredsdata behandles i browseren og lagres krypteret i IndexedDB for den konkrete website-origin. Repository-ejeren og GitHub Pages modtager ikke formularindholdet. Som almindelig webhost kan GitHub behandle tekniske anmodningsdata, når statiske filer hentes; se GitHubs egne vilkår og privatlivspolitik.

## Valgfri Microsoft-forbindelse

Når brugeren aktivt forbinder OneDrive:

- Microsoft håndterer login og OAuth-tokens;
- en krypteret fil uploades til appens særlige OneDrive-mappe;
- Microsoft kan se filnavn, størrelse og tidsstempler, men ikke det dekrypterede indhold;
- Horton Tracker anmoder kun om `Files.ReadWrite.AppFolder` til filer og kan ikke bladre i andre OneDrive-filer;
- forbindelsen kan afbrydes ved at lukke browsersessionen eller vælge **Afbryd**.

Adgang til appen kan også tilbagekaldes i Microsoft-kontoens side for apps og tjenester.

## Eksport

CSV og klinikrapport er bevidst ukrypterede, så de kan læses af en neurolog. Brugeren er selv dataansvarlig for eksportfilen og bør vælge en sikker delingskanal.

## Sletning

**Indstillinger → Slet alt lokalt** fjerner den lokale krypterede boks. Browserens sletning af websitedata har samme effekt. En OneDrive-backup slettes ikke automatisk; den fjernes i OneDrive-appmappen eller ved at slette appdata/adgang på Microsoft-kontoen.
