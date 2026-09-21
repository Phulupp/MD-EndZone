"use strict";

  /* ------------------------------------------------------------------------
     17. Startseite = Leitstelle
     ------------------------------------------------------------------------
     Oben der MD-Funk (MD_FUNK, immer derselbe Hauptfunk), darunter die
     Dienstübersicht: wer ist Im Dienst, wer Außer Dienst.

     Daten: Collection DIENST_COLLECTION, ein Dokument pro Konto
     (Dokument-ID = UID):
       { name, rolle, status "im-dienst" | "ausser-dienst", aktualisiertAm }
     Jeder freigegebene Nutzer trägt sich selbst über "Mein Status" ein bzw.
     um; "Nicht eingetragen" entfernt den eigenen Eintrag wieder. Verwalter
     dürfen fremde Einträge entfernen (z. B. wenn jemand die Gruppe verlassen
     hat). Eine Liste aller Konten gibt es für normale Nutzer nicht (siehe
     firestore.rules, users), deshalb erscheint jemand erst, wenn er sich
     einmal eingetragen hat.

     Die Funknummer neben dem Namen stammt aus der Mitarbeiterliste (Abgleich
     über den Namen, Groß-/Kleinschreibung egal), falls dort jemand mit
     gleichem Namen steht. */
  function starteDienstListener() {
    if (!db) return;
    if (unsubDienst) unsubDienst();
    unsubDienst = db.collection(DIENST_COLLECTION).onSnapshot(
      (snap) => {
        dienstListe = [];
        snap.forEach((docSnap) => dienstListe.push({ uid: docSnap.id, ...docSnap.data() }));
        pflegeEigenenDienstEintrag();
        renderLeitstelle();
      },
      (fehler) => {
        console.error("Dienstliste konnte nicht geladen werden:", fehler);
        zeigeFeldFehler(
          el.dienstError,
          fehler && fehler.code === "permission-denied"
            ? 'Keine Berechtigung: Die Firestore-Regel für "dienst" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
            : "Die Dienstliste konnte nicht geladen werden. Bitte Seite neu laden."
        );
      }
    );
  }

  function eigenerDienstEintrag() {
    return aktuellerNutzer ? dienstListe.find((d) => d.uid === aktuellerNutzer.uid) || null : null;
  }

  // Name und Rang im eigenen Eintrag aktuell halten (z. B. nach einer
  // Beförderung), ohne den Zeitpunkt des Statuswechsels anzufassen.
  function pflegeEigenenDienstEintrag() {
    const eintrag = eigenerDienstEintrag();
    if (!eintrag || !db) return;
    if (eintrag.name === aktuellerNutzer.name && eintrag.rolle === aktuellerNutzer.rolle) return;
    db.collection(DIENST_COLLECTION)
      .doc(aktuellerNutzer.uid)
      .update({ name: aktuellerNutzer.name, rolle: aktuellerNutzer.rolle })
      .catch((fehler) => console.error("Dienst-Eintrag konnte nicht aktualisiert werden:", fehler));
  }

  function funknummerFuer(name) {
    const gesucht = (name || "").trim().toLowerCase();
    if (!gesucht) return "";
    const zeile = mitarbeiter.find((z) => z.name.trim().toLowerCase() === gesucht && z.funk.trim());
    return zeile ? zeile.funk.trim() : "";
  }

  // "seit 18:42 Uhr" für heute, sonst mit Datum.
  function seitText(ts) {
    if (!ts) return "";
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    const uhr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return d.toDateString() === new Date().toDateString() ? `seit ${uhr} Uhr` : `seit ${formatDatum(d)}, ${uhr} Uhr`;
  }

  // Höchster Rang zuerst, bei gleichem Rang alphabetisch.
  function dienstSortiert(liste) {
    const stufe = (d) => BENUTZER_RAENGE.indexOf(normalisiereRang(d.rolle));
    return liste.slice().sort((a, b) => stufe(b) - stufe(a) || (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" }));
  }

  // escapeHtml maskiert keine Anführungszeichen - für Attributwerte zusätzlich nötig.
  function attributSicher(text) {
    return escapeHtml(text).replace(/"/g, "&quot;");
  }

  function dienstZeileHtml(d) {
    const rolle = normalisiereRang(d.rolle || "");
    const farbe = RANG_AKZENTE[rolle] || RANG_AKZENT_STANDARD;
    const funk = funknummerFuer(d.name);
    const ich = aktuellerNutzer && d.uid === aktuellerNutzer.uid;
    const entfernen =
      istAdmin() && !ich
        ? `<button type="button" class="icon-btn icon-btn--delete dienst-zeile__entfernen" data-dienst-entfernen="${attributSicher(d.uid)}" title="Aus der Liste entfernen" aria-label="${attributSicher(d.name || "Eintrag")} aus der Liste entfernen">✕</button>`
        : "";
    return `<div class="dienst-zeile dienst-zeile--${d.status === "im-dienst" ? "im" : "ausser"}${ich ? " dienst-zeile--ich" : ""}">
        <span class="dienst-zeile__punkt" aria-hidden="true"></span>
        <span class="dienst-zeile__haupt">
          <span class="dienst-zeile__name">${escapeHtml(d.name || "—")}${ich ? ' <span class="dienst-zeile__ich">Du</span>' : ""}</span>
          <span class="dienst-zeile__rang" style="color:${farbe};">${escapeHtml(rolle)}</span>
        </span>
        ${funk ? `<span class="dienst-zeile__funk" title="Funknummer">${escapeHtml(funk)}</span>` : ""}
        <span class="dienst-zeile__seit">${escapeHtml(seitText(d.aktualisiertAm))}</span>
        ${entfernen}
      </div>`;
  }

  function renderLeitstelle() {
    if (!el.dienstListeIm) return;
    el.leitstelleFunk.textContent = MD_FUNK;

    const im = dienstSortiert(dienstListe.filter((d) => d.status === "im-dienst"));
    const ausser = dienstSortiert(dienstListe.filter((d) => d.status !== "im-dienst"));
    el.dienstAnzahlIm.textContent = String(im.length);
    el.dienstAnzahlAusser.textContent = String(ausser.length);
    el.dienstListeIm.innerHTML = im.length
      ? im.map(dienstZeileHtml).join("")
      : '<p class="empty-state">Niemand im Dienst.</p>';
    el.dienstListeAusser.innerHTML = ausser.length
      ? ausser.map(dienstZeileHtml).join("")
      : '<p class="empty-state">Niemand außer Dienst eingetragen.</p>';

    // "Mein Status" spiegelt den eigenen Eintrag (auch wenn er von einem
    // anderen Gerät oder einem Verwalter geändert wurde).
    const eigener = eigenerDienstEintrag();
    el.dienstStatusSelect.value = eigener ? eigener.status : "";
    aktualisiereCustomSelect(el.dienstStatusSelect);
    el.dienstStatusInfo.textContent = eigener ? seitText(eigener.aktualisiertAm) : "Du stehst noch nicht in der Liste.";
  }

  async function setzeEigenenDienststatus(status) {
    if (!db || !aktuellerNutzer) return;
    versteckeFeldFehler(el.dienstError);
    const ref = db.collection(DIENST_COLLECTION).doc(aktuellerNutzer.uid);
    try {
      if (!status) {
        await ref.delete();
        zeigeToast("Du wurdest aus der Dienstliste ausgetragen.");
      } else {
        await ref.set({
          name: aktuellerNutzer.name,
          rolle: aktuellerNutzer.rolle,
          status,
          aktualisiertAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        zeigeToast(`Status: ${DIENST_STATUS[status]}.`);
      }
    } catch (fehler) {
      console.error("Dienststatus konnte nicht gespeichert werden:", fehler);
      zeigeFeldFehler(
        el.dienstError,
        fehler && fehler.code === "permission-denied"
          ? 'Keine Berechtigung: Die Firestore-Regel für "dienst" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
          : "Der Status konnte nicht gespeichert werden. Bitte erneut versuchen."
      );
      renderLeitstelle();
    }
  }

  if (el.dienstStatusSelect) {
    el.dienstStatusSelect.addEventListener("change", () => setzeEigenenDienststatus(el.dienstStatusSelect.value));
  }

  [el.dienstListeIm, el.dienstListeAusser].forEach((liste) => {
    if (!liste) return;
    liste.addEventListener("click", (event) => {
      const knopf = event.target.closest("[data-dienst-entfernen]");
      if (!knopf || !istAdmin()) return;
      const uid = knopf.dataset.dienstEntfernen;
      const eintrag = dienstListe.find((d) => d.uid === uid);
      fordereLoeschungAn(
        "Aus der Dienstliste entfernen",
        `${eintrag && eintrag.name ? eintrag.name : "Dieser Eintrag"} wird aus der Dienstliste entfernt. Die Person kann sich jederzeit wieder eintragen.`,
        async () => {
          await db.collection(DIENST_COLLECTION).doc(uid).delete();
          zeigeToast("Eintrag entfernt.");
        }
      );
    });
  });
