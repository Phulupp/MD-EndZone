"use strict";

  /* ------------------------------------------------------------------------
     20. Verwaltung — Ränge & Rollen
     ------------------------------------------------------------------------
     Admin-exklusive Oberfläche für die Collection "raenge" (siehe
     js/core/raenge.js für die Lese-Helfer, die überall sonst in der App
     genutzt werden). Ränge werden nie gelöscht, nur über "aktiv:false"
     deaktiviert - es gibt bewusst KEINE Löschen-Funktion. */

  // rangId wird einmalig beim Anlegen aus dem Namen abgeleitet und bleibt
  // danach für immer stabil, auch wenn der Name später geändert wird.
  function slugifyRangName(name) {
    return (name || "")
      .trim()
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function eindeutigeRangId(basis) {
    const sichererBasis = basis || "rang";
    let kandidat = sichererBasis;
    let zaehler = 2;
    while (findeRang(kandidat)) {
      kandidat = `${sichererBasis}-${zaehler}`;
      zaehler++;
    }
    return kandidat;
  }

  function naechsteRangPosition() {
    if (!raenge.length) return 10;
    return Math.max(...raenge.map((r) => r.position || 0)) + 10;
  }

  function renderAdminRaenge() {
    if (!el.adminRaengeListe) return;
    el.adminRaengeListe.innerHTML = raenge.length
      ? raenge
          .map((r) => {
            const farbe = rangFarbe(r.rangId);
            return `<div class="settings-list__item" data-rang-oeffnen="${escapeHtml(r.rangId)}">
              <div class="settings-list__avatar" style="border-color:${farbe};color:${farbe};">${escapeHtml((r.kurzname || r.name || "?").slice(0, 3))}</div>
              <div class="settings-list__info">
                <div class="settings-list__toprow">
                  <span class="settings-list__name">${escapeHtml(r.name)}</span>
                  ${!r.aktiv ? '<span class="badge badge--danger-soft">Deaktiviert</span>' : ""}
                </div>
                <div class="settings-list__subrow">
                  <span class="settings-list__role settings-list__role--dezent">Position ${escapeHtml(String(r.position != null ? r.position : "—"))}</span>
                </div>
              </div>
              <span class="settings-list__chevron">›</span>
            </div>`;
          })
          .join("")
      : `<p class="empty-state">Noch keine Ränge angelegt.</p>`;
  }

  if (el.adminRaengeListe) {
    el.adminRaengeListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-rang-oeffnen]");
      if (!zeile) return;
      oeffneRangFormular(zeile.getAttribute("data-rang-oeffnen"));
    });
  }

  if (el.btnRangAnlegen) {
    el.btnRangAnlegen.addEventListener("click", () => oeffneRangFormular(null));
  }

  function oeffneRangFormular(rangId) {
    const r = rangId ? findeRang(rangId) : null;
    el.rangFormTitel.textContent = r ? "Rang bearbeiten" : "Neuer Rang";
    el.rangEditingId.value = rangId || "";
    el.rangNameInput.value = r ? r.name : "";
    el.rangKurznameInput.value = r ? r.kurzname || "" : "";
    el.rangBeschreibungInput.value = r ? r.beschreibung || "" : "";
    el.rangFarbeSelect.value = r ? r.farbeToken : "slate";
    aktualisiereCustomSelect(el.rangFarbeSelect);
    el.rangPositionInput.value = r ? r.position : naechsteRangPosition();
    el.rangAkzentringCheckbox.checked = !!(r && r.akzentring);
    el.rangAktivCheckbox.checked = r ? !!r.aktiv : true;
    versteckeFeldFehler(el.rangFormError);
    oeffneModal("modal-rang-form");
  }

  if (el.btnConfirmRang) {
    el.btnConfirmRang.addEventListener("click", async () => {
      versteckeFeldFehler(el.rangFormError);
      const name = el.rangNameInput.value.trim();
      if (!name) {
        zeigeFeldFehler(el.rangFormError, "Bitte einen Namen eingeben.");
        return;
      }
      const position = parseInt(el.rangPositionInput.value, 10);
      if (Number.isNaN(position)) {
        zeigeFeldFehler(el.rangFormError, "Bitte eine gültige Position eingeben.");
        return;
      }

      const bearbeiteteId = el.rangEditingId.value;
      const daten = {
        name,
        kurzname: el.rangKurznameInput.value.trim(),
        beschreibung: el.rangBeschreibungInput.value.trim(),
        farbeToken: el.rangFarbeSelect.value,
        position,
        akzentring: el.rangAkzentringCheckbox.checked,
        aktiv: el.rangAktivCheckbox.checked,
        bearbeitetVon: aktuellerNutzer.name,
        bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
      };

      el.btnConfirmRang.disabled = true;
      try {
        if (bearbeiteteId) {
          await db.collection("raenge").doc(bearbeiteteId).update(daten);
        } else {
          const rangId = eindeutigeRangId(slugifyRangName(name));
          await db
            .collection("raenge")
            .doc(rangId)
            .set({
              ...daten,
              erstelltVon: aktuellerNutzer.name,
              erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
            });
        }
        schliesseModal("modal-rang-form");
        zeigeToast("Rang gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(
          el.rangFormError,
          fehler && fehler.code === "permission-denied"
            ? "Keine Berechtigung: Nur Verwalter dürfen Ränge bearbeiten."
            : "Speichern fehlgeschlagen. Bitte erneut versuchen."
        );
      } finally {
        el.btnConfirmRang.disabled = false;
      }
    });
  }
