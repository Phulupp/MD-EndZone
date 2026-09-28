"use strict";

  /* ------------------------------------------------------------------------
     17. Startseite = Leitstelle
     ------------------------------------------------------------------------
     Oben der MD-Funk (MD_FUNK, immer derselbe Hauptfunk), darunter die
     Dienstübersicht: ALLE Mitarbeiter aus der Mitarbeiterliste (siehe
     js/views/mitarbeiterliste.js), jeder mit einem Dropdown "Im Dienst" /
     "Außer Dienst". Wer noch nie umgestellt wurde, ist Außer Dienst - niemand
     muss sich erst eintragen.

     Daten: Collection DIENST_COLLECTION, ein Dokument je Person, Dokument-ID
     = die feste "id" der Zeile in der Mitarbeiterliste:
       { status "im-dienst" | "ausser-dienst", aktualisiertAm, von }
     Jeder freigegebene Nutzer darf jeden Status umstellen (siehe
     firestore.rules). Zeilen ohne id (alte Listen) sind kurz gesperrt, bis ein
     Verwalter die Seite geöffnet hat und die ids vergeben wurden. */
  let dienstMenueOffen = null; // id der Person, deren Dropdown gerade offen ist

  function starteDienstListener() {
    if (!db) return;
    if (unsubDienst) unsubDienst();
    unsubDienst = db.collection(DIENST_COLLECTION).onSnapshot(
      (snap) => {
        dienstStatus = {};
        snap.forEach((docSnap) => (dienstStatus[docSnap.id] = docSnap.data()));
        renderLeitstelle();
        renderLeitungUebersicht();
      },
      (fehler) => {
        console.error("Dienststatus konnte nicht geladen werden:", fehler);
        zeigeFeldFehler(el.dienstError, dienstFehlerText(fehler, "Der Dienststatus konnte nicht geladen werden. Bitte Seite neu laden."));
      }
    );
  }

  // Firestore lehnt ab, solange die Regel für "dienst" nicht in der Firebase
  // Console veröffentlicht ist - das wäre sonst nur ein allgemeines "fehlgeschlagen".
  function dienstFehlerText(fehler, standard) {
    return fehler && fehler.code === "permission-denied"
      ? 'Keine Berechtigung: Die Firestore-Regel für "dienst" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
      : standard;
  }

  function dienstPersonen() {
    return mitarbeiter.filter((z) => z.name.trim());
  }

  function statusVon(person) {
    const eintrag = person.id ? dienstStatus[person.id] : null;
    return eintrag && eintrag.status === "im-dienst" ? "im-dienst" : "ausser-dienst";
  }

  // "seit 18:42 Uhr" für heute, sonst mit Datum.
  function seitText(ts) {
    if (!ts) return "";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const uhr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return d.toDateString() === new Date().toDateString() ? `seit ${uhr} Uhr` : `seit ${formatDatum(d)}, ${uhr} Uhr`;
  }

  // escapeHtml maskiert keine Anführungszeichen - für Attributwerte zusätzlich nötig.
  function attributSicher(text) {
    return escapeHtml(text).replace(/"/g, "&quot;");
  }

  function dienstZeileHtml(person) {
    const status = statusVon(person);
    const im = status === "im-dienst";
    const eintrag = person.id ? dienstStatus[person.id] : null;
    const rang = person.rang.trim();
    // Freitext-Feld, keine rangId - siehe farbeVonRangName in js/core/raenge.js.
    const farbe = farbeVonRangName(rang);
    const funk = person.funk.trim();
    const id = attributSicher(person.id);
    const offen = dienstMenueOffen && dienstMenueOffen === person.id;
    // Bestenmöglicher Namensabgleich (wie leitungFunkVonName) - rein für die
    // Anzeige "Du", keine Sicherheitsprüfung. Siehe Abschlussbericht: eine
    // echte serverseitige "nur eigenen Status ändern"-Regel ist aktuell
    // nicht sauber möglich, da Mitarbeiterliste-Zeilen nicht mit einer uid
    // verknüpft sind.
    const istEigeneZeile = !!(aktuellerNutzer && person.name.trim().toLowerCase() === aktuellerNutzer.name.trim().toLowerCase());
    const option = (wert) =>
      `<button type="button" role="option" class="dienst-auswahl__option${wert === status ? " dienst-auswahl__option--aktiv" : ""}" data-dienst-setzen="${wert}" aria-selected="${wert === status}">${DIENST_STATUS[wert]}</button>`;
    return `<div class="dienst-zeile dienst-zeile--${im ? "im" : "ausser"}" data-dienst-id="${id}">
        <span class="dienst-zeile__mitarbeiter">
          <span class="dienst-zeile__punkt" aria-hidden="true"></span>
          <span class="dienst-zeile__name">${escapeHtml(person.name.trim())}</span>
          ${istEigeneZeile ? '<span class="dienst-zeile__du">Du</span>' : ""}
          ${funk ? `<span class="dienst-zeile__funk" title="Funknummer">${escapeHtml(funk)}</span>` : ""}
        </span>
        <span class="dienst-zeile__rang"${farbe ? ` style="color:${farbe};"` : ""}>${rang ? escapeHtml(rang) : "—"}</span>
        <span class="dienst-zeile__status">
          <div class="dienst-auswahl${offen ? " dienst-auswahl--offen" : ""}">
            <button type="button" class="dienst-auswahl__knopf dienst-auswahl__knopf--${im ? "im" : "ausser"}" data-dienst-toggle aria-haspopup="listbox" aria-expanded="${offen ? "true" : "false"}"${person.id ? "" : ' disabled title="Die Liste wird gerade vorbereitet - bitte kurz warten."'}>
              <span>${DIENST_STATUS[status]}</span><span class="dienst-auswahl__pfeil" aria-hidden="true">⌄</span>
            </button>
            <div class="dienst-auswahl__menue" role="listbox">${option("im-dienst")}${option("ausser-dienst")}</div>
          </div>
        </span>
        <span class="dienst-zeile__seit"${eintrag && eintrag.von ? ` title="Gesetzt von ${attributSicher(eintrag.von)}"` : ""}>${escapeHtml(eintrag ? seitText(eintrag.aktualisiertAm) : "")}</span>
      </div>`;
  }

  // Klick auf eine Zeile (außerhalb der Status-Auswahl) öffnet die
  // vorhandene Mitarbeiter-/Personalansicht - keine neue parallele Ansicht.
  // Admin/Leitung landen (per Namensabgleich mit benutzerListe, dasselbe
  // bestenmögliche Muster wie leitungFunkVonName) direkt in der
  // Personalakte; alle anderen in der bestehenden Mitarbeiterliste.
  function oeffneMitarbeiterAusLeitstelle(id) {
    const person = dienstPersonen().find((p) => p.id === id);
    if (!person) return;
    const name = person.name.trim().toLowerCase();
    if (istAdmin() || istLeitung()) {
      const treffer = benutzerListe.find((b) => b.status === "approved" && (b.username || "").trim().toLowerCase() === name);
      if (treffer) {
        oeffnePersonalakte(treffer.uid);
        return;
      }
    }
    zeigeAnsicht("mitarbeiterliste");
  }

  // Aktive Einheiten: abgeleitet aus Funknummer (Mitarbeiterliste) + aktuellem
  // Dienststatus - es gibt kein separates Einheiten-/Fahrzeugsystem, deshalb
  // keine eigene Collection und keine erfundenen Einheiten. Mitarbeiter im
  // Dienst ohne eingetragene Funknummer erscheinen hier bewusst nicht (sie
  // stehen weiterhin in der Dienstübersicht).
  function aktiveEinheitenListe() {
    const gruppen = {};
    dienstPersonen()
      .filter((p) => statusVon(p) === "im-dienst" && p.funk.trim())
      .forEach((p) => {
        const funk = p.funk.trim();
        (gruppen[funk] = gruppen[funk] || []).push(p.name.trim());
      });
    return Object.keys(gruppen)
      .sort((a, b) => a.localeCompare(b, "de", { numeric: true }))
      .map((funk) => ({ funk, mitarbeiter: gruppen[funk] }));
  }

  function renderAktiveEinheiten() {
    if (!el.leitstelleEinheitenListe) return;
    const einheiten = aktiveEinheitenListe();
    el.leitstelleEinheitenListe.innerHTML = einheiten.length
      ? einheiten
          .map(
            (e) => `<div class="mini-zeile">
          <span class="mini-zeile__haupt">${escapeHtml(e.funk)}</span>
          <span class="mini-zeile__nebentext">${escapeHtml(e.mitarbeiter.join(", "))}</span>
        </div>`
          )
          .join("")
      : `<p class="empty-state empty-state--kompakt">Keine Einheiten hinterlegt.</p>`;
  }

  function renderLeitstelle() {
    if (!el.dienstListe) return;
    el.leitstelleFunk.textContent = MD_FUNK;

    const personen = dienstPersonen();
    const imDienst = personen.filter((p) => statusVon(p) === "im-dienst").length;
    el.dienstZaehler.innerHTML = personen.length ? `${imDienst}<span class="leitstelle-stat__von"> / ${personen.length}</span>` : "–";
    if (el.leitstelleGesamtZaehler) el.leitstelleGesamtZaehler.textContent = personen.length ? String(personen.length) : "–";
    if (el.dienstAusserZaehler) el.dienstAusserZaehler.textContent = personen.length ? String(personen.length - imDienst) : "–";
    el.dienstListe.innerHTML = personen.length
      ? personen.map(dienstZeileHtml).join("")
      : `<p class="empty-state">Noch keine Mitarbeiter eingetragen. Trage sie in der <button type="button" class="empty-state__link" data-quicklink="mitarbeiterliste">Mitarbeiterliste</button> ein, dann erscheinen sie hier.</p>`;
    renderAktiveEinheiten();
  }

  // --- Info-Feld (kurzer gemeinsamer Text, jeder darf ihn aktualisieren) -------
  function starteLeitstelleInfoListener() {
    if (!db) return;
    if (unsubLeitstelleInfo) unsubLeitstelleInfo();
    unsubLeitstelleInfo = db.doc(LEITSTELLE_INFO_DOC).onSnapshot(
      (snap) => {
        const daten = snap.exists ? snap.data() : {};
        leitstelleInfo = { text: daten.text || "", von: daten.bearbeitetVon || "", am: daten.bearbeitetAm || null };
        // Wer gerade schreibt, wird nicht überschrieben.
        if (!leitstelleInfoBearbeiten) renderLeitstelleInfo();
        renderLeitungUebersicht();
      },
      (fehler) => {
        console.error("Leitstellen-Info konnte nicht geladen werden:", fehler);
        el.infoLeer.textContent = fehler && fehler.code === "permission-denied"
          ? 'Keine Berechtigung: Die Firestore-Regel für "leitstelle" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
          : "Die Infos konnten nicht geladen werden.";
      }
    );
  }

  function renderLeitstelleInfo() {
    if (!el.infoText) return;
    const text = leitstelleInfo.text.trim();
    el.infoText.textContent = text;
    el.infoText.hidden = !text;
    el.infoLeer.hidden = !!text;
    el.infoAnsicht.hidden = leitstelleInfoBearbeiten;
    el.infoForm.hidden = !leitstelleInfoBearbeiten;
    el.btnInfoBearbeiten.hidden = leitstelleInfoBearbeiten;
    el.infoMeta.hidden = leitstelleInfoBearbeiten;
    el.infoMeta.textContent = leitstelleInfo.von && leitstelleInfo.am ? `Zuletzt geändert von ${leitstelleInfo.von}, ${formatDatumUhrzeit(leitstelleInfo.am)}` : "";
  }

  if (el.btnInfoBearbeiten) {
    el.btnInfoBearbeiten.addEventListener("click", () => {
      leitstelleInfoBearbeiten = true;
      el.infoEingabe.value = leitstelleInfo.text;
      versteckeFeldFehler(el.infoError);
      renderLeitstelleInfo();
      el.infoEingabe.focus();
    });
  }

  if (el.btnInfoAbbrechen) {
    el.btnInfoAbbrechen.addEventListener("click", () => {
      leitstelleInfoBearbeiten = false;
      renderLeitstelleInfo();
    });
  }

  if (el.btnInfoSpeichern) {
    el.btnInfoSpeichern.addEventListener("click", async () => {
      versteckeFeldFehler(el.infoError);
      const text = el.infoEingabe.value.trim().slice(0, LEITSTELLE_INFO_MAX);
      el.btnInfoSpeichern.disabled = true;
      try {
        await db.doc(LEITSTELLE_INFO_DOC).set({
          text,
          bearbeitetVon: aktuellerNutzer ? aktuellerNutzer.name : "",
          bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        leitstelleInfoBearbeiten = false;
        renderLeitstelleInfo();
        zeigeToast("Infos gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(
          el.infoError,
          fehler && fehler.code === "permission-denied"
            ? 'Keine Berechtigung: Die Firestore-Regel für "leitstelle" ist noch nicht veröffentlicht.'
            : "Speichern fehlgeschlagen. Bitte erneut versuchen."
        );
      } finally {
        el.btnInfoSpeichern.disabled = false;
      }
    });
  }

  async function setzeDienststatus(id, status) {
    const person = dienstPersonen().find((p) => p.id === id);
    if (!db || !person || !DIENST_STATUS[status] || statusVon(person) === status) return;
    versteckeFeldFehler(el.dienstError);
    try {
      await db.collection(DIENST_COLLECTION).doc(id).set({
        status,
        aktualisiertAm: firebase.firestore.FieldValue.serverTimestamp(),
        von: aktuellerNutzer ? aktuellerNutzer.name : "",
      });
    } catch (fehler) {
      console.error("Dienststatus konnte nicht gespeichert werden:", fehler);
      zeigeFeldFehler(el.dienstError, dienstFehlerText(fehler, "Der Status konnte nicht gespeichert werden. Bitte erneut versuchen."));
      renderLeitstelle();
    }
  }

  // --- Dropdown je Zeile (ein Listener für die ganze Liste) -----------------
  function schliesseDienstMenue() {
    if (!dienstMenueOffen) return;
    dienstMenueOffen = null;
    if (!el.dienstListe) return;
    el.dienstListe.querySelectorAll(".dienst-auswahl--offen").forEach((box) => {
      box.classList.remove("dienst-auswahl--offen");
      box.querySelector("[data-dienst-toggle]").setAttribute("aria-expanded", "false");
    });
  }

  if (el.dienstListe) {
    el.dienstListe.addEventListener("click", (event) => {
      // Link im Leerzustand ("Mitarbeiterliste") - dynamisch erzeugt, daher hier
      // statt über den festen [data-quicklink]-Handler in js/ui/nav.js.
      const ziel = event.target.closest("[data-quicklink]");
      if (ziel) {
        zeigeAnsicht(ziel.dataset.quicklink);
        return;
      }
      const knopf = event.target.closest("[data-dienst-toggle]");
      const option = event.target.closest("[data-dienst-setzen]");
      const zeile = event.target.closest("[data-dienst-id]");
      if (!zeile) return;
      const id = zeile.dataset.dienstId;

      if (knopf && !knopf.disabled) {
        event.stopPropagation();
        const warOffen = dienstMenueOffen === id;
        schliesseDienstMenue();
        if (typeof schliesseSidebarPopover === "function") schliesseSidebarPopover();
        if (!warOffen) {
          dienstMenueOffen = id;
          const box = zeile.querySelector(".dienst-auswahl");
          box.classList.add("dienst-auswahl--offen");
          knopf.setAttribute("aria-expanded", "true");
        }
      } else if (option) {
        schliesseDienstMenue();
        setzeDienststatus(id, option.dataset.dienstSetzen);
      } else if (!event.target.closest(".dienst-auswahl")) {
        // Klick auf die Zeile selbst (nicht auf die Status-Auswahl) -
        // vorhandene Mitarbeiter-/Personalansicht öffnen.
        oeffneMitarbeiterAusLeitstelle(id);
      }
    });
  }

  document.addEventListener("click", schliesseDienstMenue);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") schliesseDienstMenue();
  });
