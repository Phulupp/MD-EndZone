"use strict";

  /* ------------------------------------------------------------------------
     24. Leitung — Übersicht (Cockpit)
     ------------------------------------------------------------------------
     Phase 1 des Leitungsbereichs: reine Auswertung bereits vorhandener Daten,
     keine eigene Firestore-Collection. Quellen:
       - Mitarbeiter insgesamt / offene Anträge: benutzerListe (js/views/admin.js)
       - Aktuell im Dienst: dienstStatus/mitarbeiter (js/views/startseite.js)
       - Anstehende Termine: termine (js/views/termine.js)
       - Wichtige Informationen: leitstelleInfo (js/views/startseite.js) -
         bewusst mitverwendet statt einer eigenen Ankündigungs-Collection
         vorzugreifen (siehe Konzept).
       - Letzte Aktivitäten: adminLogEintraege (js/views/admin.js)
     renderLeitungUebersicht() wird von den jeweiligen Snapshot-Listenern in
     admin.js/startseite.js/termine.js mit aufgerufen, damit die Kennzahlen
     live bleiben, ohne dass diese Datei eigene Listener braucht. Nur für
     Verwalter erreichbar (Sidebar-Button ist sonst hidden, siehe main.js) -
     der frühe Ausstieg unten ist daher nur eine günstige Zusatzsicherung. */
  function leitungMitarbeiterInsgesamt() {
    return benutzerListe.filter((b) => b.status === "approved").length;
  }

  function leitungOffeneAntraege() {
    return benutzerListe.filter((b) => b.status === "pending").length;
  }

  // Kompakte "wer ist gerade im Dienst"-Zeile für die Leitungsübersicht -
  // dieselbe Datenquelle wie die Leitstelle (dienstPersonen/statusVon/
  // dienstStatus/seitText, alle global aus js/views/startseite.js), nur
  // schlicht lesend statt mit Dropdown zum Umstellen.
  function leitungDienstZeileHtml(person) {
    const eintrag = person.id ? dienstStatus[person.id] : null;
    const rang = person.rang.trim();
    return `<div class="leitung-mini-zeile">
        <span class="leitung-mini-zeile__haupt">${escapeHtml(person.name.trim())}${
      rang ? ` <span class="leitung-mini-zeile__nebentext">· ${escapeHtml(rang)}</span>` : ""
    }</span>
        <span class="leitung-mini-zeile__nebentext">${escapeHtml(eintrag ? seitText(eintrag.aktualisiertAm) : "")}</span>
      </div>`;
  }

  // "Heute"/"Morgen" statt Datum, sonst TT.MM.JJJJ - lokal (kein UTC-Parsing
  // von "YYYY-MM-DD"), analog zu tagUeberschriftHtml in js/views/termine.js.
  function leitungTerminTagLabel(schluessel) {
    if (schluessel === heuteSchluessel()) return "Heute";
    if (schluessel === morgenSchluessel()) return "Morgen";
    const [j, m, tag] = schluessel.split("-").map(Number);
    return formatDatum(new Date(j, (m || 1) - 1, tag || 1));
  }

  function leitungNaechsteTermine(max) {
    const heute = heuteSchluessel();
    return termine.filter((t) => terminStatus(t) === "geplant" && terminTag(t) >= heute).slice(0, max);
  }

  function leitungTerminZeileHtml(t) {
    const patient = t.patientId ? patienten.find((x) => x.id === t.patientId) : null;
    const name = patient ? patient.name : t.patientName || "—";
    return `<div class="leitung-mini-zeile">
        <span class="leitung-mini-zeile__zeit">${escapeHtml(leitungTerminTagLabel(terminTag(t)))} · ${escapeHtml(terminZeit(t))}</span>
        <span class="leitung-mini-zeile__haupt">${escapeHtml(name)}</span>
        <span class="leitung-mini-zeile__nebentext">${escapeHtml(t.art || "Termin")}</span>
      </div>`;
  }

  function leitungAktivitaetHtml(log) {
    return `<div class="leitung-mini-zeile">
        <span class="leitung-mini-zeile__haupt"><strong>${escapeHtml(log.adminName || "Unbekannt")}</strong> — ${escapeHtml(log.aktion)}${
      log.zielName ? ` · ${escapeHtml(log.zielName)}` : ""
    }</span>
        <span class="leitung-mini-zeile__nebentext">${formatDatumUhrzeit(log.zeitpunkt)}</span>
      </div>`;
  }

  function renderLeitungUebersicht() {
    if (!el.leitungKpiMitarbeiter || !istAdmin()) return;

    el.leitungKpiMitarbeiter.textContent = String(leitungMitarbeiterInsgesamt());

    const personen = dienstPersonen();
    const imDienstListe = personen.filter((p) => statusVon(p) === "im-dienst");
    el.leitungKpiDienst.innerHTML = personen.length
      ? `${imDienstListe.length}<span class="leitung-kennzahl__von"> / ${personen.length}</span>`
      : "–";
    el.leitungDienstListe.innerHTML = imDienstListe.length
      ? imDienstListe.map(leitungDienstZeileHtml).join("")
      : `<p class="empty-state empty-state--kompakt">Aktuell ist niemand im Dienst.</p>`;

    el.leitungKpiAntraege.textContent = String(leitungOffeneAntraege());
    el.leitungKpiTermine.textContent = String(termine.filter((t) => terminStatus(t) === "geplant").length);

    const infoText = leitstelleInfo.text.trim();
    el.leitungInfoText.textContent = infoText;
    el.leitungInfoText.hidden = !infoText;
    el.leitungInfoLeer.hidden = !!infoText;
    el.leitungInfoMeta.textContent =
      leitstelleInfo.von && leitstelleInfo.am ? `Zuletzt geändert von ${leitstelleInfo.von}, ${formatDatumUhrzeit(leitstelleInfo.am)}` : "";

    const naechsteTermine = leitungNaechsteTermine(4);
    el.leitungTermineListe.innerHTML = naechsteTermine.length
      ? naechsteTermine.map(leitungTerminZeileHtml).join("")
      : `<p class="empty-state empty-state--kompakt">Keine anstehenden Termine.</p>`;

    const letzteAktivitaeten = adminLogEintraege.slice(0, 6);
    el.leitungAktivitaetenListe.innerHTML = letzteAktivitaeten.length
      ? letzteAktivitaeten.map(leitungAktivitaetHtml).join("")
      : `<p class="empty-state empty-state--kompakt">Noch keine Aktivitäten.</p>`;
  }
