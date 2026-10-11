# Dataformat

## Krypteret envelope

Når kryptering er slået til, bruger IndexedDB, backupfiler og cloud-backups samme JSON-envelope:

```json
{
  "format": "horton-tracker-vault",
  "version": 1,
  "appVersion": "1.0.0",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 310000,
    "salt": "base64"
  },
  "cipher": {
    "name": "AES-GCM",
    "iv": "base64"
  },
  "ciphertext": "base64",
  "updatedAt": "ISO-8601"
}
```

## Ukrypteret record

Kryptering er slået fra som standard. I denne tilstand gemmes samme datamodel i en eksplicit markeret, ukrypteret record:

```json
{
  "format": "horton-tracker-vault-plain",
  "version": 1,
  "appVersion": "1.0.0",
  "data": {
    "schemaVersion": 1,
    "entries": []
  },
  "updatedAt": "ISO-8601"
}
```

Aktivering af kryptering konverterer den eksisterende lokale record til den krypterede envelope. Krypterede legacy-envelopes forbliver gyldige og kræver adgangssætning ved opstart. Restore af ukrypterede data ind i en allerede krypteret boks lader den lokale boks forblive krypteret.

## Dekrypteret model

Ciphertext dekrypteres til UTF-8 JSON:

```json
{
  "schemaVersion": 1,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "profile": {
    "name": "",
    "clinic": "",
    "timezone": "Europe/Copenhagen"
  },
  "profileUpdatedAt": "ISO-8601",
  "entries": [
    {
      "id": "UUID",
      "date": "YYYY-MM-DD",
      "startTime": "HH:mm",
      "endTime": "HH:mm eller tom",
      "durationMinutes": 45,
      "durationSource": "end eller minutes",
      "side": "Højre side",
      "intensity": 4,
      "symptoms": ["Rindende eller rødt øje"],
      "wokeFromSleep": "Ja eller Nej",
      "sleepType": "Nattesøvn / hovedsøvn eller tom",
      "triggers": ["Ingen åbenlyse triggere"],
      "treatments": ["Sumatriptan"],
      "treatmentEffect": "Inden for 10-15 minutter (Fuld eller stor effekt)",
      "notes": "",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ],
  "deletedEntries": [
    {"id": "UUID", "updatedAt": "ISO-8601"}
  ]
}
```

`profileUpdatedAt` og `deletedEntries` understøtter synkronisering mellem enheder. Sletningsmarkører beholdes, så en post ikke dukker op igen på en enhed, der endnu ikke har modtaget sletningen.

Feltnavne og enum-værdier er en del af schema version 1. Ved fremtidige ændringer skal `schemaVersion` migreres eksplicit, og restore skal fortsat acceptere ældre envelope-versioner eller afvise dem med en forståelig fejl.
