"use strict";

  /* ------------------------------------------------------------------------
     Zentrale Rangverwaltung (Collection "raenge", siehe firestore.rules)
     ------------------------------------------------------------------------
     Ersetzt die frühere hartkodierte BENUTZER_RAENGE/RANG_ALIAS/RANG_AKZENTE/
     RANG_AKZENTRING-Logik aus config.js. "users.rolle" enthält jetzt direkt
     die stabile "rangId" (z. B. "notarzt") statt eines Anzeigenamens - Name,
     Farbe, Reihenfolge und Akzentring werden zur Laufzeit aus dieser
     geladenen Liste nachgeschlagen. Wird für JEDEN freigegebenen Nutzer
     geladen (Ränge erscheinen überall in der App), nicht nur für Admin/Leitung.

     farbeToken -> Hex: dieselbe feste 9er-Liste wie in firestore.rules
     validiert - ändert sich diese Liste dort, muss sie auch hier angepasst
     werden. */
  const RANG_FARBE_HEX = {
    slate: "#6b7d89",
    cyan: "#4f92a6",
    teal: "#3fa58f",
    gruen: "#58a865",
    blau: "#5b8fd6",
    violett: "#8b7fd6",
    gold: "#c9a227",
    orange: "#d9724a",
    rot: "#d94452",
  };
  const RANG_FARBE_STANDARD = "#6b7d89";

  function starteRaengeListener() {
    if (!db) return;
    if (unsubRaenge) unsubRaenge();
    unsubRaenge = db.collection("raenge").onSnapshot(
      (snap) => {
        raenge = [];
        snap.forEach((docSnap) => raenge.push({ rangId: docSnap.id, ...docSnap.data() }));
        raenge.sort((a, b) => (a.position || 0) - (b.position || 0));

        // Alles, was Ränge anzeigt, neu rendern - dieselbe Datei wird von
        // sehr unterschiedlichen Ansichten gebraucht (Sidebar, Leitstelle,
        // Mitarbeiterliste, Leitung, Verwaltung).
        if (aktuellerNutzer) aktualisiereSidebarRang(aktuellerNutzer.rolle);
        renderMitarbeiter();
        renderLeitstelle();
        renderLeitungPersonal();
        aktualisierePersonalakteAnsicht();
        renderAdminRaenge();
        renderNeuerBenutzerRolleOptionen();
      },
      (fehler) => {
        console.error("Ränge konnten nicht geladen werden:", fehler);
      }
    );
  }

  function stoppeRaengeListener() {
    if (unsubRaenge) {
      unsubRaenge();
      unsubRaenge = null;
    }
    raenge = [];
  }

  function findeRang(rangId) {
    return raenge.find((r) => r.rangId === rangId) || null;
  }

  // Anzeigename zu einer rangId - fällt auf die rangId selbst zurück, falls
  // der Rang (noch) nicht geladen oder unbekannt ist, statt auf "undefined".
  function rangName(rangId) {
    if (!rangId) return "";
    const r = findeRang(rangId);
    return r ? r.name : rangId;
  }

  function rangFarbe(rangId) {
    const r = findeRang(rangId);
    return RANG_FARBE_HEX[r && r.farbeToken] || RANG_FARBE_STANDARD;
  }

  function rangAkzentring(rangId) {
    const r = findeRang(rangId);
    return !!(r && r.akzentring);
  }

  function aktiveRaenge() {
    return raenge.filter((r) => r.aktiv);
  }

  // Für die freien Rang-Textfelder der Mitarbeiterliste/Leitstelle (siehe
  // js/views/mitarbeiterliste.js, js/views/startseite.js): dort steht kein
  // rangId, sondern frei getippter Text, der zufällig einem Rangnamen
  // entsprechen kann. Liefert null, wenn kein aktueller Rang exakt passt -
  // das Feld bleibt dann einfach ungefärbt, statt zu raten.
  function farbeVonRangName(name) {
    const r = raenge.find((x) => x.name === name);
    return r ? rangFarbe(r.rangId) : null;
  }
