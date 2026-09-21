"use strict";

  /* ------------------------------------------------------------------------
     23. Mitarbeiterliste
     ------------------------------------------------------------------------
     Eine schlichte Liste aller Mitarbeiter: Name, Rang, Funknummer,
     Telefonnummer, Bereiche | Aufgaben - alles Freitext, keine Gruppen.

     Daten: ein einzelnes Firestore-Doc (MITARBEITER_DOC):
       zeilen: [{ name, rang, funk, telefon, bereiche }]
       bearbeitetVon, bearbeitetAm
     Die Ansicht zeigt immer mindestens MITARBEITER_MIN_ZEILEN Zeilen (leere
     inklusive); gespeichert werden alle Zeilen bis zur letzten befüllten,
     leere Zeilen dazwischen bleiben also als Lücke erhalten.

     Lesen dürfen alle Freigegebenen, bearbeiten nur Admins ("Bearbeiten"-
     Modus direkt in der Tabelle). Zwei Admins gleichzeitig: wird die Liste
     während des Bearbeitens von jemand anderem gespeichert, erscheint ein
     Hinweis - Speichern überschreibt dann die fremde Änderung. */
  const MA_FELDER = [
    ["name", "Mitarbeiter", 80],
    ["rang", "Rang", 80],
    ["funk", "Funknummer", 40],
    ["telefon", "Telefonnummer", 40],
    ["bereiche", "Bereiche | Aufgaben", 400],
  ];

  const MA_ICON_ENTFERNEN =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  function leereMaZeile() {
    return { name: "", rang: "", funk: "", telefon: "", bereiche: "" };
  }

  function normalisiereMaZeile(zeile) {
    const z = leereMaZeile();
    MA_FELDER.forEach(([feld]) => {
      z[feld] = zeile && zeile[feld] != null ? String(zeile[feld]) : "";
    });
    return z;
  }

  function maZeileLeer(zeile) {
    return MA_FELDER.every(([feld]) => !zeile[feld].trim());
  }

  // Kopie der gespeicherten Zeilen, bei Bedarf mit leeren Zeilen auf die
  // Mindestanzahl aufgefüllt.
  function maZeilenMitAuffuellung() {
    const zeilen = mitarbeiter.map((z) => ({ ...z }));
    while (zeilen.length < MITARBEITER_MIN_ZEILEN) zeilen.push(leereMaZeile());
    return zeilen;
  }

  function starteMitarbeiterListener() {
    if (!db) return;
    if (unsubMitarbeiter) unsubMitarbeiter();
    unsubMitarbeiter = db.doc(MITARBEITER_DOC).onSnapshot(
      (snap) => {
        const daten = snap.exists ? snap.data() : {};
        mitarbeiter = (Array.isArray(daten.zeilen) ? daten.zeilen : []).map(normalisiereMaZeile);
        mitarbeiterMeta = { von: daten.bearbeitetVon || "", am: daten.bearbeitetAm || null };
        if (!mitarbeiterBearbeiten) renderMitarbeiter();
        else if (!maSpeichertGerade) pruefeMaKonflikt();
      },
      (fehler) => {
        console.error("Mitarbeiterliste konnte nicht geladen werden:", fehler);
        zeigeFeldFehler(el.maError, "Die Mitarbeiterliste konnte nicht geladen werden. Bitte Seite neu laden.");
      }
    );
  }

  // --- Darstellung ----------------------------------------------------------
  function maAnsichtZeileHtml(zeile) {
    const leer = maZeileLeer(zeile);
    const zellen = MA_FELDER.map(([feld, label]) => {
      const inhalt = escapeHtml(zeile[feld].trim());
      let stil = "";
      if (feld === "rang") {
        // Bekannte Ränge in ihrer Rang-Farbe (siehe RANG_AKZENTE), sonst Text.
        const farbe = RANG_AKZENTE[normalisiereRang(zeile.rang.trim())];
        if (farbe) stil = ` style="color:${farbe};"`;
      }
      return `<td class="ma-zelle ma-zelle--${feld}" data-label="${label}"${stil}>${inhalt}</td>`;
    }).join("");
    return `<tr class="ma-zeile${leer ? " ma-zeile--leer" : ""}">${zellen}</tr>`;
  }

  function passeMaTextareasAn() {
    el.maBody.querySelectorAll("textarea.ma-eingabe").forEach((ta) => {
      ta.style.height = "auto";
      if (ta.scrollHeight > 0) ta.style.height = `${ta.scrollHeight + (ta.offsetHeight - ta.clientHeight)}px`;
    });
  }

  function renderMaFormular() {
    el.maBody.textContent = "";
    mitarbeiterEntwurf.forEach((zeile, index) => {
      const tr = document.createElement("tr");
      tr.className = "ma-zeile";
      MA_FELDER.forEach(([feld, label, maximum]) => {
        const td = document.createElement("td");
        td.className = `ma-zelle ma-zelle--${feld}`;
        td.dataset.label = label;
        const eingabe = document.createElement(feld === "bereiche" ? "textarea" : "input");
        if (feld === "bereiche") eingabe.rows = 1;
        else eingabe.type = "text";
        eingabe.className = "ma-eingabe";
        eingabe.maxLength = maximum;
        eingabe.value = zeile[feld];
        eingabe.dataset.maZeile = String(index);
        eingabe.dataset.maFeld = feld;
        eingabe.setAttribute("aria-label", `${label}, Zeile ${index + 1}`);
        eingabe.autocomplete = "off";
        td.appendChild(eingabe);
        tr.appendChild(td);
      });
      const aktion = document.createElement("td");
      aktion.className = "ma-zelle ma-zelle--aktion";
      const entfernen = document.createElement("button");
      entfernen.type = "button";
      entfernen.className = "icon-btn icon-btn--delete";
      entfernen.dataset.maEntfernen = String(index);
      entfernen.title = "Zeile entfernen";
      entfernen.setAttribute("aria-label", `Zeile ${index + 1} entfernen`);
      entfernen.innerHTML = MA_ICON_ENTFERNEN;
      aktion.appendChild(entfernen);
      tr.appendChild(aktion);
      el.maBody.appendChild(tr);
    });
    passeMaTextareasAn();
  }

  function renderMitarbeiter() {
    if (!el.maBody) return;
    // Wer während des Bearbeitens die Admin-Rechte verliert, fliegt raus.
    if (mitarbeiterBearbeiten && !istAdmin()) beendeMaBearbeiten();
    const admin = istAdmin();

    el.maAktionen.hidden = !admin;
    el.btnMaBearbeiten.hidden = !admin || mitarbeiterBearbeiten;
    [el.btnMaZeile, el.btnMaAbbrechen, el.btnMaSpeichern].forEach((b) => (b.hidden = !(admin && mitarbeiterBearbeiten)));
    el.maTabelle.classList.toggle("ma-tabelle--bearbeiten", mitarbeiterBearbeiten);
    if (!mitarbeiterBearbeiten) el.maKonflikt.hidden = true;

    if (mitarbeiterBearbeiten) renderMaFormular();
    else el.maBody.innerHTML = maZeilenMitAuffuellung().map(maAnsichtZeileHtml).join("");

    let fuss = "Interne Übersicht · Nur für Mitarbeiter";
    if (mitarbeiterMeta.von && mitarbeiterMeta.am) {
      fuss += ` · Zuletzt bearbeitet von ${mitarbeiterMeta.von}, ${formatDatumUhrzeit(mitarbeiterMeta.am)}`;
    }
    el.maFuss.textContent = fuss;
  }

  // --- Bearbeiten -----------------------------------------------------------
  function beginneMaBearbeiten() {
    if (!istAdmin()) return;
    mitarbeiterEntwurf = maZeilenMitAuffuellung();
    maBasisStempel = zeitstempelWert(mitarbeiterMeta.am);
    mitarbeiterBearbeiten = true;
    versteckeFeldFehler(el.maError);
    renderMitarbeiter();
    const erste = el.maBody.querySelector(".ma-eingabe");
    if (erste) erste.focus();
  }

  function beendeMaBearbeiten() {
    mitarbeiterBearbeiten = false;
    mitarbeiterEntwurf = [];
    maBasisStempel = 0;
    el.maKonflikt.hidden = true;
  }

  function pruefeMaKonflikt() {
    const stempel = zeitstempelWert(mitarbeiterMeta.am);
    if (!stempel || stempel === maBasisStempel) return;
    el.maKonfliktText.textContent = `${mitarbeiterMeta.von || "Jemand"} hat die Liste gerade geändert. Wenn du speicherst, werden diese Änderungen überschrieben.`;
    el.maKonflikt.hidden = false;
  }

  async function speichereMitarbeiter() {
    if (!istAdmin() || maSpeichertGerade) return;
    versteckeFeldFehler(el.maError);
    const zeilen = mitarbeiterEntwurf.map((z) => {
      const bereinigt = leereMaZeile();
      MA_FELDER.forEach(([feld, , maximum]) => (bereinigt[feld] = z[feld].trim().slice(0, maximum)));
      return bereinigt;
    });
    while (zeilen.length && maZeileLeer(zeilen[zeilen.length - 1])) zeilen.pop();

    maSpeichertGerade = true;
    el.btnMaSpeichern.disabled = true;
    try {
      await db.doc(MITARBEITER_DOC).set({
        zeilen,
        bearbeitetVon: aktuellerNutzer.name,
        bearbeitetAm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mitarbeiter = zeilen;
      beendeMaBearbeiten();
      renderMitarbeiter();
      zeigeToast("Mitarbeiterliste gespeichert.");
    } catch (fehler) {
      console.error("Mitarbeiterliste konnte nicht gespeichert werden:", fehler);
      zeigeFeldFehler(
        el.maError,
        fehler && fehler.code === "permission-denied"
          ? "Keine Berechtigung: Nur Verwalter dürfen die Mitarbeiterliste bearbeiten."
          : "Speichern fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      maSpeichertGerade = false;
      el.btnMaSpeichern.disabled = false;
    }
  }

  if (el.btnMaBearbeiten) el.btnMaBearbeiten.addEventListener("click", beginneMaBearbeiten);

  if (el.btnMaAbbrechen) {
    el.btnMaAbbrechen.addEventListener("click", () => {
      beendeMaBearbeiten();
      versteckeFeldFehler(el.maError);
      renderMitarbeiter();
    });
  }

  if (el.btnMaSpeichern) el.btnMaSpeichern.addEventListener("click", speichereMitarbeiter);

  if (el.btnMaZeile) {
    el.btnMaZeile.addEventListener("click", () => {
      if (mitarbeiterEntwurf.length >= MITARBEITER_MAX_ZEILEN) {
        zeigeToast(`Maximal ${MITARBEITER_MAX_ZEILEN} Zeilen möglich.`);
        return;
      }
      mitarbeiterEntwurf.push(leereMaZeile());
      renderMaFormular();
      const eingaben = el.maBody.querySelectorAll('.ma-eingabe[data-ma-feld="name"]');
      if (eingaben.length) eingaben[eingaben.length - 1].focus();
    });
  }

  if (el.btnMaKonfliktLaden) {
    el.btnMaKonfliktLaden.addEventListener("click", () => {
      mitarbeiterEntwurf = maZeilenMitAuffuellung();
      maBasisStempel = zeitstempelWert(mitarbeiterMeta.am);
      el.maKonflikt.hidden = true;
      renderMaFormular();
    });
  }

  if (el.maBody) {
    el.maBody.addEventListener("input", (event) => {
      const eingabe = event.target;
      if (!eingabe.dataset || eingabe.dataset.maZeile === undefined) return;
      const zeile = mitarbeiterEntwurf[Number(eingabe.dataset.maZeile)];
      if (!zeile) return;
      zeile[eingabe.dataset.maFeld] = eingabe.value;
      if (eingabe.tagName === "TEXTAREA") passeMaTextareasAn();
    });

    el.maBody.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-ma-entfernen]");
      if (!knopf) return;
      mitarbeiterEntwurf.splice(Number(knopf.dataset.maEntfernen), 1);
      // Mindestens die Standardanzahl an Zeilen bleibt im Formular stehen.
      while (mitarbeiterEntwurf.length < MITARBEITER_MIN_ZEILEN) mitarbeiterEntwurf.push(leereMaZeile());
      renderMaFormular();
    });
  }
