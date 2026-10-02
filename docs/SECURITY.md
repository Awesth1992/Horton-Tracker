# Sikkerhedsmodel

## Beskyttede data

Registreringer og rapportprofil findes kun som JSON inde i en krypteret vault-envelope. Envelope-formatet bruger:

- PBKDF2-HMAC-SHA-256 med 310.000 iterationer;
- tilfældig 16-byte salt pr. adgangssætning;
- AES-256-GCM;
- ny tilfældig 12-byte nonce ved hver lagring;
- Web Crypto API i browseren.

Adgangssætningen og den afledte `CryptoKey` findes kun i hukommelsen, mens appen er låst op. Der lagres ingen adgangssætningshash til separat kontrol; korrekt dekryptering og GCM-tag validerer nøglen.

## Lagringssteder

- **IndexedDB:** kun krypteret envelope.
- **Backupfil:** kun krypteret envelope.
- **OneDrive:** kun krypteret envelope i appens særlige mappe.
- **localStorage:** kun ikke-følsom Microsoft-konfiguration (client ID og tenant).
- **sessionStorage:** kortlivede OAuth-state/PKCE-data og Microsoft-token for den aktuelle browsersession.

## Microsoft-identitet og Graph

Appen implementerer Authorization Code Flow med PKCE til en public SPA-client. Den bruger ikke client secret. Login anmoder om OpenID Connect-scopes `openid profile offline_access` og Graphs delegerede `Files.ReadWrite.AppFolder`. Graph-kald begrænses til `me/drive/special/approot`.

`profile` bruges kun til at vise kontoens navn fra ID-tokenet. Appen kalder ikke `/me` og kræver ikke `User.Read`.

## Trusselsmodel og begrænsninger

Modellen beskytter mod læsning af en kopieret IndexedDB-database, backupfil eller OneDrive-fil uden adgangssætningen. Den beskytter ikke mod:

- malware, browserudvidelser eller kompromitteret JavaScript på en oplåst enhed;
- en angriber, som både kan ændre den hostede appkode og få brugeren til at låse boksen op;
- skærmbilleder, clipboard, udskrevne rapporter eller ukrypterede CSV/PDF-filer;
- svage eller genbrugte adgangssætninger;
- datatab, hvis adgangssætningen glemmes og ingen brugbar backup findes.

GitHub Pages leverer HTTPS, men repository-ejeren skal beskytte GitHub-kontoen med MFA, reviewe ændringer og undgå tredjepartsscripts. Projektet bruger ingen CDN'er eller runtime-afhængigheder ud over Microsofts login- og Graph-endpoints ved valgfri OneDrive-brug.

## Anbefalet drift

1. Brug en unik, lang adgangssætning og en password manager.
2. Aktivér MFA på GitHub- og Microsoft-kontoen.
3. Tag regelmæssige krypterede backups og prøv gendannelse i en separat browserprofil.
4. Del CSV/PDF via en sundhedsorganisations godkendte kanal.
5. Gennemgå ændringer i `app.js` og `sw.js` før deployment.
6. Skift cache-version i `sw.js` ved hver release.

## Sårbarheder

Dette er et personligt projekt uden central drift. Rapporter sikkerhedsfejl privat til repository-ejeren; læg ikke eksempeldata, adgangssætninger, tokens eller helbredsdata i en offentlig issue.
