"use strict";

  /* ------------------------------------------------------------------------
     22. Termine (MRT, CT / CCT, Psychologisches Gespräch, ...)
     ------------------------------------------------------------------------
     Eine Collection "termine", ein Dokument pro Termin:
       { patientId | null, patientName, datum "YYYY-MM-DDTHH:mm", art, grund,
         notiz, status "geplant" | "erledigt" | "abgesagt",
         erstelltVon, erstelltAm, bearbeiter, bearbeitetAm }
     Der Patient wird aus der Patientenliste gewählt (dann ist patientId
     gesetzt und der Name folgt späteren Umbenennungen) ODER frei eingetragen
     (patientId null - z. B. wenn die Person noch nicht als Patient angelegt
     ist). Das Datum ist ein echter Kalendertermin, frei wählbar.

     Ansichten (Reiter über der Liste):
       Anstehend  = alle mit Status "geplant" (auch überfällige, rot markiert)
       Heute      = alle mit heutigem Datum
       Diese Woche= Montag bis Sonntag der laufenden Woche
       Verlauf    = erledigt oder abgesagt */
  let termineFilterWert = "anstehend";
  let terminPatientId = null;

  const TERMIN_ICON_HAKEN =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';
  const TERMIN_ICON_ZURUECK =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';

  const TERMIN_FILTER = [
    ["anstehend", "Anstehend"],
    ["heute", "Heute"],
    ["woche", "Diese Woche"],
    ["verlauf", "Verlauf"],
  ];

  const TERMIN_LEERTEXT = {
    anstehend: "Keine anstehenden Termine. Lege oben rechts einen neuen an.",
    heute: "Heute stehen keine Termine an.",
    woche: "Diese Woche stehen keine Termine an.",
    verlauf: "Noch keine erledigten oder abgesagten Termine.",
  };

  // Firestore lehnt ab, solange die Regel für "termine" nicht in der Firebase
  // Console veröffentlicht ist - das wäre sonst nur ein allgemeines "fehlgeschlagen".
  function terminFehlerText(fehler, standard) {
    return fehler && fehler.code === "permission-denied"
      ? 'Keine Berechtigung: Die Firestore-Regel für "termine" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
      : standard;
  }

  function starteTermineListener() {
    if (!db) return;
    if (unsubTermine) unsubTermine();
    unsubTermine = db
      .collection(TERMINE_COLLECTION)
      .orderBy("datum")
      .onSnapshot(
        (snap) => {
          termine = [];
          snap.forEach((docSnap) => termine.push({ id: docSnap.id, ...docSnap.data() }));
          renderTermine();
        },
        (fehler) => {
          console.error("Termine konnten nicht geladen werden:", fehler);
          if (el.termineEmpty) {
            el.termineEmpty.textContent = terminFehlerText(fehler, "Termine konnten nicht geladen werden. Bitte Seite neu laden.");
            el.termineEmpty.hidden = false;
          }
        }
      );
  }

  // --- Datums-Hilfen (lokale Zeit, Schlüssel "YYYY-MM-DD") --------------------
  const pad2 = (n) => String(n).padStart(2, "0");

  function schluesselVonDatum(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function heuteSchluessel() {
    return schluesselVonDatum(new Date());
  }

  function morgenSchluessel() {
    const j = new Date();
    return schluesselVonDatum(new Date(j.getFullYear(), j.getMonth(), j.getDate() + 1));
  }

  function wochenGrenzen() {
    const j = new Date();
    const tageSeitMontag = (j.getDay() + 6) % 7;
    const montag = new Date(j.getFullYear(), j.getMonth(), j.getDate() - tageSeitMontag);
    const sonntag = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + 6);
    return { von: schluesselVonDatum(montag), bis: schluesselVonDatum(sonntag) };
  }

  const terminTag = (t) => (t.datum || "").slice(0, 10);
  const terminZeit = (t) => (t.datum || "").slice(11, 16) || "—";
  const terminStatus = (t) => t.status || "geplant";

  function tagUeberschriftHtml(schluessel) {
    const [j, m, tag] = schluessel.split("-").map(Number);
    const datum = new Date(j, (m || 1) - 1, tag || 1);
    const text = isNaN(datum.getTime())
      ? schluessel
      : datum.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    const diff = isNaN(datum.getTime()) ? null : Math.round((datum - tagAnfang(new Date())) / 86400000);
    let marke = "";
    if (diff === 0) marke = "Heute";
    else if (diff === 1) marke = "Morgen";
    else if (diff === -1) marke = "Gestern";
    else if (diff > 1) marke = `in ${diff} Tagen`;
    else if (diff < -1) marke = `vor ${-diff} Tagen`;
    const nah = diff === 0 || diff === 1;
    return `<span>${escapeHtml(text)}</span>${marke ? `<span class="termine-tag__marke${nah ? " termine-tag__marke--nah" : ""}">${marke}</span>` : ""}`;
  }

  function tagAnfang(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function passtZumFilter(t, filter, heute, woche) {
    const status = terminStatus(t);
    if (filter === "anstehend") return status === "geplant";
    if (filter === "heute") return terminTag(t) === heute;
    if (filter === "woche") return terminTag(t) >= woche.von && terminTag(t) <= woche.bis;
    return status !== "geplant";
  }

  // --- Darstellung ---------------------------------------------------------------
  function terminZeileHtml(t, heute) {
    const status = terminStatus(t);
    const patient = t.patientId ? patienten.find((x) => x.id === t.patientId) : null;
    const name = patient ? patient.name : t.patientName || "—";
    const nameHtml = patient
      ? `<button type="button" class="termin-zeile__patient termin-zeile__patient--link" data-termin-patient="${escapeHtml(patient.id)}">${escapeHtml(name)}</button>`
      : `<span class="termin-zeile__patient">${escapeHtml(name)}</span>`;

    let marke = "";
    if (status === "erledigt") marke = '<span class="badge" style="color:var(--status-done)">Erledigt</span>';
    else if (status === "abgesagt") marke = '<span class="badge" style="color:var(--text-soft)">Abgesagt</span>';
    else if (terminTag(t) < heute) marke = '<span class="badge" style="color:var(--status-danger-bright)">Überfällig</span>';

    const aktion =
      status === "geplant"
        ? `<button type="button" class="termin-zeile__aktion" data-termin-status="${t.id}:erledigt" title="Als erledigt markieren" aria-label="Als erledigt markieren">${TERMIN_ICON_HAKEN}</button>`
        : `<button type="button" class="termin-zeile__aktion" data-termin-status="${t.id}:geplant" title="Wieder auf geplant setzen" aria-label="Wieder auf geplant setzen">${TERMIN_ICON_ZURUECK}</button>`;

    return `<div class="termin-zeile termin-zeile--${status}" tabindex="0" data-termin-oeffnen="${t.id}">
        <span class="termin-zeile__zeit">${escapeHtml(terminZeit(t))}</span>
        <span class="termin-zeile__haupt">
          ${nameHtml}
          ${t.grund ? `<span class="termin-zeile__grund">${escapeHtml(t.grund)}</span>` : ""}
        </span>
        <span class="termin-zeile__art">${escapeHtml(t.art || "Termin")}</span>
        <span class="termin-zeile__status">${marke}</span>
        ${aktion}
      </div>`;
  }

  function renderTermine() {
    if (!el.termineListe) return;
    const heute = heuteSchluessel();
    const woche = wochenGrenzen();

    // Reiter mit Anzahl (nur bei "Anstehend" und "Heute", wo die Zahl zählt)
    const zaehle = (filter) => termine.filter((t) => terminStatus(t) === "geplant" && passtZumFilter(t, filter, heute, woche)).length;
    el.termineFilter.innerHTML = TERMIN_FILTER.map(([wert, label]) => {
      const n = wert === "anstehend" || wert === "heute" ? zaehle(wert) : 0;
      return `<button type="button" class="tabs__tab${termineFilterWert === wert ? " tabs__tab--active" : ""}" data-termine-filter="${wert}">${label}${
        n ? `<span class="termine-anzahl">${n}</span>` : ""
      }</button>`;
    }).join("");

    const liste = termine
      .filter((t) => passtZumFilter(t, termineFilterWert, heute, woche))
      .sort((a, b) => (termineFilterWert === "verlauf" ? (b.datum || "").localeCompare(a.datum || "") : (a.datum || "").localeCompare(b.datum || "")));

    if (!liste.length) {
      el.termineListe.innerHTML = "";
      el.termineEmpty.textContent = TERMIN_LEERTEXT[termineFilterWert];
      el.termineEmpty.hidden = false;
      return;
    }
    el.termineEmpty.hidden = true;

    // Pro Tag eine Karte (Kopfstreifen mit Datum, dann die Termine).
    const gruppen = [];
    liste.forEach((t) => {
      const tag = terminTag(t);
      const letzte = gruppen[gruppen.length - 1];
      if (letzte && letzte.tag === tag) letzte.termine.push(t);
      else gruppen.push({ tag, termine: [t] });
    });
    el.termineListe.innerHTML = gruppen
      .map(
        (g) => `<section class="termine-tagkarte${g.tag === heute ? " termine-tagkarte--heute" : ""}">
          <h4 class="termine-tag">${tagUeberschriftHtml(g.tag)}<span class="termine-tag__anzahl">${g.termine.length} ${g.termine.length === 1 ? "Termin" : "Termine"}</span></h4>
          ${g.termine.map((t) => terminZeileHtml(t, heute)).join("")}
        </section>`
      )
      .join("");
  }

  // Ab und zu neu zeichnen, damit "Heute"/"Überfällig" nach Mitternacht stimmen,
  // auch wenn die Seite über Nacht offen bleibt.
  setInterval(() => {
    if (aktuellerNutzer && aktuelleAnsicht === "termine") renderTermine();
  }, 5 * 60 * 1000);

  // --- Bedienung der Liste ---------------------------------------------------------
  async function setzeTerminStatus(id, status) {
    try {
      await db
        .collection(TERMINE_COLLECTION)
        .doc(id)
        .update({
          status,
          bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
          bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      zeigeToast(status === "erledigt" ? "Termin als erledigt markiert." : "Termin wieder auf geplant gesetzt.");
    } catch (fehler) {
      console.error(fehler);
      zeigeToast(terminFehlerText(fehler, "Status konnte nicht geändert werden."));
    }
  }

  function terminKlick(event) {
    const status = event.target.closest("[data-termin-status]");
    if (status) {
      const [id, neu] = status.getAttribute("data-termin-status").split(":");
      setzeTerminStatus(id, neu);
      return;
    }
    const patient = event.target.closest("[data-termin-patient]");
    if (patient) {
      oeffnePatientSeite(patient.getAttribute("data-termin-patient"));
      return;
    }
    const zeile = event.target.closest("[data-termin-oeffnen]");
    if (zeile) oeffneTerminModal(zeile.getAttribute("data-termin-oeffnen"));
  }

  if (el.termineListe) {
    el.termineListe.addEventListener("click", terminKlick);
    el.termineListe.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button")) return;
      const zeile = event.target.closest("[data-termin-oeffnen]");
      if (!zeile) return;
      event.preventDefault();
      terminKlick(event);
    });
  }

  if (el.termineFilter) {
    el.termineFilter.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-termine-filter]");
      if (!knopf) return;
      termineFilterWert = knopf.getAttribute("data-termine-filter");
      renderTermine();
    });
  }

  // --- Termin-Dialog ----------------------------------------------------------------
  if (el.terminArtSelect) {
    el.terminArtSelect.innerHTML = TERMIN_ARTEN.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
    el.terminArtSelect.addEventListener("change", aktualisiereArtFreiFeld);
  }

  function aktualisiereArtFreiFeld() {
    const frei = el.terminArtSelect.value === TERMIN_ART_SONSTIGES;
    el.terminArtFreiFeld.hidden = !frei;
  }

  // Patient: Vorschläge aus der Patientenliste beim Tippen; ohne Auswahl wird
  // der Name frei gespeichert (ein eindeutig passender Patient wird beim
  // Speichern trotzdem automatisch verknüpft, siehe unten).
  function aktualisiereTerminPatientHinweis() {
    const q = normalisiere(el.terminPatientInput.value);
    const gewaehlt = terminPatientId ? patienten.find((p) => p.id === terminPatientId) : null;
    if (gewaehlt && normalisiere(gewaehlt.name) === q) {
      el.terminPatientVorschlaege.hidden = true;
      el.terminPatientVorschlaege.innerHTML = "";
      el.terminPatientHinweis.textContent = "Verknüpft mit der Patientenakte.";
      return;
    }
    terminPatientId = null;
    const tokens = q.split(" ").filter(Boolean);
    const treffer = tokens.length
      ? patienten.filter((p) => {
          const n = normalisiere(p.name);
          return tokens.every((t) => n.includes(t));
        }).slice(0, 6)
      : [];
    el.terminPatientVorschlaege.hidden = treffer.length === 0;
    el.terminPatientVorschlaege.innerHTML = treffer
      .map(
        (p) => `<button type="button" class="termin-vorschlag" data-termin-patient-waehlen="${escapeHtml(p.id)}">
            <span class="termin-vorschlag__name">${escapeHtml(p.name)}</span>
            <span class="termin-vorschlag__info">${escapeHtml(p.geburtsdatum || "")}</span>
          </button>`
      )
      .join("");
    el.terminPatientHinweis.textContent = q ? "Kein Patient ausgewählt. Der Name wird so gespeichert." : "";
  }

  if (el.terminPatientInput) {
    el.terminPatientInput.addEventListener("input", aktualisiereTerminPatientHinweis);
  }

  if (el.terminPatientVorschlaege) {
    el.terminPatientVorschlaege.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-termin-patient-waehlen]");
      if (!knopf) return;
      const p = patienten.find((x) => x.id === knopf.getAttribute("data-termin-patient-waehlen"));
      if (!p) return;
      terminPatientId = p.id;
      el.terminPatientInput.value = p.name;
      aktualisiereTerminPatientHinweis();
      el.terminDatum.focus();
    });
  }

  function oeffneTerminModal(id) {
    const t = id ? termine.find((x) => x.id === id) : null;
    el.terminModalTitel.textContent = t ? "Termin bearbeiten" : "Neuer Termin";
    el.terminEditingId.value = t ? t.id : "";

    const patient = t && t.patientId ? patienten.find((x) => x.id === t.patientId) : null;
    terminPatientId = patient ? patient.id : null;
    el.terminPatientInput.value = patient ? patient.name : t ? t.patientName || "" : "";
    aktualisiereTerminPatientHinweis();

    // Altwerte ohne Uhrzeit ergänzen (sonst würde das datetime-local-Feld sie verwerfen).
    el.terminDatum.value = t ? (t.datum && !t.datum.includes("T") ? `${t.datum}T00:00` : t.datum) || jetzigerZeitpunkt() : jetzigerZeitpunkt();

    const bekannteArt = !!t && TERMIN_ARTEN.includes(t.art) && t.art !== TERMIN_ART_SONSTIGES;
    el.terminArtSelect.value = !t ? TERMIN_ARTEN[0] : bekannteArt ? t.art : TERMIN_ART_SONSTIGES;
    aktualisiereCustomSelect(el.terminArtSelect);
    el.terminArtFrei.value = t && !bekannteArt && t.art !== TERMIN_ART_SONSTIGES ? t.art || "" : "";
    aktualisiereArtFreiFeld();

    el.terminGrund.value = t ? t.grund || "" : "";
    el.terminNotiz.value = t ? t.notiz || "" : "";
    el.terminStatusFeld.hidden = !t;
    el.terminStatusSelect.value = t ? terminStatus(t) : "geplant";
    aktualisiereCustomSelect(el.terminStatusSelect);
    el.btnTerminLoeschen.hidden = !t;
    versteckeFeldFehler(el.terminError);

    oeffneModal("modal-termin");
    passeTextareasAn(el.terminGrund.closest(".modal__body"));
    (t ? el.terminGrund : el.terminPatientInput).focus();
  }

  if (el.btnTerminNeu) {
    el.btnTerminNeu.addEventListener("click", () => oeffneTerminModal(null));
  }

  if (el.btnConfirmTermin) {
    el.btnConfirmTermin.addEventListener("click", async () => {
      versteckeFeldFehler(el.terminError);
      const name = el.terminPatientInput.value.trim();
      const datum = el.terminDatum.value;
      const art = el.terminArtSelect.value === TERMIN_ART_SONSTIGES ? el.terminArtFrei.value.trim() : el.terminArtSelect.value;
      if (!name) return zeigeFeldFehler(el.terminError, "Bitte gib einen Patienten (oder einen Namen) an.");
      if (!datum) return zeigeFeldFehler(el.terminError, "Bitte wähle Datum und Uhrzeit.");
      if (!art) return zeigeFeldFehler(el.terminError, "Bitte gib eine Bezeichnung für die Art des Termins ein.");

      // Nichts angeklickt, aber der Name passt genau auf EINEN Patienten: verknüpfen.
      let patientId = terminPatientId;
      if (!patientId) {
        const gleich = patienten.filter((p) => normalisiere(p.name) === normalisiere(name));
        if (gleich.length === 1) patientId = gleich[0].id;
      }
      const patient = patientId ? patienten.find((p) => p.id === patientId) : null;

      const daten = {
        patientId: patient ? patient.id : null,
        patientName: patient ? patient.name : name,
        datum,
        art,
        grund: el.terminGrund.value.trim(),
        notiz: el.terminNotiz.value.trim(),
      };
      const id = el.terminEditingId.value;
      const ich = aktuellerNutzer ? aktuellerNutzer.name : null;

      try {
        if (id) {
          daten.status = el.terminStatusSelect.value;
          daten.bearbeiter = ich;
          daten.bearbeitetAm = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection(TERMINE_COLLECTION).doc(id).update(daten);
        } else {
          daten.status = "geplant";
          daten.erstelltVon = ich;
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.bearbeiter = null;
          daten.bearbeitetAm = null;
          await db.collection(TERMINE_COLLECTION).add(daten);
          // Ein neuer Termin soll sofort zu sehen sein, nicht in einem anderen Reiter verschwinden.
          if (termineFilterWert === "verlauf") termineFilterWert = "anstehend";
        }
        schliesseModal("modal-termin");
        zeigeToast("Termin gespeichert.");
        renderTermine();
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.terminError, terminFehlerText(fehler, "Speichern fehlgeschlagen. Bitte erneut versuchen."));
      }
    });
  }

  if (el.btnTerminLoeschen) {
    el.btnTerminLoeschen.addEventListener("click", () => {
      const id = el.terminEditingId.value;
      if (!id) return;
      fordereLoeschungAn("Termin löschen", "Möchtest du diesen Termin wirklich unwiderruflich löschen?", async () => {
        await db.collection(TERMINE_COLLECTION).doc(id).delete();
        schliesseModal("modal-termin");
        zeigeToast("Termin gelöscht.");
      });
    });
  }
