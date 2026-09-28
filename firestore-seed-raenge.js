/* ============================================================================
   Einmaliges Seed-Werkzeug — Phase 1 der Rang-Migration
   ============================================================================
   WICHTIG: Diese Datei ist KEIN Teil der App - sie wird von index.html NICHT
   geladen. Sie diente dazu, die Collection "raenge" einmalig mit den 9
   ursprünglichen Rängen zu befüllen (die zugrunde liegenden Konstanten aus
   js/core/config.js - BENUTZER_RAENGE/RANG_AKZENTE/RANG_AKZENTRING - wurden
   danach entfernt, "users.rolle" enthält jetzt direkt die rangId, siehe
   js/core/raenge.js). Bleibt als Referenz erhalten; für neue Ränge gibt es
   jetzt die Oberfläche "Verwaltung -> Ränge & Rollen".

   Voraussetzung: Die Regeln aus firestore.rules (Abschnitt "raenge/{rangId}")
   müssen vorher in der Firebase-Konsole veröffentlicht sein, sonst schlägt
   der Schreibvorgang mit "permission-denied" fehl.

   AUSFÜHRUNG (einmalig, durch einen Admin):
   1. Die Website ganz normal im Browser öffnen und als Admin einloggen.
   2. Die Entwicklertools öffnen (F12) und in den Reiter "Konsole" wechseln.
   3. Den kompletten Inhalt dieser Datei hineinkopieren und mit Enter
      ausführen. Die Seite nutzt bereits ein globales "db" (Compat-SDK) und
      "firebase" - beide sind zu diesem Zeitpunkt bereits geladen.
   4. In der Konsole erscheint "9 Rangdokumente angelegt." bei Erfolg.

   Das Skript ist absichtlich mit festen Dokument-IDs (rangId) geschrieben
   und verwendet .set() statt .add() - ein versehentliches zweites Ausführen
   überschreibt lediglich dieselben 9 Dokumente mit denselben Werten erneut
   (keine Duplikate, keine Nebenwirkung).

   Nach diesem Schritt: KEINE bestehende Funktion der App liest "raenge".
   "users.rolle" bleibt unverändert der bisherige String. Das ist Absicht -
   die eigentliche Umstellung folgt erst in einer späteren, separat
   freigegebenen Phase.
   ============================================================================ */
(async () => {
  const raenge = [
    { rangId: "azubi", name: "Azubi", kurzname: "AZ", beschreibung: "Einsteiger im Medical Department, befindet sich in der Ausbildung.", farbeToken: "slate", akzentring: false, position: 10 },
    { rangId: "sanitaetshelfer", name: "Sanitätshelfer", kurzname: "SH", beschreibung: "Unterstützt im Rettungsdienst unter Anleitung erfahrener Kollegen.", farbeToken: "cyan", akzentring: false, position: 20 },
    { rangId: "rettungssanitaeter", name: "Rettungssanitäter", kurzname: "RS", beschreibung: "Eigenständige Erstversorgung und Patiententransport.", farbeToken: "teal", akzentring: false, position: 30 },
    { rangId: "notfallsanitaeter", name: "Notfallsanitäter", kurzname: "NFS", beschreibung: "Erweiterte Notfallversorgung im Rettungsdienst.", farbeToken: "gruen", akzentring: false, position: 40 },
    { rangId: "organisatorischer-leiter-rettungsdienst", name: "Organisatorischer Leiter Rettungsdienst", kurzname: "OLRD", beschreibung: "Koordiniert den Rettungsdienst bei größeren Einsatzlagen.", farbeToken: "blau", akzentring: false, position: 50 },
    { rangId: "medizinstudent", name: "Medizinstudent", kurzname: "MS", beschreibung: "In ärztlicher Ausbildung, unterstützt unter Aufsicht.", farbeToken: "violett", akzentring: false, position: 60 },
    { rangId: "notarzt", name: "Notarzt", kurzname: "NA", beschreibung: "Eigenständige medizinische Versorgung und Behandlung vor Ort.", farbeToken: "gold", akzentring: true, position: 70 },
    { rangId: "leitender-notarzt", name: "Leitender Notarzt", kurzname: "LNA", beschreibung: "Medizinische Einsatzleitung bei umfangreichen Schadenslagen.", farbeToken: "orange", akzentring: true, position: 80 },
    { rangId: "aerztlicher-leiter-rettungsdienst", name: "Ärztlicher Leiter Rettungsdienst", kurzname: "ÄLRD", beschreibung: "Fachliche und organisatorische Gesamtleitung des Rettungsdienstes.", farbeToken: "rot", akzentring: true, position: 90 },
  ];

  const batch = db.batch();
  const jetzt = firebase.firestore.FieldValue.serverTimestamp();
  raenge.forEach(({ rangId, ...feld }) => {
    batch.set(db.collection("raenge").doc(rangId), {
      ...feld,
      aktiv: true,
      erstelltVon: "Phase-1-Migration",
      erstelltAm: jetzt,
      bearbeitetVon: "Phase-1-Migration",
      bearbeitetAm: jetzt,
    });
  });
  await batch.commit();
  console.log("9 Rangdokumente angelegt.");
})();
