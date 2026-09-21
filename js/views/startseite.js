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
    const farbe = RANG_AKZENTE[normalisiereRang(rang)];
    const funk = person.funk.trim();
    const id = attributSicher(person.id);
    const offen = dienstMenueOffen && dienstMenueOffen === person.id;
    const option = (wert) =>
      `<button type="button" role="option" class="dienst-auswahl__option${wert === status ? " dienst-auswahl__option--aktiv" : ""}" data-dienst-setzen="${wert}" aria-selected="${wert === status}">${DIENST_STATUS[wert]}</button>`;
    return `<div class="dienst-zeile dienst-zeile--${im ? "im" : "ausser"}" data-dienst-id="${id}">
        <span class="dienst-zeile__punkt" aria-hidden="true"></span>
        <span class="dienst-zeile__haupt">
          <span class="dienst-zeile__name">${escapeHtml(person.name.trim())}</span>
          ${rang ? `<span class="dienst-zeile__rang"${farbe ? ` style="color:${farbe};"` : ""}>${escapeHtml(rang)}</span>` : ""}
        </span>
        ${funk ? `<span class="dienst-zeile__funk" title="Funknummer">${escapeHtml(funk)}</span>` : ""}
        <span class="dienst-zeile__seit"${eintrag && eintrag.von ? ` title="Gesetzt von ${attributSicher(eintrag.von)}"` : ""}>${escapeHtml(eintrag ? seitText(eintrag.aktualisiertAm) : "")}</span>
        <div class="dienst-auswahl${offen ? " dienst-auswahl--offen" : ""}">
          <button type="button" class="dienst-auswahl__knopf dienst-auswahl__knopf--${im ? "im" : "ausser"}" data-dienst-toggle aria-haspopup="listbox" aria-expanded="${offen ? "true" : "false"}"${person.id ? "" : ' disabled title="Die Liste wird gerade vorbereitet - bitte kurz warten."'}>
            <span>${DIENST_STATUS[status]}</span><span class="dienst-auswahl__pfeil" aria-hidden="true">⌄</span>
          </button>
          <div class="dienst-auswahl__menue" role="listbox">${option("im-dienst")}${option("ausser-dienst")}</div>
        </div>
      </div>`;
  }

  function renderLeitstelle() {
    if (!el.dienstListe) return;
    el.leitstelleFunk.textContent = MD_FUNK;

    const personen = dienstPersonen();
    const imDienst = personen.filter((p) => statusVon(p) === "im-dienst").length;
    el.dienstZaehler.textContent = personen.length ? `${imDienst} von ${personen.length} im Dienst` : "";
    el.dienstListe.innerHTML = personen.length
      ? personen.map(dienstZeileHtml).join("")
      : `<p class="empty-state">Noch keine Mitarbeiter eingetragen. Trage sie in der <button type="button" class="empty-state__link" data-quicklink="mitarbeiterliste">Mitarbeiterliste</button> ein, dann erscheinen sie hier.</p>`;
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
      }
    });
  }

  document.addEventListener("click", schliesseDienstMenue);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") schliesseDienstMenue();
  });
