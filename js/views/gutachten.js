"use strict";

  /* ------------------------------------------------------------------------
     22. Gutachten (psychologisches Gutachten für den Waffenschein)
     ------------------------------------------------------------------------
     Eigene Top-Level-Collection "gutachten", ein Dokument pro Gutachten,
     verknüpft über "patientId". Die Personendaten (Name, Geburtsdatum,
     Telefon) werden beim Ausstellen ins Dokument KOPIERT - ein ausgestelltes
     Gutachten bleibt so unverändert, auch wenn sich das Patientenprofil später
     ändert. Ergebnis: "erteilt" | "nicht-erteilt"; bei "nicht-erteilt" ist eine
     Begründung Pflicht. Angezeigt wird es im Reiter "Gutachten" der
     Patientenseite (siehe index.html, view-patient-detail). Lesen/Anlegen/
     Bearbeiten: alle Freigegebenen, Löschen: nur Admins (firestore.rules). */
  let bearbeitetesGutachtenId = null;
  let offenesGutachtenId = null;
  let gewaehltesGutachtenErgebnis = "";

  function starteGutachtenListener() {
    if (!db) return;
    if (unsubGutachten) unsubGutachten();
    unsubGutachten = db
      .collection(GUTACHTEN_COLLECTION)
      .orderBy("erstelltAm")
      .onSnapshot(
        (snap) => {
          gutachten = [];
          snap.forEach((docSnap) => gutachten.push({ id: docSnap.id, ...docSnap.data() }));
          if (offenerPatientId) renderPatientDetailGutachten(offenerPatientId);
          if (offenesGutachtenId) {
            const g = gutachten.find((x) => x.id === offenesGutachtenId);
            if (g) fuelleGutachtenDetail(g);
            else {
              offenesGutachtenId = null;
              schliesseModal("modal-gutachten-detail");
            }
          }
        },
        (fehler) => console.error("Gutachten konnten nicht geladen werden:", fehler)
      );
  }

  // Ein gerade erst angelegtes Gutachten hat noch keinen Serverzeitstempel und
  // zählt bis dahin als das neueste.
  function gutachtenZeit(g) {
    return zeitstempelWert(g.erstelltAm) || Number.MAX_SAFE_INTEGER;
  }

  function patientGutachten(patientId) {
    return gutachten.filter((g) => g.patientId === patientId).sort((a, b) => gutachtenZeit(a) - gutachtenZeit(b));
  }

  function gutachtenErgebnisText(g) {
    return GUTACHTEN_ERGEBNIS[g.ergebnis] || "—";
  }

  // --- Reiter auf der Patientenseite ---------------------------------------
  function setzePatientTab(tab) {
    document.querySelectorAll("[data-ptab]").forEach((knopf) => {
      knopf.classList.toggle("tabs__tab--active", knopf.getAttribute("data-ptab") === tab);
    });
    el.ptabAkten.hidden = tab !== "akten";
    el.ptabGutachten.hidden = tab !== "gutachten";
    el.btnAkteNeu.hidden = tab !== "akten";
    el.btnGutachtenNeu.hidden = tab !== "gutachten";
  }

  document.querySelectorAll("[data-ptab]").forEach((knopf) => {
    knopf.addEventListener("click", () => setzePatientTab(knopf.getAttribute("data-ptab")));
  });

  // --- Liste im Reiter -----------------------------------------------------
  function renderPatientDetailGutachten(patientId) {
    if (!el.patientGutachtenListe) return;
    const chronologisch = patientGutachten(patientId);
    el.patientGutachtenLeer.hidden = chronologisch.length !== 0;

    el.ptabZaehlerGutachten.textContent = chronologisch.length || "";

    const loeschenErlaubt = istAdmin();
    el.patientGutachtenListe.innerHTML = chronologisch
      .slice()
      .reverse()
      .map((g) => {
        // Zweite Zeile: Ergebnis, Datum, Person; dritte Zeile: Grund bzw. Notiz.
        const ergebnisZeile = `${gutachtenErgebnisText(g)} am ${formatDatum(g.datum)}${g.erstelltVon ? ` von ${g.erstelltVon}` : ""}`;
        const zusatz = g.ergebnis === "nicht-erteilt" ? (g.begruendung ? `Grund: ${g.begruendung}` : "") : g.notizen || "";
        const loeschen = loeschenErlaubt
          ? `<button type="button" class="akte-zeile__loeschen" data-gutachten-loeschen="${g.id}" title="Gutachten löschen" aria-label="Gutachten vom ${escapeHtml(formatDatum(g.datum))} löschen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>`
          : "<span></span>";
        return `<div class="akte-zeile akte-zeile--gutachten" tabindex="0" data-gutachten-oeffnen="${g.id}">
            <span class="akte-zeile__haupt">
              <span class="akte-zeile__titel">${escapeHtml(g.art || GUTACHTEN_ART_KLEIN)}</span>
              <span class="akte-zeile__vorschau akte-zeile__vorschau--voll">${escapeHtml(ergebnisZeile)}</span>
              ${zusatz ? `<span class="akte-zeile__vorschau">${escapeHtml(zusatz)}</span>` : ""}
            </span>
            ${loeschen}
            <svg class="akte-zeile__pfeil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>
          </div>`;
      })
      .join("");
  }

  if (el.patientGutachtenListe) {
    const oeffneEintrag = (event) => {
      const loeschen = event.target.closest("[data-gutachten-loeschen]");
      if (loeschen) {
        loescheGutachtenMitBestaetigung(loeschen.getAttribute("data-gutachten-loeschen"));
        return;
      }
      const eintrag = event.target.closest("[data-gutachten-oeffnen]");
      if (eintrag) oeffneGutachtenDetail(eintrag.getAttribute("data-gutachten-oeffnen"));
    };
    el.patientGutachtenListe.addEventListener("click", oeffneEintrag);
    el.patientGutachtenListe.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("[data-gutachten-loeschen]")) return;
      event.preventDefault();
      oeffneEintrag(event);
    });
  }

  function loescheGutachtenMitBestaetigung(gutachtenId, danach) {
    if (!istAdmin()) return;
    const g = gutachten.find((x) => x.id === gutachtenId);
    const bezeichnung = g ? `das Gutachten vom ${formatDatum(g.datum)}` : "dieses Gutachten";
    fordereLoeschungAn("Gutachten löschen", `Möchtest du ${bezeichnung} wirklich unwiderruflich löschen?`, async () => {
      await db.collection(GUTACHTEN_COLLECTION).doc(gutachtenId).delete();
      if (danach) danach();
      zeigeToast("Gutachten gelöscht.");
    });
  }

  // --- Formular (anlegen/bearbeiten) --------------------------------------
  function setzeGutachtenErgebnis(ergebnis) {
    gewaehltesGutachtenErgebnis = ergebnis;
    el.gutachtenOptionen.querySelectorAll("[data-ergebnis]").forEach((knopf) => {
      const aktiv = knopf.getAttribute("data-ergebnis") === ergebnis;
      knopf.classList.toggle("gutachten-option--aktiv", aktiv);
      knopf.setAttribute("aria-checked", aktiv ? "true" : "false");
    });
    el.gutachtenBegruendungFeld.hidden = ergebnis !== "nicht-erteilt";
    if (ergebnis === "nicht-erteilt") passeTextareasAn(el.gutachtenBegruendungFeld);
  }

  if (el.gutachtenOptionen) {
    el.gutachtenOptionen.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-ergebnis]");
      if (knopf) setzeGutachtenErgebnis(knopf.getAttribute("data-ergebnis"));
    });
  }

  function oeffneGutachtenForm(g) {
    if (!offenerPatientId) return;
    bearbeitetesGutachtenId = g ? g.id : null;
    const patient = patienten.find((x) => x.id === offenerPatientId) || {};
    versteckeFeldFehler(el.gutachtenError);

    el.gutachtenFormTitel.textContent = g ? "Gutachten bearbeiten" : "Neues Gutachten";
    el.gutachtenName.value = g ? g.name || "" : patient.name || "";
    el.gutachtenGeburtsdatum.value = g ? g.geburtsdatum || "" : patient.geburtsdatum || "";
    el.gutachtenTelefon.value = g ? g.telefon || "" : patient.telefonnummer || "";
    el.gutachtenDatum.value = g ? g.datum || jetzigerZeitpunkt() : jetzigerZeitpunkt();
    el.gutachtenAussteller.textContent = g ? g.erstelltVon || "—" : aktuellerNutzer ? aktuellerNutzer.name : "—";
    el.gutachtenBegruendung.value = g ? g.begruendung || "" : "";
    el.gutachtenNotizen.value = g ? g.notizen || "" : "";

    oeffneModal("modal-gutachten-form");
    setzeGutachtenErgebnis(g ? g.ergebnis : "");
    passeTextareasAn(el.gutachtenNotizen.closest(".akte-blatt"));
  }

  [el.btnGutachtenNeu, el.btnGutachtenErste].forEach((knopf) => {
    if (knopf) knopf.addEventListener("click", () => oeffneGutachtenForm(null));
  });

  if (el.btnConfirmGutachten) {
    el.btnConfirmGutachten.addEventListener("click", async () => {
      versteckeFeldFehler(el.gutachtenError);
      if (!offenerPatientId) return;
      const name = el.gutachtenName.value.trim();
      const datum = el.gutachtenDatum.value;
      const begruendung = el.gutachtenBegruendung.value.trim();
      if (!gewaehltesGutachtenErgebnis) return zeigeFeldFehler(el.gutachtenError, "Bitte wähle das Ergebnis: Erteilt oder Nicht erteilt.");
      if (gewaehltesGutachtenErgebnis === "nicht-erteilt" && !begruendung) {
        return zeigeFeldFehler(el.gutachtenError, "Bitte gib eine Begründung an, warum das Gutachten nicht erteilt wurde.");
      }
      if (!name) return zeigeFeldFehler(el.gutachtenError, "Bitte gib den Namen der Person ein.");
      if (!datum) return zeigeFeldFehler(el.gutachtenError, "Bitte gib Datum und Uhrzeit ein.");

      const daten = {
        patientId: offenerPatientId,
        art: GUTACHTEN_ART_KLEIN,
        ergebnis: gewaehltesGutachtenErgebnis,
        begruendung: gewaehltesGutachtenErgebnis === "nicht-erteilt" ? begruendung : "",
        notizen: el.gutachtenNotizen.value.trim(),
        name,
        geburtsdatum: el.gutachtenGeburtsdatum.value.trim(),
        telefon: el.gutachtenTelefon.value.trim(),
        datum,
      };

      try {
        if (bearbeitetesGutachtenId) {
          daten.bearbeiter = aktuellerNutzer ? aktuellerNutzer.name : null;
          daten.bearbeitetAm = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection(GUTACHTEN_COLLECTION).doc(bearbeitetesGutachtenId).update(daten);
        } else {
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          await db.collection(GUTACHTEN_COLLECTION).add(daten);
        }
        schliesseModal("modal-gutachten-form");
        zeigeToast("Gutachten gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.gutachtenError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Gutachten als Dokument ----------------------------------------------
  function fuelleGutachtenDetail(g) {
    const zeile = (label, wert) => (wert ? `<div><dt>${label}</dt><dd>${escapeHtml(wert)}</dd></div>` : "");
    const abschnitt = (label, text) =>
      `<section class="akte-abschnitt"><h4 class="akte-abschnitt__label">${label}</h4><p>${escapeHtml(text)}</p></section>`;

    el.gutachtenDetailKicker.textContent = "Psychologisches Gutachten";
    el.gutachtenDetailTitel.textContent = g.name || "Gutachten";

    const person = [g.geburtsdatum ? `Geboren am ${g.geburtsdatum}` : "", g.telefon ? `Tel. ${g.telefon}` : ""].filter(Boolean).join(" · ");
    let inhalt = person ? `<p class="gutachten-person">${escapeHtml(person)}</p>` : "";
    inhalt += `<section class="akte-abschnitt"><h4 class="akte-abschnitt__label">Ergebnis</h4><p class="gutachten-ergebnis">${escapeHtml(gutachtenErgebnisText(g))}</p></section>`;
    if (g.ergebnis === "nicht-erteilt" && g.begruendung) inhalt += abschnitt("Begründung", g.begruendung);
    if (g.notizen) inhalt += abschnitt("Notizen", g.notizen);
    el.gutachtenDetailInhalt.innerHTML = inhalt;

    el.gutachtenDetailSeite.innerHTML =
      zeile("Art", g.art || GUTACHTEN_ART_KLEIN) +
      zeile("Ausgestellt am", formatDatumZeit(g.datum)) +
      zeile("Ausgestellt von", g.erstelltVon) +
      zeile("Zuletzt bearbeitet", g.bearbeiter ? `${g.bearbeiter} · ${formatDatumUhrzeit(g.bearbeitetAm)}` : "");
  }

  function oeffneGutachtenDetail(gutachtenId) {
    const g = gutachten.find((x) => x.id === gutachtenId);
    if (!g) return;
    offenesGutachtenId = gutachtenId;
    fuelleGutachtenDetail(g);
    el.btnGutachtenLoeschen.hidden = !istAdmin();
    oeffneModal("modal-gutachten-detail");
  }

  function gutachtenAlsText(g) {
    const zeilen = [`Psychologisches Gutachten - ${g.art || GUTACHTEN_ART_KLEIN}`, `Ergebnis: ${gutachtenErgebnisText(g)}`, ""];
    zeilen.push(`Name: ${g.name || "—"}`);
    if (g.geburtsdatum) zeilen.push(`Geburtsdatum: ${g.geburtsdatum}`);
    if (g.telefon) zeilen.push(`Telefon: ${g.telefon}`);
    zeilen.push(`Ausgestellt am: ${formatDatumZeit(g.datum)}`, `Ausgestellt von: ${g.erstelltVon || "—"}`);
    if (g.ergebnis === "nicht-erteilt" && g.begruendung) zeilen.push("", "Begründung:", g.begruendung);
    if (g.notizen) zeilen.push("", "Notizen:", g.notizen);
    return zeilen.join("\n");
  }

  if (el.btnGutachtenBearbeiten) {
    el.btnGutachtenBearbeiten.addEventListener("click", () => {
      const g = gutachten.find((x) => x.id === offenesGutachtenId);
      if (!g) return;
      offenesGutachtenId = null;
      schliesseModal("modal-gutachten-detail");
      oeffneGutachtenForm(g);
    });
  }

  if (el.btnGutachtenKopieren) {
    el.btnGutachtenKopieren.addEventListener("click", async () => {
      const g = gutachten.find((x) => x.id === offenesGutachtenId);
      if (!g) return;
      zeigeToast((await kopiereText(gutachtenAlsText(g))) ? "Gutachten in die Zwischenablage kopiert." : "Kopieren nicht möglich.");
    });
  }

  if (el.btnGutachtenLoeschen) {
    el.btnGutachtenLoeschen.addEventListener("click", () => {
      if (!offenesGutachtenId) return;
      loescheGutachtenMitBestaetigung(offenesGutachtenId, () => {
        offenesGutachtenId = null;
        schliesseModal("modal-gutachten-detail");
      });
    });
  }

  // Schließt der Nutzer das Dokument, ist es nicht mehr "offen" (sonst würde
  // ein späterer Snapshot es unsichtbar neu befüllen).
  const gutachtenDetailOverlay = document.getElementById("modal-gutachten-detail");
  if (gutachtenDetailOverlay) {
    new MutationObserver(() => {
      if (!gutachtenDetailOverlay.classList.contains("modal-overlay--visible")) offenesGutachtenId = null;
    }).observe(gutachtenDetailOverlay, { attributes: true, attributeFilter: ["class"] });
  }
