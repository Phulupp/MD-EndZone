"use strict";

  /* ==========================================================================
     MEDICAL DEPARTMENT — App-Logik
     ---------------------------------------------------------------------------
     Zugang: echtes Login-/Benutzersystem (siehe js/auth.js). Diese Datei nutzt
     weiterhin das "Compat"-SDK (firebase.firestore()) für alle fachlichen
     Daten (Patienten, Akten, Leitfäden) und reagiert nur auf die Events, die
     js/auth.js verschickt, sobald jemand eingeloggt UND freigegeben ist.
     ========================================================================== */

  /* ------------------------------------------------------------------------
     1. Konstanten
     ------------------------------------------------------------------------ */
  const VERSION_AKTUELL = 141;

  // Ränge im MD (rein organisatorisch — Verwalterrechte sind unabhängig davon
  // und werden separat je Benutzer vergeben, siehe isAdmin).
  // Reihenfolge = Hierarchie, aufsteigend (der letzte Rang ist der höchste).
  const BENUTZER_RAENGE = [
    "Azubi",
    "Sanitätshelfer",
    "Rettungssanitäter",
    "Notfallsanitäter",
    "Organisatorischer Leiter Rettungsdienst",
    "Medizinstudent",
    "Notarzt",
    "Leitender Notarzt",
    "Ärztlicher Leiter Rettungsdienst",
  ];
  const NEUER_BENUTZER_STANDARD_RANG = "Azubi";

  // Bereits vergebene Ränge aus der früheren Liste, die es so nicht mehr gibt
  // und eindeutig einem neuen Rang entsprechen. Nur für die ANZEIGE (Sidebar,
  // Benutzerverwaltung) - in der Datenbank steht weiter der alte Wert, bis ein
  // Verwalter dem Benutzer einen Rang neu zuweist.
  const RANG_ALIAS = {
    Praktikant: "Azubi",
    "Ärztlicher Leiter": "Ärztlicher Leiter Rettungsdienst",
  };

  function normalisiereRang(rolle) {
    return RANG_ALIAS[rolle] || rolle;
  }

  // Optischer Akzent für die Rang-Badge - JEDER Rang bekommt jetzt eine
  // eigene Farbe (abgestuft von gedämpftem Blau-Grau für Junior-Ränge bis
  // zum kräftigen Marken-Rot für den höchsten Rang), statt wie vorher nur
  // die beiden Spitzenränge farbig und der Rest reiner Text. Siehe
  // aktualisiereSidebarRang in js/main.js (Sidebar-Profilkarte) und
  // rangBadgeHtml in js/core/utils.js (Benutzerverwaltung).
  const RANG_AKZENTE = {
    Azubi: "#6b7d89",
    Sanitätshelfer: "#4f92a6",
    Rettungssanitäter: "#3fa58f",
    Notfallsanitäter: "#58a865",
    "Organisatorischer Leiter Rettungsdienst": "#5b8fd6",
    Medizinstudent: "#8b7fd6",
    Notarzt: "#c9a227",
    "Leitender Notarzt": "#d9724a",
    "Ärztlicher Leiter Rettungsdienst": "#d94452",
  };
  // Fallback für unbekannte/veraltete Rang-Werte (z. B. noch nicht
  // umgestellte Bestandsaccounts) - neutrales Blau-Grau statt eines Fehlers.
  const RANG_AKZENT_STANDARD = "#6b7d89";
  // Die Leitungsränge bekommen zusätzlich den leuchtenden Akzentring um den
  // Avatar (siehe .sidebar__user-avatar--akzent in css/layout/shell.css) -
  // eine zusätzliche Auszeichnung für die Führungsebene, obendrauf auf die
  // Farbbadge, die jeder Rang bekommt.
  const RANG_AKZENTRING = ["Notarzt", "Leitender Notarzt", "Ärztlicher Leiter Rettungsdienst"];

  const PATIENTEN_COLLECTION = "patienten";
  const AKTEN_COLLECTION = "akten";

  // Psychologische Gutachten (Waffenschein): eigenes Dokument je Gutachten,
  // verknüpft über "patientId", siehe js/views/gutachten.js.
  const GUTACHTEN_COLLECTION = "gutachten";
  const GUTACHTEN_ART_KLEIN = "Kleiner Waffenschein";
  const GUTACHTEN_ERGEBNIS = { erteilt: "Erteilt", "nicht-erteilt": "Nicht erteilt" };

  // Termine (MRT, CT, ...): eine Collection, ein Dokument pro Termin - siehe
  // js/views/termine.js. "Sonstiges" erlaubt eine eigene Bezeichnung, damit die
  // Liste der Arten nicht fest verdrahtet sein muss.
  const TERMINE_COLLECTION = "termine";
  const TERMIN_ARTEN = ["MRT", "CT / CCT", "Psychologisches Gespräch", "Sonstiges"];
  const TERMIN_ART_SONSTIGES = "Sonstiges";

  // Mitarbeiterliste: ein einzelnes Doc mit dem Array "zeilen" (siehe
  // js/views/mitarbeiterliste.js). Lesen alle Freigegebenen, ändern nur
  // Admins (firestore.rules, kataloge/{dokument}).
  const MITARBEITER_DOC = "kataloge/mitarbeiterliste";
  const MITARBEITER_MIN_ZEILEN = 10;
  const MITARBEITER_MAX_ZEILEN = 100;

  // Leitstelle (Startseite): der Hauptfunk des MD und der Dienststatus. Ein
  // Dokument je Person in "dienst" (Dokument-ID = id der Zeile in der
  // Mitarbeiterliste), siehe js/views/startseite.js. Ohne Dokument gilt
  // "Außer Dienst".
  const MD_FUNK = "2";
  const DIENST_COLLECTION = "dienst";
  const DIENST_STATUS = { "im-dienst": "Im Dienst", "ausser-dienst": "Außer Dienst" };

  // Zugriffslinks: schreibgeschützte Kopie einer Akte, die jeder mit dem Link
  // (auch ohne Konto) ansehen kann - siehe js/views/akte-link.js und akte.html.
  // Die Kopie ist nur begrenzt gültig.
  const FREIGABEN_COLLECTION = "freigaben";
  const ZUGRIFFSLINK_TAGE = 7;

  const PRESENCE_COLLECTION = "presence";
  const ONLINE_SCHWELLE_MS = 45 * 1000;
  const HEARTBEAT_INTERVALL_MS = 20 * 1000;

  // Admin-verwaltete Behandlungsleitfäden ("Beispiele") - ein einzelnes Doc
  // mit den Array-Feldern "kategorien" und "eintraege"
  // (siehe js/views/beispiele.js). Startet leer, da es keine sinnvollen
  // medizinischen Standardwerte gibt, die sich einfach erfinden ließen.
  const LEITFAEDEN_DOC = "kataloge/leitfaeden";
  const DEFAULT_LEITFAEDEN = [];
  // Hauptkategorien, die beim ersten Start automatisch angelegt werden (feste
  // IDs, damit ein doppeltes Anlegen durch zwei gleichzeitig startende Admins
  // dasselbe Ergebnis liefert). Admins können weitere anlegen, umbenennen und
  // löschen. Die medizinischen Inhalte (Beispiele/Schritte) tragen sie selbst ein.
  const DEFAULT_LEITFADEN_KATEGORIEN = [
    { id: "verkehrsunfall", titel: "Verkehrsunfall", reihenfolge: 1 },
    { id: "schussverletzung", titel: "Schussverletzung", reihenfolge: 2 },
    { id: "stichwunde", titel: "Stichwunde", reihenfolge: 3 },
    { id: "schlaegerei", titel: "Schlägerei", reihenfolge: 4 },
  ];

  const VIEW_META = {
    startseite: { title: "Leitstelle", subtitle: "" },
    patientenakten: { title: "Patientenakten", subtitle: "Suche, lege Patienten an und dokumentiere Behandlungen." },
    // Kein Sidebar-Button - wird per oeffnePatientSeite (js/views/
    // patientenakten.js) geöffnet, Titel dort auf den Patientennamen gesetzt.
    "patient-detail": { title: "Patient", subtitle: "Patientenakte" },
    termine: { title: "Termine", subtitle: "Anstehende MRT-, CT- und weitere Termine der Patienten." },
    mitarbeiterliste: { title: "Mitarbeiterliste", subtitle: "Alle Mitarbeiter des Medical Department." },
    beispiele: { title: "Beispiele", subtitle: "Behandlungsleitfäden für häufige Fälle." },
    einstellungen: { title: "Einstellungen", subtitle: "Persönliche Einstellungen." },
    admin: { title: "Verwaltung", subtitle: "Benutzerverwaltung — nur für Verwalter sichtbar." },
    "admin-log": { title: "Aktivitäts-Log", subtitle: "Wer hat wann was geändert — nur für Verwalter sichtbar." },
  };
