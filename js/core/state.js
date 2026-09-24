"use strict";

  /* ------------------------------------------------------------------------
     2. Anwendungsstatus
     ------------------------------------------------------------------------ */
  let aktuellerNutzer = null; // { uid, name, rolle, admin }
  let aktuelleAnsicht = "startseite";

  let patienten = [];
  let unsubPatienten = null;
  let patientenSuche = "";

  let akten = [];
  let unsubAkten = null;
  // Wird gemerkt, während das Akte-Formular-Modal offen ist: null = Anlegen,
  // sonst die ID der gerade bearbeiteten Akte (siehe js/views/patientenakten.js).
  let bearbeiteteAkteId = null;
  // ID des Patienten, dessen Detail-Modal gerade offen ist - wird gebraucht,
  // um nach dem Anlegen/Bearbeiten/Löschen einer Akte die Detailansicht
  // korrekt neu zu rendern.
  let offenerPatientId = null;

  let gutachten = [];
  let unsubGutachten = null;

  let unsubLeitfaeden = null;
  let leitfaeden = [];
  let leitfadenKategorien = [];
  let termine = [];
  let unsubTermine = null;

  let mitarbeiter = [];
  let unsubMitarbeiter = null;
  let mitarbeiterMeta = { von: "", am: null };
  // Bearbeitungsmodus der Mitarbeiterliste (nur Admins, siehe
  // js/views/mitarbeiterliste.js): Entwurf = Arbeitskopie der Zeilen,
  // maBasisStempel = Änderungszeitpunkt der Fassung, auf der der Entwurf beruht.
  let mitarbeiterBearbeiten = false;
  let mitarbeiterEntwurf = [];
  let maBasisStempel = 0;
  let maSpeichertGerade = false;

  // Leitstelle: Dienststatus je Person, { [id der Mitarbeiterliste-Zeile]:
  // { status, aktualisiertAm, von } } (siehe js/views/startseite.js).
  let dienstStatus = {};
  let unsubDienst = null;

  let unsubPresence = null;

  let unsubBenutzerliste = null;
  let benutzerListe = [];
  let bekanntePendingUids = null;
  let unsubAdminLog = null;
  let adminLogEintraege = [];
  let benutzerSuche = "";
  // "alle" | "pending" | "locked" | "admin" - Filter-Tabs über der
  // Benutzerliste in der Verwaltung (siehe renderBenutzerverwaltungStatusFilter
  // in admin.js).
  let benutzerStatusFilter = "alle";
  let aktiverDetailUid = null;

  let heartbeatTimer = null;
  let onlineRecomputeTimer = null;
  let versionCheckTimer = null;
  let sessionId = null;

  let pendingDeleteCallback = null;
