"use strict";

  /* ------------------------------------------------------------------------
     18. Patientenakten
     ------------------------------------------------------------------------
     Zwei flache Top-Level-Collections (keine Subcollections, wie im übrigen
     Bestand üblich): "patienten" (Profil: Name + Stammdaten) und "akten"
     (eine Behandlungs-Akte pro Dokument, referenziert ihren Patienten über
     das Feld "patientId"). Die Nummerierung "Akte 1, Akte 2, ..." wird NICHT
     gespeichert, sondern beim Anzeigen rein aus der nach "erstelltAm"
     aufsteigend sortierten Position innerhalb der Akten EINES Patienten
     berechnet (siehe patientAkten unten) - kein Zählerfeld, keine
     Race-Conditions beim gleichzeitigen Anlegen durch mehrere Nutzer.

     Aufbau: Patientenliste (Suche) -> eigene Patienten-Seite (view-patient-
     detail: Profil + Akten-Liste) -> Akte als Modal (ansehen/bearbeiten).
     Mehrere Spieler können gleichzeitig arbeiten: alle Listen aktualisieren
     sich live über Firestore; das Profilformular wird dabei bewusst NICHT
     von außen überschrieben, solange man es offen hat (siehe
     startePatientenListener), damit niemandem beim Tippen die Eingabe durch
     eine Änderung eines anderen Spielers weggenommen wird. */

  // ID der Akte, deren Detail-Modal gerade offen ist - rein lokal für diese
  // Datei, nicht in state.js, da es nur den Klick-Fluss hier betrifft.
  let offeneAkteDetailId = null;

  // Wurde der geöffnete Patient schon einmal in einem Snapshot gesehen? Nur
  // dann bedeutet sein späteres Fehlen "wurde gelöscht" (und nicht "Snapshot
  // ist noch nicht angekommen", z. B. direkt nach dem Anlegen).
  let offenerPatientGesehen = false;

  // Ist in einem Freitextfeld wirklich etwas Relevantes eingetragen? Reine
  // Platzhalter ("/", "-", "keine", "nein", "keine bekannt" ...) zählen als
  // leer - sonst würde z. B. "/" als Allergie gewertet und markiert.
  function hatEintrag(wert) {
    const t = (wert || "").trim().toLowerCase();
    if (!t) return false;
    if (/^[\s\/\\\-–—_.,;:?!*+#~]+$/.test(t)) return false;
    return !/^(keine?|kein|nein|nix|nichts|n\/?a|unbekannt|nicht bekannt)( (bekannt|erfasst|vorhanden|angegeben|allergien?|vorerkrankungen?))*\.?$/.test(t);
  }

  // Textfelder (.md-input) wachsen mit ihrem Inhalt statt zu scrollen. Muss
  // bei sichtbarem Feld laufen (versteckt ist scrollHeight 0).
  function passeTextareasAn(container) {
    (container || document).querySelectorAll("textarea.md-input").forEach((ta) => {
      ta.style.height = "auto";
      if (ta.scrollHeight > 0) ta.style.height = `${ta.scrollHeight + (ta.offsetHeight - ta.clientHeight)}px`;
    });
  }

  document.addEventListener("input", (event) => {
    const ta = event.target;
    if (ta && ta.matches && ta.matches("textarea.md-input")) passeTextareasAn(ta.parentElement);
  });

  function aktualisiereAllergieMarkierung() {
    if (!el.patientAllergien) return;
    const feld = el.patientAllergien.closest(".md-feld");
    if (feld) feld.classList.toggle("md-feld--aktiv", hatEintrag(el.patientAllergien.value));
  }

  if (el.patientAllergien) el.patientAllergien.addEventListener("input", aktualisiereAllergieMarkierung);

  // --- Text-Hilfen für Suche und Duplikat-Erkennung ------------------------
  // "falte": Kleinschreibung + Akzente weg ("Müller" -> "muller"), Länge bleibt
  // dabei gleich, damit Fundstellen im Originaltext markiert werden können.
  function falte(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  }

  function normalisiere(text) {
    return falte(text).replace(/\s+/g, " ").trim();
  }

  // Editierabstand inkl. Buchstabendreher ("Adrain" -> "Adrian" = 1). Namen
  // sind kurz, daher genügt die einfache Matrix.
  function editDistanz(a, b) {
    if (a === b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  function namenAlsText(namen) {
    if (namen.length <= 1) return namen[0] || "";
    return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
  }

  // Default-Wert für das <input type="datetime-local"> beim Anlegen einer
  // neuen Akte - "jetzt", auf die Minute genau.
  function jetzigerZeitpunkt() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Zeigt das in "akte-datum" gespeicherte datetime-local ("YYYY-MM-
  // DDTHH:mm") als "TT.MM.JJJJ, HH:mm Uhr" an.
  function formatDatumZeit(wert) {
    if (!wert) return "—";
    const d = new Date(wert);
    if (isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}, ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} Uhr`;
  }

  function starteAktenListener() {
    if (!db) return;
    if (unsubAkten) unsubAkten();
    unsubAkten = db
      .collection(AKTEN_COLLECTION)
      .orderBy("erstelltAm")
      .onSnapshot(
        (snap) => {
          akten = [];
          snap.forEach((docSnap) => akten.push({ id: docSnap.id, ...docSnap.data() }));
          // Anzeige-Listen werden live nachgezogen; ein offenes Akte-Formular
          // wird nie überschrieben, nur auf fremde Änderungen hingewiesen.
          renderPatientenListe();
          if (offenerPatientId) renderPatientDetailAkten(offenerPatientId);
          pruefeAkteKonflikt();
        },
        (fehler) => console.error("Akten konnten nicht geladen werden:", fehler)
      );
  }

  function startePatientenListener() {
    if (!db) return;
    if (unsubPatienten) unsubPatienten();
    unsubPatienten = db
      .collection(PATIENTEN_COLLECTION)
      .orderBy("name")
      .onSnapshot(
        (snap) => {
          patienten = [];
          snap.forEach((docSnap) => patienten.push({ id: docSnap.id, ...docSnap.data() }));
          // Firestore sortiert nach Unicode (Großbuchstaben vor Kleinbuchstaben,
          // Umlaute ganz hinten) - für das Register alphabetisch nach
          // deutscher Reihenfolge, Groß-/Kleinschreibung egal.
          patienten.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" }));
          renderPatientenListe();
          // Termine zeigen den aktuellen Patientennamen (und den Link zur Akte).
          if (typeof renderTermine === "function") renderTermine();
          // Das Profilformular der gerade offenen Patienten-Seite wird nie
          // über ungespeicherte Eingaben hinweg überschrieben (siehe
          // pruefeProfilKonflikt): hat der Nutzer noch nichts getippt, wird es
          // still aktualisiert, sonst erscheint ein Hinweis mit Wahl.
          if (offenerPatientId) {
            const p = patienten.find((x) => x.id === offenerPatientId);
            if (p) {
              offenerPatientGesehen = true;
              aktualisiereProfilKopf(p);
              pruefeProfilKonflikt(p);
            } else if (offenerPatientGesehen) {
              // Ein Admin hat den Patienten gelöscht, während er hier offen war.
              offenerPatientId = null;
              offenerPatientGesehen = false;
              if (aktuelleAnsicht === "patient-detail") zeigeAnsicht("patientenakten");
              zeigeToast("Dieser Patient wurde gelöscht.");
            }
          }
        },
        (fehler) => console.error("Patienten konnten nicht geladen werden:", fehler)
      );
  }

  // --- Patientenliste + Suche ----------------------------------------------
  // Durchsucht nicht nur den Namen, sondern alle Profilfelder und den Inhalt
  // aller Akten eines Patienten. Jedes Suchwort muss irgendwo vorkommen
  // (Groß-/Kleinschreibung und Akzente egal). Treffer im Namen stehen oben;
  // bei Treffern nur im Inhalt zeigt die Zeile zusätzlich die Fundstelle.
  function patientFelder(p) {
    const felder = [
      ["Geburtsdatum", p.geburtsdatum],
      ["Telefon", p.telefonnummer],
      ["Allergien", p.allergien],
      ["Vorerkrankungen", p.vorerkrankungen],
      ["Hinweise", p.besondereHinweise],
      ["Notfallkontakt", p.notfallkontakt],
      ["Notfallkontakt Telefon", p.notfallkontaktTelefon],
    ].map(([ort, text]) => ({ ort, text: text || "" }));
    patientAkten(p.id).forEach((a) => {
      [
        ["Behandlungsgrund", a.behandlungsgrund],
        ["Hergang", a.hergang],
        ["Befund", a.befund],
        ["Behandlung", a.behandlung],
        ["Zusätzliche Informationen", a.bemerkungen],
      ].forEach(([feld, text]) => felder.push({ ort: `Akte vom ${formatDatum(a.datum)} · ${feld}`, text: text || "" }));
    });
    return felder;
  }

  function sucheInPatient(p, tokens) {
    const name = normalisiere(p.name);
    const felder = patientFelder(p);
    const gefaltet = felder.map((f) => falte(f.text));
    if (!tokens.every((t) => name.includes(t) || gefaltet.some((g) => g.includes(t)))) return null;
    if (tokens.every((t) => name.includes(t))) return { imName: true, fundstelle: null };
    const token = tokens.find((t) => !name.includes(t));
    const index = gefaltet.findIndex((g) => g.includes(token));
    return {
      imName: false,
      fundstelle: index < 0 ? null : { ort: felder[index].ort, text: felder[index].text, start: gefaltet[index].indexOf(token), laenge: token.length },
    };
  }

  function fundstelleHtml(f) {
    const von = Math.max(0, f.start - 36);
    const bis = Math.min(f.text.length, f.start + f.laenge + 64);
    const flach = (s) => escapeHtml(s.replace(/\s+/g, " "));
    return `<span class="pat-zeile__treffer"><span class="pat-zeile__treffer-ort">${escapeHtml(f.ort)}</span>${von > 0 ? "…" : ""}${flach(
      f.text.slice(von, f.start)
    )}<mark>${flach(f.text.slice(f.start, f.start + f.laenge))}</mark>${flach(f.text.slice(f.start + f.laenge, bis))}${bis < f.text.length ? "…" : ""}</span>`;
  }

  // Liefert [{ p, treffer }] - treffer ist null ohne Suchbegriff.
  function gefiltertPatienten() {
    const tokens = normalisiere(patientenSuche).split(" ").filter(Boolean);
    if (!tokens.length) return patienten.map((p) => ({ p, treffer: null }));
    const ergebnisse = [];
    patienten.forEach((p) => {
      const treffer = sucheInPatient(p, tokens);
      if (treffer) ergebnisse.push({ p, treffer });
    });
    // Sortierung ist stabil: innerhalb der Gruppen bleibt es alphabetisch.
    return ergebnisse.sort((a, b) => Number(b.treffer.imName) - Number(a.treffer.imName));
  }

  function renderPatientenListe() {
    if (!el.patientenListe) return;
    const liste = gefiltertPatienten();
    const suche = patientenSuche.trim() !== "";
    el.patientenEmpty.hidden = patienten.length !== 0;
    el.patientenNoResults.hidden = !(patienten.length > 0 && liste.length === 0);

    if (liste.length === 0) {
      el.patientenListe.innerHTML = "";
      return;
    }

    // Register mit Buchstabengruppen (die Liste ist bereits alphabetisch
    // sortiert, siehe startePatientenListener) - bei einer Suche ohne
    // Gruppen, damit die Treffer-Reihenfolge (Name zuerst) sichtbar bleibt.
    let html = `<div class="pat-spaltenkopf">
        <span></span><span>Patient</span><span>Geburtsdatum</span><span>Akten</span><span>Letzte Behandlung</span><span>Waffenschein</span><span></span>
      </div>`;
    let aktuellerBuchstabe = "";
    liste.forEach(({ p, treffer }) => {
      // Diakritika entfernen, damit Ä/Ö/Ü in der Gruppe A/O/U landen.
      const erster = (p.name || "").trim().normalize("NFD").charAt(0).toLocaleUpperCase("de");
      const buchstabe = /\p{L}/u.test(erster) ? erster : "#";
      let buchstabeZelle = "";
      if (!suche && buchstabe !== aktuellerBuchstabe) {
        aktuellerBuchstabe = buchstabe;
        buchstabeZelle = escapeHtml(buchstabe);
      }
      const seine = patientAkten(p.id);
      // Waffenschein: Ergebnis des neuesten Gutachtens (siehe js/views/gutachten.js).
      const seinGutachten = patientGutachten(p.id);
      const waffenschein = seinGutachten.length ? escapeHtml(gutachtenErgebnisText(seinGutachten[seinGutachten.length - 1])) : "—";
      const letzte = seine.reduce((max, a) => (a.datum && a.datum > max ? a.datum : max), "");
      html += `<div class="pat-zeile" data-patient-oeffnen="${p.id}">
          <span class="pat-zeile__buchstabe">${buchstabeZelle}</span>
          <span class="pat-zeile__name">
            <span class="pat-zeile__titel">
              <span>${escapeHtml(p.name)}</span>
              ${hatEintrag(p.allergien) ? '<span class="pat-zeile__warn">Allergien</span>' : ""}
            </span>
            ${treffer && treffer.fundstelle ? fundstelleHtml(treffer.fundstelle) : ""}
          </span>
          <span class="pat-zeile__geb">${escapeHtml(p.geburtsdatum || "—")}</span>
          <span class="pat-zeile__akten">${seine.length}</span>
          <span class="pat-zeile__letzte">${letzte ? escapeHtml(formatDatumZeit(letzte).split(",")[0]) : "—"}</span>
          <span class="pat-zeile__gutachten">${waffenschein}</span>
          <svg class="pat-zeile__pfeil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>
        </div>`;
    });
    el.patientenListe.innerHTML = html;
  }

  if (el.patientenSearch) {
    el.patientenSearch.addEventListener("input", () => {
      patientenSuche = el.patientenSearch.value;
      renderPatientenListe();
    });
  }

  if (el.patientenListe) {
    el.patientenListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-patient-oeffnen]");
      if (!zeile) return;
      oeffnePatientSeite(zeile.getAttribute("data-patient-oeffnen"));
    });
  }

  // --- Patient anlegen -------------------------------------------------
  // Duplikat-Schutz: Beim Tippen werden bereits vorhandene, ähnliche Namen
  // angezeigt (auch vertauschte Reihenfolge, Tippfehler, angefangene Namen).
  // Ein exakt gleicher Name wird erst nach ausdrücklicher Bestätigung ("Trotzdem
  // anlegen") angelegt - zwei Patienten mit demselben Namen kann es im RP
  // durchaus geben, aber nicht versehentlich.
  function aehnlichePatienten(name) {
    const q = normalisiere(name);
    if (q.length < 3) return [];
    const qt = q.split(" ");
    const passt = (von, gegen) =>
      von.every((t) => gegen.some((g) => g === t || (t.length >= 3 && g.startsWith(t)) || (t.length >= 5 && g.length >= 5 && editDistanz(t, g) <= 1)));
    const treffer = [];
    patienten.forEach((p) => {
      const c = normalisiere(p.name);
      if (!c) return;
      const ct = c.split(" ");
      const exakt = qt.length === ct.length && [...qt].sort().join(" ") === [...ct].sort().join(" ");
      if (exakt || passt(qt, ct) || passt(ct, qt)) treffer.push({ patient: p, exakt });
    });
    return treffer.sort((a, b) => Number(b.exakt) - Number(a.exakt)).slice(0, 4);
  }

  let anlegenTrotzdemBestaetigt = false;

  function aktualisiereAehnlichkeit() {
    anlegenTrotzdemBestaetigt = false;
    el.btnConfirmPatientAnlegen.textContent = "Anlegen";
    versteckeFeldFehler(el.patientAnlegenError);
    const treffer = aehnlichePatienten(el.patientAnlegenName.value);
    el.patientAnlegenAehnlich.hidden = treffer.length === 0;
    if (!treffer.length) {
      el.patientAnlegenAehnlich.innerHTML = "";
      return;
    }
    const gleich = treffer.some((t) => t.exakt);
    el.patientAnlegenAehnlich.innerHTML =
      `<p class="aehnlich__titel${gleich ? " aehnlich__titel--warn" : ""}">${
        gleich ? "Diesen Patienten gibt es schon" : "Ähnliche Patienten sind bereits angelegt"
      }</p>` +
      treffer
        .map(({ patient }) => {
          const n = patientAkten(patient.id).length;
          const info = [patient.geburtsdatum, `${n} ${n === 1 ? "Akte" : "Akten"}`].filter(Boolean).join(" · ");
          return `<button type="button" class="aehnlich__zeile" data-aehnlich-oeffnen="${patient.id}">
              <span class="aehnlich__name">${escapeHtml(patient.name)}</span>
              <span class="aehnlich__info">${escapeHtml(info)}</span>
            </button>`;
        })
        .join("");
  }

  if (el.patientAnlegenName) {
    el.patientAnlegenName.addEventListener("input", aktualisiereAehnlichkeit);
    el.patientAnlegenName.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && el.btnConfirmPatientAnlegen) el.btnConfirmPatientAnlegen.click();
    });
  }

  if (el.patientAnlegenAehnlich) {
    el.patientAnlegenAehnlich.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-aehnlich-oeffnen]");
      if (!zeile) return;
      schliesseModal("modal-patient-anlegen");
      oeffnePatientSeite(zeile.getAttribute("data-aehnlich-oeffnen"));
    });
  }

  if (el.btnPatientAnlegen) {
    el.btnPatientAnlegen.addEventListener("click", () => {
      el.patientAnlegenName.value = "";
      aktualisiereAehnlichkeit();
      oeffneModal("modal-patient-anlegen");
      el.patientAnlegenName.focus();
    });
  }

  if (el.btnConfirmPatientAnlegen) {
    el.btnConfirmPatientAnlegen.addEventListener("click", async () => {
      versteckeFeldFehler(el.patientAnlegenError);
      const name = el.patientAnlegenName.value.trim();
      if (!name) return zeigeFeldFehler(el.patientAnlegenError, "Bitte gib einen Namen ein.");
      if (aehnlichePatienten(name).some((t) => t.exakt) && !anlegenTrotzdemBestaetigt) {
        anlegenTrotzdemBestaetigt = true;
        el.btnConfirmPatientAnlegen.textContent = "Trotzdem anlegen";
        return zeigeFeldFehler(el.patientAnlegenError, "Einen Patienten mit diesem Namen gibt es schon. Zum Anlegen noch einmal klicken.");
      }
      try {
        const ref = await db.collection(PATIENTEN_COLLECTION).add({
          name,
          geburtsdatum: "",
          telefonnummer: "",
          allergien: "",
          vorerkrankungen: "",
          besondereHinweise: "",
          notfallkontakt: "",
          notfallkontaktTelefon: "",
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
          erstelltVon: aktuellerNutzer ? aktuellerNutzer.name : null,
          bearbeiter: null,
          bearbeitetAm: null,
        });
        schliesseModal("modal-patient-anlegen");
        zeigeToast("Patient angelegt.");
        oeffnePatientSeite(ref.id, { id: ref.id, name }, true);
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.patientAnlegenError, "Anlegen fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Patienten-Seite (Profil + Akten-Liste) ------------------------------
  // "vorabDaten" wird nur direkt nach dem Anlegen übergeben, damit die Seite
  // sofort mit dem gerade eingegebenen Namen öffnet, statt kurz leer zu
  // erscheinen, bis der Firestore-Listener zurückkommt.
  // "bearbeiten" = direkt im Bearbeiten-Modus öffnen (frisch angelegter Patient:
  // dort fehlen ja noch alle Angaben).
  function oeffnePatientSeite(patientId, vorabDaten, bearbeiten) {
    const p = patienten.find((x) => x.id === patientId) || vorabDaten || { id: patientId, name: "" };
    offenerPatientId = patientId;
    offenerPatientGesehen = patienten.some((x) => x.id === patientId);
    patientAktenSuchbegriff = "";
    if (el.patientAktenSuche) el.patientAktenSuche.value = "";
    zeigeAnsicht("patient-detail");
    fuellePatientDetailFelder(p);
    setzeProfilBearbeiten(!!bearbeiten);
    renderPatientDetailAkten(patientId);
    setzePatientTab("akten");
    aktualisiereAdminSteuerung();
    if (bearbeiten && el.patientGeburtsdatum) el.patientGeburtsdatum.focus();
  }

  // Löschen von Patienten ist Admins vorbehalten (siehe firestore.rules) -
  // der Button wird nur für sie eingeblendet. Gleiches gilt für das Löschen
  // von Gutachten (Löschen-Knöpfe in der Liste).
  function aktualisiereAdminSteuerung() {
    if (el.btnPatientLoeschen) el.btnPatientLoeschen.hidden = !istAdmin();
    if (offenerPatientId) renderPatientDetailGutachten(offenerPatientId);
  }

  if (el.btnPatientLoeschen) {
    el.btnPatientLoeschen.addEventListener("click", () => {
      if (!istAdmin() || !offenerPatientId) return;
      const id = offenerPatientId;
      const p = patienten.find((x) => x.id === id);
      const seineAkten = akten.filter((a) => a.patientId === id);
      const seineGutachten = gutachten.filter((g) => g.patientId === id);
      const teile = [];
      if (seineAkten.length) teile.push(`${seineAkten.length} ${seineAkten.length === 1 ? "Akte" : "Akten"}`);
      if (seineGutachten.length) teile.push(`${seineGutachten.length} Gutachten`);
      const text = teile.length
        ? `Möchtest du ${p ? p.name : "diesen Patienten"} samt ${teile.join(" und ")} wirklich unwiderruflich löschen?`
        : `Möchtest du ${p ? p.name : "diesen Patienten"} wirklich unwiderruflich löschen?`;
      fordereLoeschungAn("Patient löschen", text, async () => {
        const batch = db.batch();
        seineAkten.forEach((a) => batch.delete(db.collection(AKTEN_COLLECTION).doc(a.id)));
        seineGutachten.forEach((g) => batch.delete(db.collection(GUTACHTEN_COLLECTION).doc(g.id)));
        batch.delete(db.collection(PATIENTEN_COLLECTION).doc(id));
        // Vor dem Commit zurücksetzen, damit der Listener das Verschwinden
        // nicht als "von jemand anderem gelöscht" meldet.
        offenerPatientId = null;
        offenerPatientGesehen = false;
        try {
          await batch.commit();
        } catch (fehler) {
          offenerPatientId = id;
          offenerPatientGesehen = true;
          throw fehler;
        }
        seineAkten.forEach((a) => loescheFreigabenFuerAkte(a.id));
        zeigeAnsicht("patientenakten");
        zeigeToast("Patient gelöscht.");
      });
    });
  }

  // Lese-Ansicht des Patienten (Kopf mit Stammdaten, Hinweise, "zuletzt
  // bearbeitet") - reine Anzeige, wird bei jedem Snapshot live nachgezogen. Die
  // Eingabefelder des Bearbeiten-Formulars sind davon getrennt (siehe
  // fuellePatientDetailFelder und den Kollisionsschutz weiter unten).
  function kopfDatenHtml(p) {
    const eintraege = [];
    const eintrag = (label, wert) =>
      `<span class="pkopf__eintrag"><span class="pkopf__label">${label}</span><span class="pkopf__wert">${escapeHtml(wert)}</span></span>`;
    if (p.geburtsdatum) eintraege.push(eintrag("Geburtsdatum", p.geburtsdatum));
    if (p.telefonnummer) eintraege.push(eintrag("Telefon", p.telefonnummer));
    const notfall = [p.notfallkontakt, p.notfallkontaktTelefon].filter(Boolean).join(", ");
    if (notfall) eintraege.push(eintrag("Notfallkontakt", notfall));
    return eintraege.length ? eintraege.join("") : '<span class="pkopf__leer">Noch keine Stammdaten erfasst.</span>';
  }

  // Allergien als rote Zeile, Vorerkrankungen/Hinweise als ruhige Zeilen -
  // jeweils nur, wenn wirklich etwas Relevantes drinsteht (siehe hatEintrag).
  function hinweiseHtml(p) {
    const zeile = (label, wert) => `<p class="phinweise__zeile"><span class="phinweise__label">${label}</span>${escapeHtml(wert)}</p>`;
    let html = "";
    if (hatEintrag(p.allergien)) {
      html += `<div class="akte-hinweis"><p class="akte-hinweis__zeile"><span class="akte-hinweis__label">Allergien</span>${escapeHtml(p.allergien)}</p></div>`;
    }
    if (hatEintrag(p.vorerkrankungen)) html += zeile("Vorerkrankungen", p.vorerkrankungen);
    if (hatEintrag(p.besondereHinweise)) html += zeile("Besondere Hinweise", p.besondereHinweise);
    return html;
  }

  function aktualisiereProfilKopf(p) {
    if (el.patientKopfName) el.patientKopfName.textContent = p.name || "Patient";
    if (el.patientKopfDaten) el.patientKopfDaten.innerHTML = kopfDatenHtml(p);
    if (el.patientHinweise) {
      // Ohne Hinweise bleibt der Bereich komplett weg (kein Leertext).
      const hinweise = hinweiseHtml(p);
      el.patientHinweise.innerHTML = hinweise;
      el.patientHinweise.hidden = !hinweise;
    }
    if (el.patientProfilMeta) {
      el.patientProfilMeta.textContent = p.bearbeiter
        ? `Zuletzt bearbeitet von ${p.bearbeiter} · ${formatDatumUhrzeit(p.bearbeitetAm)}`
        : p.erstelltVon
        ? `Angelegt von ${p.erstelltVon}`
        : "";
    }
  }

  // Bearbeiten-Modus: das Formular ersetzt Stammdaten-Zeile und Hinweise (per
  // CSS-Klasse), die Akten darunter bleiben sichtbar.
  function setzeProfilBearbeiten(an) {
    if (!el.patientEdit || !el.viewPatientDetail) return;
    el.viewPatientDetail.classList.toggle("patient-seite--bearbeiten", an);
    el.patientEdit.hidden = !an;
    if (an) passeTextareasAn(el.patientEdit);
  }

  // Befüllt die Eingabefelder - nur beim ÖFFNEN der Seite, nie durch einen
  // Live-Snapshot (siehe startePatientenListener).
  function fuellePatientDetailFelder(p) {
    aktualisiereProfilKopf(p);
    el.patientDetailId.value = p.id;
    el.patientDetailName.value = p.name || "";
    el.patientGeburtsdatum.value = p.geburtsdatum || "";
    el.patientTelefonnummer.value = p.telefonnummer || "";
    el.patientAllergien.value = p.allergien || "";
    el.patientVorerkrankungen.value = p.vorerkrankungen || "";
    el.patientBesondereHinweise.value = p.besondereHinweise || "";
    el.patientNotfallkontakt.value = p.notfallkontakt || "";
    el.patientNotfallkontaktTelefon.value = p.notfallkontaktTelefon || "";
    versteckeFeldFehler(el.patientProfilError);
    aktualisiereAllergieMarkierung();
    passeTextareasAn(el.patientEdit);
    profilBasisStempel = zeitstempelWert(p.bearbeitetAm);
    profilGeaendert = false;
    setzeProfilKonflikt(false);
  }

  // --- Kollisionsschutz Profil -----------------------------------------------
  // Mehrere Spieler können dasselbe Profil offen haben. Ändert jemand anderes
  // es, während ich es offen habe:
  // - habe ich noch nichts getippt: Felder werden still aktualisiert,
  // - habe ich schon getippt: Hinweis + Wahl (neu laden ODER "Trotzdem
  //   speichern", was die fremde Änderung überschreibt).
  // "profilBasisStempel" ist der Änderungszeitpunkt der Version, die gerade
  // im Formular steht.
  let profilBasisStempel = 0;
  let profilGeaendert = false;

  function setzeProfilKonflikt(aktiv, text) {
    if (!el.patientKonflikt) return;
    el.patientKonflikt.hidden = !aktiv;
    if (aktiv) el.patientKonfliktText.textContent = text;
    el.btnConfirmPatientProfil.textContent = aktiv ? "Trotzdem speichern" : "Speichern";
  }

  function pruefeProfilKonflikt(p) {
    if (!aktuellerNutzer) return;
    const stempel = zeitstempelWert(p.bearbeitetAm);
    if (p.bearbeiter === aktuellerNutzer.name) {
      // Eigene Änderung (kommt nach dem Speichern als Snapshot zurück).
      if (stempel) profilBasisStempel = stempel;
      setzeProfilKonflikt(false);
      return;
    }
    if (stempel <= profilBasisStempel) return;
    if (!profilGeaendert) {
      fuellePatientDetailFelder(p);
      return;
    }
    setzeProfilKonflikt(true, `${p.bearbeiter || "Jemand"} hat dieses Profil gerade geändert (${formatDatumUhrzeit(p.bearbeitetAm)}). Wenn du jetzt speicherst, wird das überschrieben.`);
  }

  if (el.patientEdit) el.patientEdit.addEventListener("input", () => (profilGeaendert = true));

  if (el.btnPatientKonfliktLaden) {
    el.btnPatientKonfliktLaden.addEventListener("click", () => {
      const p = patienten.find((x) => x.id === offenerPatientId);
      if (p) fuellePatientDetailFelder(p);
    });
  }

  if (el.btnPatientBearbeiten) {
    el.btnPatientBearbeiten.addEventListener("click", () => {
      const p = patienten.find((x) => x.id === offenerPatientId);
      if (!p) return;
      // Immer mit dem aktuellen Stand starten (setzt auch den Kollisions-
      // Ausgangspunkt neu).
      fuellePatientDetailFelder(p);
      setzeProfilBearbeiten(true);
      el.patientDetailName.focus();
    });
  }

  if (el.btnPatientAbbrechen) {
    el.btnPatientAbbrechen.addEventListener("click", () => {
      const p = patienten.find((x) => x.id === offenerPatientId);
      if (p) fuellePatientDetailFelder(p);
      setzeProfilBearbeiten(false);
    });
  }

  if (el.btnConfirmPatientProfil) {
    el.btnConfirmPatientProfil.addEventListener("click", async () => {
      versteckeFeldFehler(el.patientProfilError);
      const id = el.patientDetailId.value;
      const name = el.patientDetailName.value.trim();
      if (!id) return;
      if (!name) return zeigeFeldFehler(el.patientProfilError, "Bitte gib einen Namen ein.");
      try {
        await db
          .collection(PATIENTEN_COLLECTION)
          .doc(id)
          .update({
            name,
            geburtsdatum: el.patientGeburtsdatum.value.trim(),
            telefonnummer: el.patientTelefonnummer.value.trim(),
            allergien: el.patientAllergien.value.trim(),
            vorerkrankungen: el.patientVorerkrankungen.value.trim(),
            besondereHinweise: el.patientBesondereHinweise.value.trim(),
            notfallkontakt: el.patientNotfallkontakt.value.trim(),
            notfallkontaktTelefon: el.patientNotfallkontaktTelefon.value.trim(),
            bearbeiter: aktuellerNutzer ? aktuellerNutzer.name : null,
            bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
          });
        profilGeaendert = false;
        setzeProfilBearbeiten(false);
        zeigeToast("Profil gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.patientProfilError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Akten eines Patienten -------------------------------------------
  function patientAkten(patientId) {
    return akten.filter((a) => a.patientId === patientId).sort((a, b) => zeitstempelWert(a.erstelltAm) - zeitstempelWert(b.erstelltAm));
  }

  // Neueste Akte zuerst (wie eine Fallhistorie), die Nummer "Akte N" bleibt
  // aber die chronologische Reihenfolge des Anlegens - Akte 1 ist immer die
  // erste, egal wie herum die Liste sortiert angezeigt wird.
  // Suche innerhalb der Akten des offenen Patienten (nur ab MIN_AKTEN_FUER_SUCHE
  // Akten sichtbar) und Monatsüberschriften in der Zeitleiste (ebenfalls erst
  // ab dieser Anzahl) - bei ein, zwei Akten wäre beides nur Ballast.
  const MIN_AKTEN_FUER_SUCHE = 4;
  let patientAktenSuchbegriff = "";

  function aktePasstZurSuche(a, tokens) {
    const text = falte([a.behandlungsgrund, a.hergang, a.befund, a.behandlung, a.bemerkungen, a.erstelltVon].filter(Boolean).join(" "));
    return tokens.every((t) => text.includes(t));
  }

  function monatUeberschrift(datum) {
    const d = new Date(datum);
    return isNaN(d.getTime()) ? "Ohne Datum" : d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  function renderPatientDetailAkten(patientId) {
    if (!el.patientAktenListe) return;
    const chronologisch = patientAkten(patientId);
    const gesamt = chronologisch.length;
    el.patientAktenLeer.hidden = gesamt !== 0;

    const suchbar = gesamt >= MIN_AKTEN_FUER_SUCHE;
    el.ptabZaehlerAkten.textContent = gesamt || "";
    if (el.patientAktenSuche) {
      el.patientAktenSuche.hidden = !suchbar;
      el.patientAktenSuche.closest(".pakten__kopf").hidden = !suchbar;
      if (!suchbar && patientAktenSuchbegriff) {
        patientAktenSuchbegriff = "";
        el.patientAktenSuche.value = "";
      }
    }
    const tokens = suchbar ? normalisiere(patientAktenSuchbegriff).split(" ").filter(Boolean) : [];

    // Neueste zuerst.
    const sichtbar = chronologisch
      .slice()
      .reverse()
      .filter((a) => !tokens.length || aktePasstZurSuche(a, tokens));

    if (el.patientAktenAnzahl) {
      el.patientAktenAnzahl.textContent = tokens.length ? `${sichtbar.length} von ${gesamt} ${gesamt === 1 ? "Akte" : "Akten"}` : "";
    }

    if (gesamt && !sichtbar.length) {
      el.patientAktenListe.innerHTML = '<p class="empty-state">Keine Akte passt zur Suche.</p>';
      return;
    }

    let letzterMonat = "";
    el.patientAktenListe.innerHTML = sichtbar
      .map((a) => {
        let monat = "";
        if (suchbar) {
          const m = monatUeberschrift(a.datum);
          if (m !== letzterMonat) {
            letzterMonat = m;
            monat = `<h4 class="akten-monat">${escapeHtml(m)}</h4>`;
          }
        }
        // Zugeklappt: Behandlungsgrund + eine Vorschau-Zeile (Hergang, sonst
        // Befund/Behandlung). Der ganze Inhalt steht im Akte-Fenster.
        const vorschau = a.hergang || a.befund || a.behandlung || "";
        const uhrzeit = formatDatumZeit(a.datum).split(", ")[1] || "";
        return `${monat}<div class="akte-zeile akte-zeile--ohne-nr" tabindex="0" data-akte-oeffnen="${a.id}">
            <span class="akte-zeile__haupt">
              <span class="akte-zeile__titel">${escapeHtml(a.behandlungsgrund || "Behandlungsakte")}<span class="akte-titel-datum"> · ${escapeHtml(formatDatum(a.datum))}</span></span>
              ${vorschau ? `<span class="akte-zeile__vorschau">${escapeHtml(vorschau)}</span>` : ""}
            </span>
            <span class="akte-zeile__datum">${escapeHtml(uhrzeit)}</span>
            <span class="akte-zeile__autor">${escapeHtml(a.erstelltVon || "—")}</span>
            <button type="button" class="akte-zeile__loeschen" data-akte-loeschen="${a.id}" title="Akte löschen" aria-label="Akte vom ${escapeHtml(formatDatum(a.datum))} löschen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            <svg class="akte-zeile__pfeil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>
          </div>`;
      })
      .join("");
  }

  if (el.patientAktenSuche) {
    el.patientAktenSuche.addEventListener("input", () => {
      patientAktenSuchbegriff = el.patientAktenSuche.value;
      if (offenerPatientId) renderPatientDetailAkten(offenerPatientId);
    });
  }

  if (el.patientAktenListe) {
    const oeffneEintrag = (event) => {
      const loeschen = event.target.closest("[data-akte-loeschen]");
      if (loeschen) {
        loescheAkteMitBestaetigung(loeschen.getAttribute("data-akte-loeschen"));
        return;
      }
      const eintrag = event.target.closest("[data-akte-oeffnen]");
      if (!eintrag) return;
      oeffneAkteDetailModal(eintrag.getAttribute("data-akte-oeffnen"));
    };
    el.patientAktenListe.addEventListener("click", oeffneEintrag);
    el.patientAktenListe.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Auf dem Löschen-Button selbst löst der Browser den Klick von allein
      // aus - nicht zusätzlich hier behandeln, sonst doppelt.
      if (event.target.closest("[data-akte-loeschen]")) return;
      event.preventDefault();
      oeffneEintrag(event);
    });
  }

  // Gemeinsam für den Löschen-Knopf in der Zeitleiste und im Akte-Fenster.
  function loescheAkteMitBestaetigung(akteId, danach) {
    const akte = akten.find((x) => x.id === akteId);
    const bezeichnung = akte ? `die Akte vom ${formatDatum(akte.datum)}` : "diese Akte";
    fordereLoeschungAn("Akte löschen", `Möchtest du ${bezeichnung} wirklich unwiderruflich löschen?`, async () => {
      await db.collection(AKTEN_COLLECTION).doc(akteId).delete();
      // Zugehörige Zugriffslinks (Kopien) mit entfernen.
      loescheFreigabenFuerAkte(akteId);
      if (danach) danach();
      zeigeToast("Akte gelöscht.");
    });
  }

  [el.btnAkteNeu, el.btnAkteErste].forEach((knopf) => {
    if (!knopf) return;
    knopf.addEventListener("click", () => {
      if (!offenerPatientId) return;
      oeffneAkteFormModal(offenerPatientId, null);
    });
  });

  // --- Akte anlegen/bearbeiten (ein gemeinsames Formular) -------------------
  const AKTE_TITEL_MAX = 60;

  function aktualisiereTitelZaehler() {
    if (el.akteTitelZaehler) el.akteTitelZaehler.textContent = `${el.akteBehandlungsgrund.value.length} / ${AKTE_TITEL_MAX}`;
  }

  if (el.akteBehandlungsgrund) el.akteBehandlungsgrund.addEventListener("input", aktualisiereTitelZaehler);

  function fuelleAkteFormFelder(a) {
    // Altwerte ohne Uhrzeit (noch mit reinem Datumsfeld angelegte Akten)
    // werden auf "00:00" ergänzt, sonst würde das datetime-local-Feld sie
    // stillschweigend verwerfen und leer bleiben.
    el.akteDatum.value = a ? (a.datum && !a.datum.includes("T") ? `${a.datum}T00:00` : a.datum) || jetzigerZeitpunkt() : jetzigerZeitpunkt();
    el.akteBehandlungsgrund.value = a ? a.behandlungsgrund || "" : "";
    aktualisiereTitelZaehler();
    el.akteHergang.value = a ? a.hergang || "" : "";
    el.akteBefund.value = a ? a.befund || "" : "";
    el.akteBehandlung.value = a ? a.behandlung || "" : "";
    el.akteBemerkungen.value = a ? a.bemerkungen || "" : "";
    passeTextareasAn(el.akteBehandlungsgrund.closest(".akte-blatt"));
  }

  function oeffneAkteFormModal(patientId, akteId) {
    bearbeiteteAkteId = akteId;
    const patient = patienten.find((x) => x.id === patientId);
    el.akteFormPatientId.value = patientId;
    el.akteFormPatientName.textContent = patient ? patient.name : "";
    el.akteFormPatientGeb.textContent = patient && patient.geburtsdatum ? ` · geboren am ${patient.geburtsdatum}` : "";
    // Allergien/Vorerkrankungen beim Schreiben im Blick behalten.
    const hinweise = [
      ["Allergien", patient && hatEintrag(patient.allergien) ? patient.allergien : ""],
      ["Vorerkrankungen", patient && hatEintrag(patient.vorerkrankungen) ? patient.vorerkrankungen : ""],
    ].filter(([, wert]) => wert);
    el.akteFormHinweise.innerHTML = hinweise
      .map(([label, wert]) => `<p class="akte-hinweis__zeile"><span class="akte-hinweis__label">${label}</span>${escapeHtml(wert)}</p>`)
      .join("");
    el.akteFormHinweise.hidden = !hinweise.length;
    versteckeFeldFehler(el.akteError);

    const a = akteId ? akten.find((x) => x.id === akteId) : null;
    el.akteFormTitel.textContent = akteId ? "Akte bearbeiten" : "Neue Akte";
    el.akteEditingId.value = akteId || "";
    akteBasisStempel = a ? zeitstempelWert(a.bearbeitetAm) : 0;
    setzeAkteKonflikt(false);

    oeffneModal("modal-akte-form");
    fuelleAkteFormFelder(a);
    // Anderen zeigen, dass ich diese Akte gerade bearbeite.
    setzePraesenzAkte(akteId || null);
    aktualisiereAnwesenheit();
  }

  // --- Kollisionsschutz Akte -------------------------------------------------
  // Wie beim Profil: ändert jemand anderes die Akte, während ich sie im
  // Formular offen habe, erscheint ein Hinweis; das Speichern überschreibt
  // dann bewusst ("Trotzdem speichern"). Ein offenes Formular wird nie still
  // überschrieben.
  let akteBasisStempel = 0;

  function akteFormSichtbar() {
    const overlay = document.getElementById("modal-akte-form");
    return !!overlay && overlay.classList.contains("modal-overlay--visible");
  }

  function setzeAkteKonflikt(aktiv, text, geloescht) {
    if (!el.akteKonflikt) return;
    el.akteKonflikt.hidden = !aktiv;
    if (aktiv) el.akteKonfliktText.textContent = text;
    el.btnAkteKonfliktLaden.hidden = !!geloescht;
    el.btnConfirmAkte.disabled = !!geloescht;
    el.btnConfirmAkte.textContent = aktiv && !geloescht ? "Trotzdem speichern" : "Speichern";
  }

  function pruefeAkteKonflikt() {
    if (!bearbeiteteAkteId || !aktuellerNutzer || !akteFormSichtbar()) return;
    const a = akten.find((x) => x.id === bearbeiteteAkteId);
    if (!a) {
      setzeAkteKonflikt(true, "Diese Akte wurde inzwischen gelöscht und kann nicht mehr gespeichert werden.", true);
      return;
    }
    const stempel = zeitstempelWert(a.bearbeitetAm);
    if (a.bearbeiter === aktuellerNutzer.name) {
      if (stempel) akteBasisStempel = stempel;
      setzeAkteKonflikt(false);
      return;
    }
    if (stempel <= akteBasisStempel) return;
    setzeAkteKonflikt(true, `${a.bearbeiter || "Jemand"} hat diese Akte gerade geändert (${formatDatumUhrzeit(a.bearbeitetAm)}). Wenn du jetzt speicherst, wird das überschrieben.`);
  }

  if (el.btnAkteKonfliktLaden) {
    el.btnAkteKonfliktLaden.addEventListener("click", () => {
      const a = akten.find((x) => x.id === bearbeiteteAkteId);
      if (!a) return;
      akteBasisStempel = zeitstempelWert(a.bearbeitetAm);
      fuelleAkteFormFelder(a);
      setzeAkteKonflikt(false);
    });
  }

  // --- Anwesenheit ("X sieht/bearbeitet gerade ...") -----------------------
  // Datenquelle: praesenzListe (js/ui/presence.js), die Ort-Angaben stehen im
  // Heartbeat jeder Session.
  function andereAn(feld, id) {
    if (!id) return [];
    const meineUid = aktuellerNutzer ? aktuellerNutzer.uid : null;
    const namen = [];
    praesenzListe.forEach((s) => {
      if (s[feld] === id && s.uid !== meineUid && !namen.includes(s.name)) namen.push(s.name);
    });
    return namen;
  }

  function aktualisiereAnwesenheit() {
    if (el.patientAnwesend) {
      const namen = aktuelleAnsicht === "patient-detail" ? andereAn("patientId", offenerPatientId) : [];
      el.patientAnwesend.hidden = namen.length === 0;
      if (namen.length) el.patientAnwesendText.textContent = `${namenAlsText(namen)} ${namen.length === 1 ? "sieht" : "sehen"} diesen Patienten gerade an.`;
    }
    if (el.akteAnwesend) {
      const namen = akteFormSichtbar() ? andereAn("akteId", bearbeiteteAkteId) : [];
      el.akteAnwesend.hidden = namen.length === 0;
      if (namen.length) {
        el.akteAnwesendText.textContent = `${namenAlsText(namen)} ${namen.length === 1 ? "bearbeitet" : "bearbeiten"} diese Akte gerade. Änderungen können sich überschneiden.`;
      }
    }
  }

  if (el.btnConfirmAkte) {
    el.btnConfirmAkte.addEventListener("click", async () => {
      versteckeFeldFehler(el.akteError);
      const patientId = el.akteFormPatientId.value;
      const datum = el.akteDatum.value;
      const behandlungsgrund = el.akteBehandlungsgrund.value.trim();
      if (!patientId) return;
      if (!datum) return zeigeFeldFehler(el.akteError, "Bitte gib Datum und Uhrzeit ein.");
      if (!behandlungsgrund) return zeigeFeldFehler(el.akteError, "Bitte gib einen Behandlungsgrund ein.");

      const daten = {
        patientId,
        datum,
        behandlungsgrund,
        hergang: el.akteHergang.value.trim(),
        befund: el.akteBefund.value.trim(),
        behandlung: el.akteBehandlung.value.trim(),
        bemerkungen: el.akteBemerkungen.value.trim(),
      };

      try {
        if (bearbeiteteAkteId) {
          // Verfasser bleibt der ursprüngliche Autor - wer zuletzt geändert
          // hat, steht separat in "bearbeiter" (mehrere Spieler dürfen jede
          // Akte bearbeiten, siehe firestore.rules).
          daten.bearbeiter = aktuellerNutzer ? aktuellerNutzer.name : null;
          daten.bearbeitetAm = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection(AKTEN_COLLECTION).doc(bearbeiteteAkteId).update(daten);
        } else {
          daten.erstelltAm = firebase.firestore.FieldValue.serverTimestamp();
          daten.erstelltVon = aktuellerNutzer ? aktuellerNutzer.name : null;
          await db.collection(AKTEN_COLLECTION).add(daten);
        }
        schliesseModal("modal-akte-form");
        zeigeToast("Akte gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.akteError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Akte-Detail (Dokument, Darstellung in js/core/akte-dokument.js) -------
  // Einfaches Datenobjekt mit fertigen Anzeige-Texten: Grundlage für das
  // Fenster, den Text, das PDF UND die Kopie hinter dem Zugriffslink (siehe
  // js/views/akte-link.js) - alles zeigt dadurch garantiert dasselbe.
  function akteDaten(a) {
    const patient = patienten.find((x) => x.id === a.patientId);
    return {
      patientName: patient ? patient.name : "—",
      geburtsdatum: patient ? patient.geburtsdatum || "" : "",
      allergien: patient && hatEintrag(patient.allergien) ? patient.allergien : "",
      vorerkrankungen: patient && hatEintrag(patient.vorerkrankungen) ? patient.vorerkrankungen : "",
      datum: formatDatumZeit(a.datum),
      autor: a.erstelltVon || "—",
      bearbeitetVon: a.bearbeiter || "",
      bearbeitetAm: a.bearbeiter ? formatDatumUhrzeit(a.bearbeitetAm) : "",
      behandlungsgrund: a.behandlungsgrund || "",
      hergang: a.hergang || "",
      befund: a.befund || "",
      behandlung: a.behandlung || "",
      bemerkungen: a.bemerkungen || "",
    };
  }

  function oeffneAkteDetailModal(akteId) {
    const a = akten.find((x) => x.id === akteId);
    if (!a) return;
    offeneAkteDetailId = akteId;
    const d = akteDaten(a);

    el.akteDetailKicker.textContent = `Behandlungsakte · ${d.patientName}`;
    el.akteDetailTitel.innerHTML = akteUeberschriftHtml(d);
    el.akteDetailInhalt.innerHTML = akteInhaltHtml(d);
    el.akteDetailSeite.innerHTML = akteSeiteHtml(d);
    oeffneModal("modal-akte-detail");
  }

  if (el.btnAkteBearbeiten) {
    el.btnAkteBearbeiten.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const a = akten.find((x) => x.id === offeneAkteDetailId);
      if (!a) return;
      schliesseModal("modal-akte-detail");
      oeffneAkteFormModal(a.patientId, a.id);
    });
  }

  // --- Akte als Text kopieren / als PDF speichern ---------------------------
  // Text: für Chat/Notizen. PDF: direkt im Browser erzeugt (js/core/akte-pdf.js),
  // z. B. zum Verschicken über TeamSpeak.
  async function kopiereText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (fehler) {
      // Fallback für Umgebungen ohne Clipboard-API (z. B. unsicherer Kontext).
      const feld = document.createElement("textarea");
      feld.value = text;
      feld.style.position = "fixed";
      feld.style.opacity = "0";
      document.body.appendChild(feld);
      feld.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      feld.remove();
      return ok;
    }
  }

  if (el.btnAkteKopieren) {
    el.btnAkteKopieren.addEventListener("click", async () => {
      const a = akten.find((x) => x.id === offeneAkteDetailId);
      if (!a) return;
      zeigeToast((await kopiereText(akteAlsText(akteDaten(a)))) ? "Akte in die Zwischenablage kopiert." : "Kopieren nicht möglich.");
    });
  }

  if (el.btnAktePdf) {
    el.btnAktePdf.addEventListener("click", () => {
      const a = akten.find((x) => x.id === offeneAkteDetailId);
      if (!a) return;
      try {
        speichereAktePdf(akteDaten(a));
      } catch (fehler) {
        console.error(fehler);
        zeigeToast("PDF konnte nicht erstellt werden (Bibliothek nicht geladen?).");
      }
    });
  }

  if (el.btnAkteLoeschen) {
    el.btnAkteLoeschen.addEventListener("click", () => {
      if (!offeneAkteDetailId) return;
      const id = offeneAkteDetailId;
      loescheAkteMitBestaetigung(id, () => {
        offeneAkteDetailId = null;
        schliesseModal("modal-akte-detail");
      });
    });
  }
