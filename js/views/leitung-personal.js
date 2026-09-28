"use strict";

  /* ------------------------------------------------------------------------
     25. Leitung — Personal (echte RP-Personalakte)
     ------------------------------------------------------------------------
     KEINE Ansicht der technischen Benutzerverwaltung (die bleibt unter
     Verwaltung, siehe js/views/admin.js) - eine eigenständige RP-Führungs-
     funktion, sichtbar für Leitung UND Admin (istLeitung() || istAdmin()).

     Identifiziert Personen über die "uid" aus der bereits geladenen
     benutzerListe (siehe starteBenutzerverwaltung in js/views/admin.js, die
     Collection wird für Verwaltung UND Leitung gemeinsam geladen). Zeigt nur
     freigegebene ("approved") Accounts - Registrierungsanfragen/Sperren sind
     ein rein technischer Verwaltungs-Vorgang.

     Zwei neue, komplett von adminLog getrennte Collections (siehe
     firestore.rules):
       - personalnotizen/{id}: { uid, text, erstelltVon, erstelltAm }
       - ranghistorie/{id}: { uid, alterRang, neuerRang, art, von, am, begruendung }
     Beide werden - wie akten/termine im übrigen Bestand - komplett geladen
     und hier client-seitig nach "uid" gefiltert, statt pro Personalakte eine
     eigene gefilterte Firestore-Abfrage zu öffnen. */

  let offenerPersonalUid = null;
  let personalakteAktiverTab = "uebersicht";

  function starteLeitungPersonalListener() {
    if (!db || !(istAdmin() || istLeitung())) return;
    if (unsubPersonalnotizen) unsubPersonalnotizen();
    unsubPersonalnotizen = db
      .collection("personalnotizen")
      .orderBy("erstelltAm", "desc")
      .onSnapshot(
        (snap) => {
          personalnotizen = [];
          snap.forEach((docSnap) => personalnotizen.push({ id: docSnap.id, ...docSnap.data() }));
          aktualisierePersonalakteAnsicht();
        },
        (fehler) => console.error("Personalnotizen konnten nicht geladen werden:", fehler)
      );

    if (unsubRanghistorie) unsubRanghistorie();
    unsubRanghistorie = db
      .collection("ranghistorie")
      .orderBy("am", "desc")
      .onSnapshot(
        (snap) => {
          ranghistorie = [];
          snap.forEach((docSnap) => ranghistorie.push({ id: docSnap.id, ...docSnap.data() }));
          aktualisierePersonalakteAnsicht();
        },
        (fehler) => console.error("Ranghistorie konnte nicht geladen werden:", fehler)
      );
  }

  function stoppeLeitungPersonalListener() {
    if (unsubPersonalnotizen) {
      unsubPersonalnotizen();
      unsubPersonalnotizen = null;
    }
    if (unsubRanghistorie) {
      unsubRanghistorie();
      unsubRanghistorie = null;
    }
  }

  // --- Personal-Liste ---------------------------------------------------------
  function renderLeitungPersonal() {
    if (!el.leitungPersonalListe) return;
    const liste = benutzerListe
      .filter((b) => b.status === "approved")
      .slice()
      .sort((a, b) => (a.username || "").localeCompare(b.username || "", "de"));

    el.leitungPersonalListe.innerHTML = liste
      .map(
        (b) => `<div class="settings-list__item" data-personal-oeffnen="${b.uid}">
          <div class="settings-list__avatar">${escapeHtml(initialenAvatar(b.username))}</div>
          <div class="settings-list__info">
            <div class="settings-list__toprow">
              <span class="settings-list__name">${escapeHtml(b.username || "Unbekannt")}</span>
              ${rangBadgeHtml(b.rolle)}
            </div>
          </div>
          <span class="settings-list__chevron">›</span>
        </div>`
      )
      .join("");

    if (el.leitungPersonalEmpty) el.leitungPersonalEmpty.hidden = liste.length > 0;
  }

  if (el.leitungPersonalListe) {
    el.leitungPersonalListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-personal-oeffnen]");
      if (!zeile) return;
      oeffnePersonalakte(zeile.getAttribute("data-personal-oeffnen"));
    });
  }

  // --- Personalakte: Kopf ------------------------------------------------------
  // Funknummer stammt aus der Mitarbeiterliste (kataloge/mitarbeiterliste) -
  // dort gibt es (noch) keine Verknüpfung über uid, deshalb bestenmöglich
  // über den Namen gematcht. Kein Treffer ist kein Fehler, die Zeile entfällt
  // dann einfach.
  function leitungFunkVonName(name) {
    const treffer = mitarbeiter.find((z) => z.name.trim().toLowerCase() === (name || "").trim().toLowerCase());
    return treffer ? treffer.funk.trim() : "";
  }

  function personalakteEintragHtml(label, wert) {
    return `<span class="pkopf__eintrag"><span class="pkopf__label">${label}</span><span class="pkopf__wert">${escapeHtml(wert)}</span></span>`;
  }

  function renderPersonalakteKopf(person) {
    if (!el.personalakteName) return;
    el.personalakteName.textContent = person.username || "Unbekannt";
    const funk = leitungFunkVonName(person.username);
    const eintraege = [personalakteEintragHtml("Rang", normalisiereRang(person.rolle) || "—")];
    if (funk) eintraege.push(personalakteEintragHtml("Funknummer", funk));
    eintraege.push(personalakteEintragHtml("Eintrittsdatum", person.eintrittsdatum || "—"));
    el.personalakteDaten.innerHTML = eintraege.join("");
  }

  // --- Personalakte: Übersicht --------------------------------------------------
  function renderPersonalakteUebersicht(person) {
    if (!el.personalakteUebersichtInhalt) return;
    const notizenAnzahl = personalnotizen.filter((n) => n.uid === person.uid).length;
    const historie = ranghistorie.filter((r) => r.uid === person.uid).sort((a, b) => zeitstempelWert(b.am) - zeitstempelWert(a.am));
    const letzte = historie[0];
    el.personalakteUebersichtInhalt.innerHTML = `<dl class="akte-seite">
        <div><dt>Aktueller Rang</dt><dd>${rangBadgeHtml(person.rolle) || "—"}</dd></div>
        <div><dt>Eintrittsdatum</dt><dd>${escapeHtml(person.eintrittsdatum || "—")}</dd></div>
        <div><dt>Personalnotizen</dt><dd>${notizenAnzahl}</dd></div>
        <div><dt>Letzte Rangänderung</dt><dd>${
          letzte ? `${escapeHtml(letzte.alterRang || "Aufnahme")} → ${escapeHtml(letzte.neuerRang)}, ${formatDatumUhrzeit(letzte.am)}` : "—"
        }</dd></div>
      </dl>`;
  }

  // --- Personalakte: Karriere (RP-Rang ändern + Historie) -----------------------
  function renderPersonalakteKarriere(person) {
    if (!el.personalakteRangSelect) return;
    el.personalakteRangSelect.innerHTML = BENUTZER_RAENGE.map(
      (r) => `<option value="${r}" ${r === normalisiereRang(person.rolle) ? "selected" : ""}>${r}</option>`
    ).join("");
    aktualisiereCustomSelect(el.personalakteRangSelect);
    el.personalakteRangBegruendung.value = "";
    versteckeFeldFehler(el.personalakteRangError);

    const historie = ranghistorie
      .filter((r) => r.uid === person.uid)
      .sort((a, b) => zeitstempelWert(b.am) - zeitstempelWert(a.am));
    el.personalakteKarriereListe.innerHTML = historie.length
      ? historie
          .map(
            (eintrag) => `<div class="admin-log__item">
          <span class="admin-log__item-text">${
            eintrag.alterRang ? `${escapeHtml(eintrag.alterRang)} → ${escapeHtml(eintrag.neuerRang)}` : `Aufnahme als ${escapeHtml(eintrag.neuerRang)}`
          }${eintrag.begruendung ? ` — ${escapeHtml(eintrag.begruendung)}` : ""}</span>
          <span class="admin-log__item-zeit">${escapeHtml(eintrag.von || "")}, ${formatDatumUhrzeit(eintrag.am)}</span>
        </div>`
          )
          .join("")
      : `<p class="empty-state empty-state--kompakt">Noch keine Karrierehistorie.</p>`;
  }

  if (el.btnPersonalakteRangSpeichern) {
    el.btnPersonalakteRangSpeichern.addEventListener("click", async () => {
      if (!offenerPersonalUid || !window.BenutzerVerwaltung) return;
      versteckeFeldFehler(el.personalakteRangError);
      const neueRolle = el.personalakteRangSelect.value;
      const begruendung = el.personalakteRangBegruendung.value.trim();
      el.btnPersonalakteRangSpeichern.disabled = true;
      try {
        await window.BenutzerVerwaltung.setzeRolle(offenerPersonalUid, neueRolle, begruendung);
        zeigeToast("Rang gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(
          el.personalakteRangError,
          fehler && fehler.code === "permission-denied"
            ? 'Keine Berechtigung: Die Firestore-Regel für die Leitungs-Rangvergabe ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
            : "Speichern fehlgeschlagen. Bitte erneut versuchen."
        );
      } finally {
        el.btnPersonalakteRangSpeichern.disabled = false;
      }
    });
  }

  // --- Personalakte: Notizen ----------------------------------------------------
  function renderPersonalakteNotizen(person) {
    if (!el.personalakteNotizenListe) return;
    const eigene = personalnotizen.filter((n) => n.uid === person.uid).sort((a, b) => zeitstempelWert(b.erstelltAm) - zeitstempelWert(a.erstelltAm));
    el.personalakteNotizenListe.innerHTML = eigene.length
      ? eigene
          .map(
            (n) => `<div class="admin-log__item">
          <span class="admin-log__item-text">${escapeHtml(n.text)}</span>
          <span class="admin-log__item-zeit">${escapeHtml(n.erstelltVon || "")}, ${formatDatumUhrzeit(n.erstelltAm)}</span>
        </div>`
          )
          .join("")
      : `<p class="empty-state empty-state--kompakt">Noch keine Notizen.</p>`;
  }

  if (el.btnPersonalakteNotizSpeichern) {
    el.btnPersonalakteNotizSpeichern.addEventListener("click", async () => {
      if (!offenerPersonalUid) return;
      versteckeFeldFehler(el.personalakteNotizError);
      const text = el.personalakteNotizEingabe.value.trim();
      if (!text) {
        zeigeFeldFehler(el.personalakteNotizError, "Bitte einen Text eingeben.");
        return;
      }
      el.btnPersonalakteNotizSpeichern.disabled = true;
      try {
        await db.collection("personalnotizen").add({
          uid: offenerPersonalUid,
          text,
          erstelltVon: aktuellerNutzer.name,
          erstelltAm: firebase.firestore.FieldValue.serverTimestamp(),
        });
        el.personalakteNotizEingabe.value = "";
        zeigeToast("Notiz gespeichert.");
      } catch (fehler) {
        console.error(fehler);
        zeigeFeldFehler(
          el.personalakteNotizError,
          fehler && fehler.code === "permission-denied"
            ? 'Keine Berechtigung: Die Firestore-Regel für "personalnotizen" ist noch nicht veröffentlicht (Firebase Console, Firestore, Regeln).'
            : "Speichern fehlgeschlagen. Bitte erneut versuchen."
        );
      } finally {
        el.btnPersonalakteNotizSpeichern.disabled = false;
      }
    });
  }

  // --- Reiter innerhalb der Personalakte (wie .ptabs bei Patient/Akten) --------
  function setzePersonalakteTab(tab) {
    personalakteAktiverTab = tab;
    document.querySelectorAll("[data-personalakte-tab]").forEach((knopf) => {
      knopf.classList.toggle("tabs__tab--active", knopf.getAttribute("data-personalakte-tab") === tab);
    });
    if (el.personalaktePanelUebersicht) el.personalaktePanelUebersicht.hidden = tab !== "uebersicht";
    if (el.personalaktePanelKarriere) el.personalaktePanelKarriere.hidden = tab !== "karriere";
    if (el.personalaktePanelNotizen) el.personalaktePanelNotizen.hidden = tab !== "notizen";
    aktualisierePersonalakteAnsicht();
  }

  document.querySelectorAll("[data-personalakte-tab]").forEach((knopf) => {
    knopf.addEventListener("click", () => setzePersonalakteTab(knopf.getAttribute("data-personalakte-tab")));
  });

  // Wird von den Snapshot-Listenern (benutzerListe/personalnotizen/
  // ranghistorie) aufgerufen, damit die offene Personalakte live bleibt.
  function aktualisierePersonalakteAnsicht() {
    if (!offenerPersonalUid) return;
    const person = benutzerListe.find((b) => b.uid === offenerPersonalUid);
    if (!person) return;
    renderPersonalakteKopf(person);
    if (personalakteAktiverTab === "uebersicht") renderPersonalakteUebersicht(person);
    else if (personalakteAktiverTab === "karriere") renderPersonalakteKarriere(person);
    else if (personalakteAktiverTab === "notizen") renderPersonalakteNotizen(person);
  }

  function oeffnePersonalakte(uid) {
    const person = benutzerListe.find((b) => b.uid === uid);
    if (!person) return;
    offenerPersonalUid = uid;
    setzePersonalakteTab("uebersicht");
    zeigeAnsicht("leitung-personalakte");
  }
