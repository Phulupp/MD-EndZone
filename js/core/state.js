"use strict";

  /* ------------------------------------------------------------------------
     2. Anwendungsstatus
     ------------------------------------------------------------------------ */
  let aktuellerNutzer = null; // { uid, name, rolle, admin, leitung }
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

  // Info-Feld der Leitstelle (siehe js/views/startseite.js)
  let leitstelleInfo = { text: "", von: "", am: null };
  let unsubLeitstelleInfo = null;
  let leitstelleInfoBearbeiten = false;

  let unsubPresence = null;

  // benutzerListe wird gemeinsam von der (admin-exklusiven) Verwaltung und
  // der (leitung+admin) Personal-Übersicht genutzt (siehe starteBenutzer-
  // verwaltung in js/views/admin.js) - eine Collection, zwei Ansichten.
  let unsubBenutzerliste = null;
  let benutzerListe = [];
  let bekanntePendingUids = null;
  // adminLog bleibt strikt admin-exklusiv (technisches Systemprotokoll) -
  // eigener Start/Stop, siehe starteAdminLog/stoppeAdminLog in js/views/admin.js.
  let unsubAdminLog = null;
  let adminLogEintraege = [];
  let benutzerSuche = "";
  // Filter über dem Aktivitätslog (siehe renderAdminLog in js/views/admin.js).
  let adminLogSuche = "";
  let adminLogAktionFilterWert = "alle";
  let adminLogZeitraumFilterWert = "alle";

  // RP-Personalakte (Leitung ODER Admin, siehe js/views/leitung-personal.js):
  // beide Collections werden komplett geladen und je Personalakte
  // client-seitig nach "uid" gefiltert - dasselbe Muster wie akten/termine.
  let unsubPersonalnotizen = null;
  let personalnotizen = [];
  let unsubRanghistorie = null;
  let ranghistorie = [];
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
