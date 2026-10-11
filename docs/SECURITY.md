# Sikkerhedsmodel

## Beskyttede data

Kryptering er valgfri og slået fra som standard. Uden kryptering gemmes registreringer og profil læsbart i IndexedDB og backups. Når kryptering aktiveres, kræves adgangssætning ved efterfølgende opstarter, og registreringer og profil findes i en krypteret vault-envelope. Envelope-formatet bruger:

- PBKDF2-HMAC-SHA-256 med 310.000 iterationer;
- tilfældig 16-byte salt pr. adgangssætning;
- AES-256-GCM;
- ny tilfældig 12-byte nonce ved hver lagring;
- Web Crypto API i browseren.

Adgangssætningen og den afledte `CryptoKey` findes kun i hukommelsen, mens appen er låst op. Der lagres ingen adgangssætningshash til separat kontrol; korrekt dekryptering og GCM-tag validerer nøglen.

## Lagringssteder

- **IndexedDB:** krypteret envelope, hvis kryptering er slået til; ellers en plaintext record.
- **Backupfil:** samme krypteringsstatus som den lokale boks.
- **OneDrive:** samme record som lokalt; upload af plaintext kræver en bekræftelse.
- **Google Drive:** samme record som lokalt i appens skjulte `appDataFolder`; upload af plaintext kræver en bekræftelse.
- **localStorage:** ikke-følsom Microsoft-konfiguration (client ID og tenant). Google client ID ligger offentligt i `app.js`; ingen client secret gemmes i appen.
- **sessionStorage:** kortlivede OAuth-state/PKCE-data og Microsoft-/Google-tokens for den aktuelle browsersession.

## Microsoft-identitet og Graph

Appen implementerer Authorization Code Flow med PKCE til en public SPA-client. Den bruger ikke client secret. Login anmoder om OpenID Connect-scopes `openid profile offline_access` og Graphs delegerede `Files.ReadWrite.AppFolder`. Graph-kald begrænses til `me/drive/special/approot`.

`profile` bruges kun til at vise kontoens navn fra ID-tokenet. Appen kalder ikke `/me` og kræver ikke `User.Read`.

## Google-identitet og Drive

Google Identity Services leverer et kortlivet access token i browseren. Appen anmoder kun om den ikke-følsomme `https://www.googleapis.com/auth/drive.appdata`-scope og bruger Drive API's skjulte `appDataFolder`. Tokenet gemmes i `sessionStorage`; der bruges ingen client secret, refresh token eller backend. Google Identity Services indlæses fra Googles officielle script-host, når appen åbner.

## Trusselsmodel og begrænsninger

Når kryptering er slået til, beskytter modellen mod læsning af en kopieret IndexedDB-database eller backupfil uden adgangssætningen. Med kryptering slået fra beskytter appen ikke data ved kopiering af browserprofil, backupfil eller cloud-fil. Appen beskytter heller ikke mod:

- malware, browserudvidelser eller kompromitteret JavaScript på en oplåst enhed;
- en angriber, som både kan ændre den hostede appkode og få brugeren til at låse boksen op;
- skærmbilleder, clipboard, udskrevne rapporter eller ukrypterede CSV/PDF-filer;
- svage eller genbrugte adgangssætninger, når kryptering er slået til;
- datatab, hvis adgangssætningen glemmes og ingen brugbar backup findes.

GitHub Pages leverer HTTPS, men repository-ejeren skal beskytte GitHub-kontoen med MFA, reviewe ændringer og undgå unødvendige tredjepartsscripts. Google Identity Services indlæses fra Googles officielle script-host; Microsofts login og Graph bruges kun ved valgfri OneDrive-backup.

## Anbefalet drift

1. Aktivér kryptering med en unik, lang adgangssætning, som opbevares i en password manager.
2. Aktivér MFA på GitHub-, Microsoft- og Google-kontoen.
3. Tag regelmæssige krypterede backups og prøv gendannelse i en separat browserprofil.
4. Del CSV/PDF via en sundhedsorganisations godkendte kanal.
5. Gennemgå ændringer i `app.js` og `sw.js` før deployment.
6. Skift cache-version i `sw.js` ved hver release.

## Sårbarheder

Dette er et personligt projekt uden central drift. Rapporter sikkerhedsfejl privat til repository-ejeren; læg ikke eksempeldata, adgangssætninger, tokens eller helbredsdata i en offentlig issue.
