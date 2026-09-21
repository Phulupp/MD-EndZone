# Medical Department — Verwaltung

Internes Dokumentations- und Verwaltungstool des **Medical Department** (Rettungsdienst) eines
privaten RedM-Roleplay-Projekts. Patientenakten, Termine, Behandlungsleitfäden und die
Benutzerverwaltung laufen in Echtzeit über **Firebase** (Authentication + Firestore) –
Änderungen sind sofort bei allen angemeldeten Mitarbeitern sichtbar.

Live: <https://md-endzone.de/>

> Alle Patienten und Charaktere sind fiktiv. Es handelt sich um ein reines Roleplay-Werkzeug ohne
> reale medizinische Daten.

## ✨ Funktionen

- **Firebase Authentication** – Login per E-Mail/Passwort oder Google, inkl. Registrierung und
  „Passwort vergessen". Neue Accounts starten im Status „wartet auf Freigabe" und müssen von einem
  Verwalter freigeschaltet werden.
- **Rangsystem** (unabhängig von den Verwalterrechten), aufsteigend: `Azubi`, `Sanitätshelfer`,
  `Rettungssanitäter`, `Notfallsanitäter`, `Organisatorischer Leiter Rettungsdienst`,
  `Medizinstudent`, `Notarzt`, `Leitender Notarzt`, `Ärztlicher Leiter Rettungsdienst`. Neue
  Accounts erhalten automatisch den Rang „Azubi". Jeder Rang hat eine eigene Farbe.
- **Verwalterrechte** lassen sich unabhängig vom Rang pro Account vergeben (`isAdmin`), inkl.
  Schutzmechanismus für „unantastbare" Accounts, die nicht versehentlich degradiert oder gesperrt
  werden können.
- **Startseite** – Begrüßung, Kennzahlen (Patienten, Akten) und Schnellzugriff. Die
  Standard-Startseite lässt sich in den Einstellungen wählen.
- **Patientenakten** – Patienten anlegen und suchen (Volltextsuche über Name, Befund, Allergien …,
  inkl. Warnung bei ähnlichen Namen). Stammdaten mit Geburtsdatum, Allergien, Vorerkrankungen und
  Notfallkontakt; pro Patient beliebig viele Behandlungsakten (Behandlungsgrund, Hergang, Befund,
  Behandlung, Bemerkungen). Löschen von Patienten nur für Verwalter.
  - **Konflikterkennung** und Anzeige, wer eine Akte gerade ebenfalls bearbeitet.
  - **Text kopieren** (für Chat/Discord) und **PDF-Export** einer Akte.
  - **Zugriffslink** – schreibgeschützte Kopie einer Akte, die auch ohne Konto über
    `akte.html#…` aufrufbar ist; 7 Tage gültig, jederzeit aktualisier- oder löschbar.
- **Termine** – MRT, CT / CCT, Psychologisches Gespräch oder „Sonstiges" mit eigener Bezeichnung,
  verknüpft mit einem Patienten oder frei eingetragenem Namen. Reiter *Anstehend*, *Heute*,
  *Diese Woche* und *Verlauf*; Status `geplant` / `erledigt` / `abgesagt`.
- **Beispiele** – von Verwaltern gepflegte Behandlungsleitfäden, gegliedert in Kategorien
  (z. B. Verkehrsunfall, Schussverletzung, Stichwunde, Schlägerei). Alle können nachschlagen,
  Verwalter bearbeiten.
- **Verwaltung (Admin)** – Benutzerliste freigeben/ablehnen/sperren (auch befristet)/entsperren,
  Rang & Verwalterrechte setzen, Notizen, Umbenennen, Passwort-Reset auslösen, Accounts direkt
  anlegen, sowie ein unveränderliches Aktivitäts-Log aller Verwalter-Aktionen.
- **„Wer ist online"** – Live-Anzeige der gerade aktiven Mitarbeiter.
- **Update-Banner** – informiert alle Nutzer automatisch, wenn eine neue Version bereitsteht.

## 🖥️ Design

Dunkles, klinisch-technisches Design: kühles Anthrazit/Slate-Blau als Fläche, Medizin-Rot als
Akzentfarbe, Schrift „Inter". Keine Bild-Texturen – reine Flächen und Verläufe. Die einzige
Grafik ist das Favicon (`assets/logo/favicon.svg`).

## 📁 Projektstruktur

```
├── index.html               # Login/Registrierung, Sidebar, alle Ansichten und Dialoge
├── akte.html                # Öffentliche Ansicht einer per Zugriffslink geteilten Akte
├── css/
│   ├── base/                # tokens (Farben), reset, background, responsive
│   ├── layout/              # shell (Sidebar/Kopf), footer
│   ├── components/          # buttons, forms, cards, badges, modals, toast
│   └── views/               # auth, startseite, patientenakten, termine, beispiele, admin, akte-ansicht
├── js/
│   ├── firebase-config.js   # Firebase-Projektdaten + Initialisierung (Compat-SDK)
│   ├── auth.js              # Login/Registrierung/Benutzerverwaltung (Modular-SDK, ES-Modul)
│   ├── main.js              # Start/Stop der App nach Login/Logout
│   ├── akte-ansicht.js      # Einstiegsskript für akte.html
│   ├── core/                # config, state, dom, utils, akte-dokument, akte-pdf, firebase-init
│   ├── ui/                  # nav, modals, presence, version-check
│   └── views/               # startseite, patientenakten, akte-link, termine, beispiele,
│                            # einstellungen, admin
├── assets/logo/favicon.svg  # Browser-Tab-Icon
├── firestore.rules          # Sicherheitsregeln (Firestore) – Archivkopie, siehe unten
├── version.json             # Versionsnummer für das automatische Update-Banner
└── CNAME                    # Eigene Domain für GitHub Pages
```

Es gibt keinen Build-Schritt und keinen Paketmanager: Die Skripte sind klassische `defer`-Skripte
in fester Reihenfolge (siehe `index.html`), nur `auth.js` ist ein ES-Modul.

## 🔥 Firestore-Collections

| Collection         | Zweck                                                                         |
|--------------------|--------------------------------------------------------------------------------|
| `users`            | Ein Dokument pro Account (Status, Rang, Verwalterrechte, …)                    |
| `usernames`        | Reservierte Benutzernamen (Verfügbarkeitsprüfung)                              |
| `adminLog`         | Unveränderliches Log aller Verwalter-Aktionen                                  |
| `presence`         | „Wer ist online"-Heartbeat                                                     |
| `patienten`        | Patientenprofile (Name, Stammdaten)                                            |
| `akten`            | Behandlungsakten, verknüpft über `patientId`                                   |
| `termine`          | Termine (MRT, CT, …), verknüpft über `patientId` oder freien Namen             |
| `freigaben`        | Zugriffslinks: schreibgeschützte, zeitlich begrenzte Kopien von Akten          |
| `kataloge`         | Verwaltete Listen (`kataloge/leitfaeden` = Behandlungsleitfäden)               |

Die aktuellen, gültigen Regeln werden ausschließlich über die Firebase-Konsole
(Firestore Database → Regeln) gepflegt – `firestore.rules` in diesem Repo ist nur eine
Archiv-/Versionskopie zur Nachverfolgung und muss nach Änderungen von Hand dort eingefügt werden.

## ⚙️ Einrichtung

1. In `js/firebase-config.js` die eigenen Firebase-Projektdaten eintragen (Web-App aus der
   Firebase-Konsole).
2. In der Firebase-Konsole **Authentication** (E-Mail/Passwort + Google) sowie **Firestore
   Database** aktivieren und die Regeln aus `firestore.rules` übernehmen.
3. `index.html` lokal öffnen oder über GitHub Pages (siehe `.github/workflows/pages.yml`)
   bereitstellen.

## 🚀 Deployment & Versionen

Der `main`-Branch wird automatisch per GitHub Actions (`.github/workflows/pages.yml`) auf
GitHub Pages veröffentlicht (Domain über `CNAME`).

Bei jedem Release muss die Versionsnummer an allen Stellen gleichzeitig erhöht werden:
`version.json`, `VERSION_AKTUELL` in `js/core/config.js` und alle `?v=`-Angaben in `index.html`
und `akte.html`. Nur so funktionieren Cache-Busting und Update-Banner.

## 🔒 Hinweis

Dies ist ein internes Verwaltungstool für ein privates RedM-Roleplay-Projekt. Zugriff ist nur für
freigegebene Mitarbeiter des Medical Department vorgesehen.
