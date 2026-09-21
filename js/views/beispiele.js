"use strict";

  /* ------------------------------------------------------------------------
     19. Beispiele (Behandlungsleitfäden)
     ------------------------------------------------------------------------
     Drei Ebenen: Hauptkategorien (z. B. Verkehrsunfall) -> Beispiele darin
     (z. B. Ausgerenkte Schulter) -> kurze Schritt-für-Schritt-Anleitung.

     Daten: ein einzelnes Firestore-Doc (LEITFAEDEN_DOC) mit zwei Arrays:
       kategorien: [{ id, titel, reihenfolge }]
       eintraege:  [{ id, kategorieId, titel, text, reihenfolge }]
     "text" enthält die Schritte, EIN SCHRITT PRO ZEILE (siehe
     schritteAusText). Beispiele aus der Zeit vor den Kategorien haben keine
     kategorieId und erscheinen unter "Ohne Kategorie", bis ein Admin sie
     einer Kategorie zuordnet.

     Jeder freigegebene Nutzer darf lesen, nur Admins dürfen anlegen/
     bearbeiten/löschen/verschieben (siehe firestore.rules, kataloge/
     {dokument}-Regel). */
  let beispieleKategorieId = null; // null = oberste Ebene (Hauptkategorien)
  let beispieleBeispielId = null; // gesetzt = Anleitung offen
  const OHNE_KATEGORIE_ID = "__ohne-kategorie";

  const ICON_STIFT =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_PAPIERKORB =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
  const ICON_PFEIL =
    '<svg class="bsp-zeile__pfeil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>';

  function starteLeitfaedenListener() {
    if (!db) return;
    if (unsubLeitfaeden) unsubLeitfaeden();
    unsubLeitfaeden = db.doc(LEITFAEDEN_DOC).onSnapshot(
      async (snap) => {
        // Anlegen/Ergänzen der Standard-Kategorien dürfen nur Admins (siehe
        // firestore.rules) - für alle anderen bleibt es beim Lesen.
        if (!snap.exists) {
          if (istAdmin()) {
            await db
              .doc(LEITFAEDEN_DOC)
              .set({ eintraege: DEFAULT_LEITFAEDEN, kategorien: DEFAULT_LEITFADEN_KATEGORIEN })
              .catch(() => {});
          }
          return;
        }
        const daten = snap.data();
        if (!Array.isArray(daten.kategorien) && istAdmin()) {
          // Dokument aus der Zeit vor den Kategorien: die vier Standard-
          // Kategorien ergänzen, vorhandene Beispiele bleiben unangetastet.
          await db
            .doc(LEITFAEDEN_DOC)
            .update({ kategorien: DEFAULT_LEITFADEN_KATEGORIEN })
            .catch(() => {});
          return;
        }
        leitfadenKategorien = (daten.kategorien || []).map((k) => ({ ...k }));
        leitfaeden = (daten.eintraege || []).map((e) => ({ ...e }));
        renderBeispiele();
      },
      (fehler) => console.error("Beispiele konnten nicht geladen werden:", fehler)
    );
  }

  // --- Hilfsfunktionen ------------------------------------------------------
  function nachReihenfolge(liste) {
    return liste.slice().sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
  }

  function naechsteReihenfolge(liste) {
    return Math.max(0, ...liste.map((e) => e.reihenfolge || 0)) + 1;
  }

  function beispieleInKategorie(kategorieId) {
    if (kategorieId === OHNE_KATEGORIE_ID) {
      return nachReihenfolge(leitfaeden.filter((e) => !leitfadenKategorien.some((k) => k.id === e.kategorieId)));
    }
    return nachReihenfolge(leitfaeden.filter((e) => e.kategorieId === kategorieId));
  }

  // Ein Schritt pro Zeile; führende Nummern/Aufzählungszeichen, die jemand
  // selbst mitgetippt hat ("1. Wunde ...", "- Wunde ..."), werden entfernt,
  // damit nicht "1. 1. Wunde" entsteht.
  function schritteAusText(text) {
    return (text || "")
      .split(/\r?\n/)
      .map((zeile) => zeile.trim().replace(/^(\d+\s*[.):]|[-•*])\s*/, ""))
      .filter(Boolean);
  }

  function anzahlText(n, einzahl, mehrzahl) {
    return `${n} ${n === 1 ? einzahl : mehrzahl}`;
  }

  // --- Darstellung ----------------------------------------------------------
  function bspZeileHtml({ typ, id, titel, meta, steuerung, erste, letzte }) {
    const admin = steuerung
      ? `<div class="bsp-zeile__steuerung">
           <div class="bsp-zeile__pfeile">
             <button type="button" class="icon-btn" data-bsp-hoch="${typ}:${id}" title="Nach oben" ${erste ? "disabled" : ""}>▲</button>
             <button type="button" class="icon-btn" data-bsp-runter="${typ}:${id}" title="Nach unten" ${letzte ? "disabled" : ""}>▼</button>
           </div>
           <button type="button" class="icon-btn" data-bsp-edit="${typ}:${id}" title="Bearbeiten" aria-label="Bearbeiten">${ICON_STIFT}</button>
           <button type="button" class="icon-btn icon-btn--delete" data-bsp-delete="${typ}:${id}" title="Löschen" aria-label="Löschen">${ICON_PAPIERKORB}</button>
         </div>`
      : "";
    return `<div class="bsp-zeile" tabindex="0" data-bsp-oeffnen="${typ}:${id}">
        <span class="bsp-zeile__titel">${escapeHtml(titel)}</span>
        <span class="bsp-zeile__meta">${meta}</span>
        ${admin}
        ${ICON_PFEIL}
      </div>`;
  }

  function krumenHtml(ebene, kategorie, beispiel) {
    const link = (aktion, text) => `<button type="button" class="brotkrumen__link" data-bsp-krume="${aktion}">${escapeHtml(text)}</button>`;
    const trenner = '<span class="brotkrumen__trenner">›</span>';
    const aktuell = (text) => `<span class="brotkrumen__aktuell">${escapeHtml(text)}</span>`;
    if (ebene === 0) return aktuell("Beispiele");
    if (ebene === 1) return link("start", "Beispiele") + trenner + aktuell(kategorie.titel);
    return link("start", "Beispiele") + trenner + link("kategorie", kategorie.titel) + trenner + aktuell(beispiel.titel);
  }

  function renderBeispiele() {
    if (!el.beispieleListe) return;
    const admin = istAdmin();

    // Zustand bereinigen, falls jemand anderes gerade etwas gelöscht hat.
    if (beispieleKategorieId === OHNE_KATEGORIE_ID) {
      if (!beispieleInKategorie(OHNE_KATEGORIE_ID).length) beispieleKategorieId = beispieleBeispielId = null;
    } else if (beispieleKategorieId && !leitfadenKategorien.some((k) => k.id === beispieleKategorieId)) {
      beispieleKategorieId = beispieleBeispielId = null;
    }
    if (beispieleBeispielId && !leitfaeden.some((e) => e.id === beispieleBeispielId)) beispieleBeispielId = null;
    if (!beispieleKategorieId) beispieleBeispielId = null;

    const kategorie =
      beispieleKategorieId === OHNE_KATEGORIE_ID
        ? { id: OHNE_KATEGORIE_ID, titel: "Ohne Kategorie" }
        : leitfadenKategorien.find((k) => k.id === beispieleKategorieId) || null;
    const beispiel = beispieleBeispielId ? leitfaeden.find((e) => e.id === beispieleBeispielId) : null;
    const ebene = beispiel ? 2 : kategorie ? 1 : 0;

    el.beispieleKrumen.innerHTML = krumenHtml(ebene, kategorie, beispiel);
    el.btnBeispielKategorieHinzufuegen.hidden = !(admin && ebene === 0);
    el.btnBeispielHinzufuegen.hidden = !(admin && ebene === 1 && kategorie.id !== OHNE_KATEGORIE_ID);

    let html = "";
    let leerText = "";

    if (ebene === 0) {
      const kategorien = nachReihenfolge(leitfadenKategorien);
      html = kategorien
        .map((k, i) =>
          bspZeileHtml({
            typ: "kategorie",
            id: k.id,
            titel: k.titel,
            meta: anzahlText(beispieleInKategorie(k.id).length, "Beispiel", "Beispiele"),
            steuerung: admin,
            erste: i === 0,
            letzte: i === kategorien.length - 1,
          })
        )
        .join("");
      const ohne = beispieleInKategorie(OHNE_KATEGORIE_ID);
      if (ohne.length) {
        html += bspZeileHtml({ typ: "kategorie", id: OHNE_KATEGORIE_ID, titel: "Ohne Kategorie", meta: anzahlText(ohne.length, "Beispiel", "Beispiele"), steuerung: false });
      }
      if (!html) leerText = admin ? "Noch keine Hauptkategorie. Lege oben rechts die erste an." : "Noch keine Beispiele hinterlegt.";
      html = html ? `<div class="bsp-liste">${html}</div>` : "";
    } else if (ebene === 1) {
      const liste = beispieleInKategorie(kategorie.id);
      const steuerung = admin;
      html =
        `<h2 class="bsp-titel">${escapeHtml(kategorie.titel)}</h2>` +
        (liste.length
          ? `<div class="bsp-liste">${liste
              .map((e, i) =>
                bspZeileHtml({
                  typ: "beispiel",
                  id: e.id,
                  titel: e.titel,
                  meta: anzahlText(schritteAusText(e.text).length, "Schritt", "Schritte"),
                  steuerung,
                  erste: i === 0,
                  letzte: i === liste.length - 1,
                })
              )
              .join("")}</div>`
          : "");
      if (!liste.length) leerText = admin ? "Noch kein Beispiel in dieser Kategorie. Lege oben rechts das erste an." : "In dieser Kategorie gibt es noch keine Beispiele.";
    } else {
      const schritte = schritteAusText(beispiel.text);
      const aktionen = admin
        ? `<div class="bsp-anleitung__aktionen">
             <button type="button" class="akte-fuss__link" data-bsp-edit="beispiel:${beispiel.id}">Bearbeiten</button>
             <button type="button" class="akte-fuss__loeschen" data-bsp-delete="beispiel:${beispiel.id}">Löschen</button>
           </div>`
        : "";
      html = `<article class="bsp-anleitung">
          <div class="bsp-anleitung__kopf">
            <div>
              <span class="bsp-kicker">${escapeHtml(kategorie ? kategorie.titel : "Beispiel")}</span>
              <h2 class="bsp-titel">${escapeHtml(beispiel.titel)}</h2>
            </div>
            ${aktionen}
          </div>
          ${
            schritte.length
              ? `<ol class="bsp-schritte">${schritte.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
              : '<p class="bsp-schritte__leer">Noch keine Schritte eingetragen.</p>'
          }
        </article>`;
    }

    el.beispieleListe.innerHTML = html;
    el.beispieleEmpty.textContent = leerText;
    el.beispieleEmpty.hidden = !leerText;
  }

  // --- Navigation -------------------------------------------------------------
  function parseSchluessel(wert) {
    const teile = (wert || "").split(":");
    return { typ: teile[0], id: teile.slice(1).join(":") };
  }

  function beispieleZuruecksetzen() {
    beispieleKategorieId = null;
    beispieleBeispielId = null;
    renderBeispiele();
  }

  // Ein Klick auf "Beispiele" in der Seitenleiste
  // beginnt immer wieder oben bei den Hauptkategorien.
  document.querySelectorAll('[data-view="beispiele"]').forEach((knopf) => {
    knopf.addEventListener("click", beispieleZuruecksetzen);
  });

  function beispieleKlick(event) {
    const ziel = event.target;

    const krume = ziel.closest("[data-bsp-krume]");
    if (krume) {
      if (krume.getAttribute("data-bsp-krume") === "start") beispieleKategorieId = beispieleBeispielId = null;
      else beispieleBeispielId = null;
      renderBeispiele();
      return;
    }

    const bearbeiten = ziel.closest("[data-bsp-edit]");
    if (bearbeiten) {
      if (!istAdmin()) return;
      const { typ, id } = parseSchluessel(bearbeiten.getAttribute("data-bsp-edit"));
      if (typ === "kategorie") oeffneKategorieModal(id);
      else oeffneBeispielModal(id);
      return;
    }

    const loeschen = ziel.closest("[data-bsp-delete]");
    if (loeschen) {
      if (!istAdmin()) return;
      const { typ, id } = parseSchluessel(loeschen.getAttribute("data-bsp-delete"));
      loescheBeispielEintrag(typ, id);
      return;
    }

    const hoch = ziel.closest("[data-bsp-hoch]");
    const runter = ziel.closest("[data-bsp-runter]");
    if (hoch || runter) {
      if (!istAdmin()) return;
      const { typ, id } = parseSchluessel((hoch || runter).getAttribute(hoch ? "data-bsp-hoch" : "data-bsp-runter"));
      verschiebeBeispielEintrag(typ, id, hoch ? -1 : 1);
      return;
    }

    const oeffnen = ziel.closest("[data-bsp-oeffnen]");
    if (oeffnen) {
      const { typ, id } = parseSchluessel(oeffnen.getAttribute("data-bsp-oeffnen"));
      if (typ === "kategorie") {
        beispieleKategorieId = id;
        beispieleBeispielId = null;
      } else {
        beispieleBeispielId = id;
      }
      renderBeispiele();
      window.scrollTo({ top: 0 });
    }
  }

  if (el.beispieleListe) {
    el.beispieleListe.addEventListener("click", beispieleKlick);
    el.beispieleListe.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Auf den Bedienknöpfen einer Zeile löst der Browser den Klick selbst aus.
      if (event.target.closest("button")) return;
      const zeile = event.target.closest("[data-bsp-oeffnen]");
      if (!zeile) return;
      event.preventDefault();
      beispieleKlick(event);
    });
  }
  if (el.beispieleKrumen) el.beispieleKrumen.addEventListener("click", beispieleKlick);

  // --- Bearbeiten: Hauptkategorie ------------------------------------------
  function oeffneKategorieModal(id) {
    const k = id ? leitfadenKategorien.find((x) => x.id === id) : null;
    el.beispielKategorieModalTitel.textContent = k ? "Hauptkategorie umbenennen" : "Neue Hauptkategorie";
    el.beispielKategorieEditingId.value = k ? k.id : "";
    el.beispielKategorieTitelInput.value = k ? k.titel || "" : "";
    versteckeFeldFehler(el.beispielKategorieError);
    oeffneModal("modal-beispiel-kategorie");
    el.beispielKategorieTitelInput.focus();
  }

  if (el.btnBeispielKategorieHinzufuegen) {
    el.btnBeispielKategorieHinzufuegen.addEventListener("click", () => oeffneKategorieModal(null));
  }

  if (el.beispielKategorieTitelInput) {
    el.beispielKategorieTitelInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && el.btnConfirmBeispielKategorie) el.btnConfirmBeispielKategorie.click();
    });
  }

  if (el.btnConfirmBeispielKategorie) {
    el.btnConfirmBeispielKategorie.addEventListener("click", async () => {
      versteckeFeldFehler(el.beispielKategorieError);
      const titel = el.beispielKategorieTitelInput.value.trim();
      if (!titel) return zeigeFeldFehler(el.beispielKategorieError, "Bitte gib einen Namen ein.");
      const id = el.beispielKategorieEditingId.value;
      try {
        const neueListe = id
          ? leitfadenKategorien.map((k) => (k.id === id ? { ...k, titel } : k))
          : [...leitfadenKategorien, { id: erzeugeId(), titel, reihenfolge: naechsteReihenfolge(leitfadenKategorien) }];
        await db.doc(LEITFAEDEN_DOC).update({ kategorien: neueListe });
        schliesseModal("modal-beispiel-kategorie");
        zeigeToast("Hauptkategorie gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.beispielKategorieError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Bearbeiten: Beispiel -------------------------------------------------
  function oeffneBeispielModal(id) {
    const kategorien = nachReihenfolge(leitfadenKategorien);
    const e = id ? leitfaeden.find((x) => x.id === id) : null;
    el.beispielKategorieSelect.innerHTML = kategorien.map((k) => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.titel)}</option>`).join("");
    el.beispielBearbeitenTitel.textContent = e ? "Beispiel bearbeiten" : "Neues Beispiel";
    el.beispielEditingId.value = e ? e.id : "";
    el.beispielTitelInput.value = e ? e.titel || "" : "";
    el.beispielTextInput.value = e ? e.text || "" : "";
    // Vorauswahl: bisherige Kategorie, sonst die gerade geöffnete, sonst die erste.
    const vorgabe =
      e && kategorien.some((k) => k.id === e.kategorieId)
        ? e.kategorieId
        : beispieleKategorieId && beispieleKategorieId !== OHNE_KATEGORIE_ID
        ? beispieleKategorieId
        : kategorien[0]
        ? kategorien[0].id
        : "";
    el.beispielKategorieSelect.value = vorgabe;
    aktualisiereCustomSelect(el.beispielKategorieSelect);
    versteckeFeldFehler(el.beispielError);
    oeffneModal("modal-beispiel-bearbeiten");
    (e ? el.beispielTextInput : el.beispielTitelInput).focus();
  }

  if (el.btnBeispielHinzufuegen) {
    el.btnBeispielHinzufuegen.addEventListener("click", () => oeffneBeispielModal(null));
  }

  if (el.btnConfirmBeispiel) {
    el.btnConfirmBeispiel.addEventListener("click", async () => {
      versteckeFeldFehler(el.beispielError);
      const titel = el.beispielTitelInput.value.trim();
      const text = el.beispielTextInput.value.trim();
      const kategorieId = el.beispielKategorieSelect.value;
      if (!kategorieId) return zeigeFeldFehler(el.beispielError, "Lege zuerst eine Hauptkategorie an.");
      if (!titel) return zeigeFeldFehler(el.beispielError, "Bitte gib einen Titel ein.");

      const id = el.beispielEditingId.value;
      try {
        let neueListe;
        if (id) {
          neueListe = leitfaeden.map((e) => (e.id === id ? { ...e, titel, text, kategorieId } : e));
        } else {
          const inKategorie = leitfaeden.filter((e) => e.kategorieId === kategorieId);
          neueListe = [...leitfaeden, { id: erzeugeId(), kategorieId, titel, text, reihenfolge: naechsteReihenfolge(inKategorie) }];
        }
        await db.doc(LEITFAEDEN_DOC).update({ eintraege: neueListe });
        schliesseModal("modal-beispiel-bearbeiten");
        zeigeToast("Beispiel gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(el.beispielError, "Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  // --- Löschen / Verschieben -------------------------------------------------
  function loescheBeispielEintrag(typ, id) {
    if (typ === "kategorie") {
      const k = leitfadenKategorien.find((x) => x.id === id);
      if (!k) return;
      const n = beispieleInKategorie(id).length;
      const text = n
        ? `Möchtest du „${k.titel}“ wirklich löschen? Die ${anzahlText(n, "Beispiel", "Beispiele")} darin werden dabei ebenfalls gelöscht.`
        : `Möchtest du „${k.titel}“ wirklich löschen?`;
      fordereLoeschungAn("Hauptkategorie löschen", text, async () => {
        await db.doc(LEITFAEDEN_DOC).update({
          kategorien: leitfadenKategorien.filter((x) => x.id !== id),
          eintraege: leitfaeden.filter((e) => e.kategorieId !== id),
        });
        zeigeToast("Hauptkategorie gelöscht.");
      });
      return;
    }
    const e = leitfaeden.find((x) => x.id === id);
    if (!e) return;
    fordereLoeschungAn("Beispiel löschen", `Möchtest du „${e.titel}“ wirklich löschen?`, async () => {
      await db.doc(LEITFAEDEN_DOC).update({ eintraege: leitfaeden.filter((x) => x.id !== id) });
      zeigeToast("Beispiel gelöscht.");
    });
  }

  // Tauscht ein Element mit seinem Nachbarn INNERHALB seiner Gruppe (alle
  // Hauptkategorien bzw. alle Beispiele einer Kategorie). Die Reihenfolge der
  // Gruppe wird dabei komplett neu durchnummeriert, damit auch doppelte oder
  // fehlende Werte aus Altdaten nie zu einem wirkungslosen Klick führen.
  async function verschiebeBeispielEintrag(typ, id, richtung) {
    const alle = typ === "kategorie" ? leitfadenKategorien : leitfaeden;
    let gruppe;
    if (typ === "kategorie") {
      gruppe = nachReihenfolge(leitfadenKategorien);
    } else {
      const e = leitfaeden.find((x) => x.id === id);
      if (!e) return;
      gruppe = beispieleInKategorie(leitfadenKategorien.some((k) => k.id === e.kategorieId) ? e.kategorieId : OHNE_KATEGORIE_ID);
    }
    const index = gruppe.findIndex((x) => x.id === id);
    const ziel = index + richtung;
    if (index < 0 || ziel < 0 || ziel >= gruppe.length) return;
    const neu = gruppe.slice();
    [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
    const position = new Map(neu.map((x, i) => [x.id, i + 1]));
    const neueListe = alle.map((x) => (position.has(x.id) ? { ...x, reihenfolge: position.get(x.id) } : x));
    await db
      .doc(LEITFAEDEN_DOC)
      .update(typ === "kategorie" ? { kategorien: neueListe } : { eintraege: neueListe })
      .catch(() => zeigeToast("Reihenfolge konnte nicht gespeichert werden."));
  }
