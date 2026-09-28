"use strict";

  /* ------------------------------------------------------------------------
     19. Verwaltung (Benutzerverwaltung) + gemeinsame Personendaten
     ------------------------------------------------------------------------
     benutzerListe wird HIER geladen, aber von ZWEI unabhängigen Bereichen
     genutzt: der (admin-exklusiven) Verwaltung und der (leitung+admin)
     Leitungs-Personalübersicht (js/views/leitung-personal.js) - eine
     Collection, zwei getrennte Ansichten. Das technische adminLog
     (starteAdminLog weiter unten) bleibt bewusst STRIKT admin-exklusiv und
     komplett getrennt davon. */
  function starteBenutzerverwaltung() {
    if (!window.BenutzerVerwaltung || !(istAdmin() || istLeitung())) return;
    if (unsubBenutzerliste) unsubBenutzerliste();
    unsubBenutzerliste = window.BenutzerVerwaltung.onListe((liste) => {
      benutzerListe = liste;

      if (istAdmin()) {
        const pendingUids = liste.filter((b) => b.status === "pending").map((b) => b.uid);
        if (bekanntePendingUids !== null) {
          const neu = pendingUids.filter((uid) => !bekanntePendingUids.includes(uid));
          if (neu.length > 0) zeigeToast(`${neu.length} neue Registrierung${neu.length === 1 ? "" : "en"} wartet auf Freigabe.`);
        }
        bekanntePendingUids = pendingUids;
        el.navAdminBadge.hidden = pendingUids.length === 0;
        el.navAdminBadge.textContent = String(pendingUids.length);
      }

      renderBenutzerverwaltung();
      if (aktiverDetailUid) renderBenutzerDetails(aktiverDetailUid);
      renderAdminUebersicht();
      renderLeitungUebersicht();
      renderLeitungPersonal();
      aktualisierePersonalakteAnsicht();
    });
  }

  function stoppeBenutzerverwaltung() {
    if (unsubBenutzerliste) {
      unsubBenutzerliste();
      unsubBenutzerliste = null;
    }
    bekanntePendingUids = null;
  }

  /* ------------------------------------------------------------------------
     19b. Technisches Aktivitäts-Log - STRIKT admin-exklusiv
     ------------------------------------------------------------------------
     Bewusst eigener Start/Stop, getrennt von starteBenutzerverwaltung oben:
     eine reine Leitungsperson (ohne Adminrechte) darf benutzerListe sehen,
     aber niemals adminLog - siehe firestore.rules (adminLog bleibt
     ausschließlich istAdmin()). */
  function starteAdminLog() {
    if (!window.BenutzerVerwaltung || !istAdmin()) return;
    if (unsubAdminLog) unsubAdminLog();
    unsubAdminLog = window.BenutzerVerwaltung.onLog((liste) => {
      adminLogEintraege = liste;
      renderAdminLog();
      renderAdminUebersicht();
    });
  }

  function stoppeAdminLog() {
    if (unsubAdminLog) {
      unsubAdminLog();
      unsubAdminLog = null;
    }
  }

  /* ------------------------------------------------------------------------
     19c. Verwaltungs-Übersicht
     ------------------------------------------------------------------------
     Kompakter Kennzahlen-Streifen + letzte Systemaktivitäten - reine
     Auswertung von benutzerListe/adminLogEintraege, keine Dummy-Daten. */
  function renderAdminUebersicht() {
    if (!el.adminKpiInsgesamt || !istAdmin()) return;
    el.adminKpiInsgesamt.textContent = String(benutzerListe.length);
    el.adminKpiAktiv.textContent = String(benutzerListe.filter((b) => b.status === "approved").length);
    el.adminKpiGesperrt.textContent = String(benutzerListe.filter((b) => b.status === "locked").length);
    el.adminKpiAntraege.textContent = String(benutzerListe.filter((b) => b.status === "pending").length);
    el.adminKpiAdmins.textContent = String(benutzerListe.filter((b) => b.isAdmin).length);
    el.adminKpiLeitung.textContent = String(benutzerListe.filter((b) => b.isLeitung).length);

    if (el.adminUebersichtAktivitaeten) {
      const letzte = adminLogEintraege.slice(0, 6);
      el.adminUebersichtAktivitaeten.innerHTML = letzte.length
        ? letzte.map(adminLogEintragHtml).join("")
        : `<p class="empty-state empty-state--kompakt">Noch keine Systemaktivitäten.</p>`;
    }
  }

  /* ------------------------------------------------------------------------
     19d. System (vorbereiteter Bereich - keine erfundenen Einstellungen)
     ------------------------------------------------------------------------ */
  function renderAdminSystem() {
    if (el.adminSystemVersion) el.adminSystemVersion.textContent = String(VERSION_AKTUELL);
  }
  renderAdminSystem();

  // Rang-Auswahl im "Benutzer erstellen"-Formular: dynamisch aus der
  // zentralen Rangliste statt einer hartkodierten Options-Liste (siehe
  // js/core/raenge.js - aufgerufen von dessen Snapshot-Listener). Nur aktive
  // Ränge, damit ein neu angelegter Account nie mit einem deaktivierten
  // Rang startet.
  function renderNeuerBenutzerRolleOptionen() {
    if (!el.neuerBenutzerRolleInput) return;
    const bisheriger = el.neuerBenutzerRolleInput.value;
    el.neuerBenutzerRolleInput.innerHTML = aktiveRaenge()
      .map((r) => `<option value="${escapeHtml(r.rangId)}">${escapeHtml(r.name)}</option>`)
      .join("");
    if (aktiveRaenge().some((r) => r.rangId === bisheriger)) el.neuerBenutzerRolleInput.value = bisheriger;
    aktualisiereCustomSelect(el.neuerBenutzerRolleInput);
  }

  function gefiltertBenutzer() {
    let liste = benutzerListe;
    if (benutzerStatusFilter === "pending") liste = liste.filter((b) => b.status === "pending");
    else if (benutzerStatusFilter === "locked") liste = liste.filter((b) => b.status === "locked");
    else if (benutzerStatusFilter === "admin") liste = liste.filter((b) => b.isAdmin);

    const begriff = benutzerSuche.trim().toLowerCase();
    if (begriff) {
      liste = liste.filter((b) => (b.username || "").toLowerCase().includes(begriff) || (b.email || "").toLowerCase().includes(begriff));
    }
    return liste;
  }

  function renderBenutzerverwaltungStatusFilter() {
    if (!el.benutzerverwaltungStatusFilter) return;
    const optionen = [
      ["alle", "Alle"],
      ["pending", "Wartend"],
      ["locked", "Gesperrt"],
      ["admin", "Verwalter"],
    ];
    el.benutzerverwaltungStatusFilter.innerHTML = optionen
      .map(
        ([wert, label]) =>
          `<button type="button" class="tabs__tab${benutzerStatusFilter === wert ? " tabs__tab--active" : ""}" data-benutzer-statusfilter="${wert}">${label}</button>`
      )
      .join("");
  }

  if (el.benutzerverwaltungStatusFilter) {
    el.benutzerverwaltungStatusFilter.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-benutzer-statusfilter]");
      if (!btn) return;
      benutzerStatusFilter = btn.getAttribute("data-benutzer-statusfilter");
      renderBenutzerverwaltung();
    });
  }

  function renderBenutzerverwaltung() {
    if (!el.benutzerverwaltungListe) return;
    renderBenutzerverwaltungStatusFilter();
    // Wartende Registrierungen immer zuerst, damit eine neue Anfrage nie in
    // einer langen Liste untergeht - bisher gab es dafür nur einen Toast beim
    // Erscheinen, aber keine dauerhafte Priorisierung in der Liste selbst.
    const liste = gefiltertBenutzer()
      .slice()
      .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
    el.benutzerverwaltungListe.innerHTML = liste
      .map((b) => {
        const statusLabel = b.status === "pending" ? "Wartet auf Freigabe" : b.status === "rejected" ? "Abgelehnt" : b.status === "locked" ? "Gesperrt" : "";
        return `<div class="settings-list__item" data-benutzer-oeffnen="${b.uid}">
          <div class="settings-list__avatar">${escapeHtml(initialenAvatar(b.username))}</div>
          <div class="settings-list__info">
            <div class="settings-list__toprow">
              <span class="settings-list__name">${escapeHtml(b.username || "Unbekannt")}</span>
              ${b.isAdmin ? '<span class="badge badge--verwalter">Verwalter</span>' : ""}
              ${b.isLeitung ? '<span class="badge badge--verwalter">Leitung</span>' : ""}
              ${statusLabel ? `<span class="badge badge--danger-soft">${statusLabel}</span>` : ""}
            </div>
            <div class="settings-list__subrow">
              <span class="settings-list__role settings-list__role--dezent">Letzter Login: ${formatDatumUhrzeit(b.lastLogin)}</span>
            </div>
          </div>
          <span class="settings-list__chevron">›</span>
        </div>`;
      })
      .join("");
  }

  if (el.benutzerverwaltungSearchInput) {
    el.benutzerverwaltungSearchInput.addEventListener("input", () => {
      benutzerSuche = el.benutzerverwaltungSearchInput.value;
      renderBenutzerverwaltung();
    });
  }

  if (el.benutzerverwaltungListe) {
    el.benutzerverwaltungListe.addEventListener("click", (event) => {
      const zeile = event.target.closest("[data-benutzer-oeffnen]");
      if (!zeile) return;
      aktiverDetailUid = zeile.getAttribute("data-benutzer-oeffnen");
      renderBenutzerDetails(aktiverDetailUid);
      oeffneModal("modal-benutzer-details");
    });
  }

  // Benutzerdetails-Modal: klare Trennung TECHNISCHER ACCOUNT (Status,
  // E-Mail, Zeiten, Verwalter-/Leitungsrechte, RP-Rang nur lesend) von
  // AKTIONEN (destruktive/einmalige Schaltflächen) - siehe Vorgabe. Der
  // RP-Rang wird bewusst NICHT hier bearbeitet, sondern in der Personalakte
  // der Leitung (js/views/leitung-personal.js).
  function renderBenutzerDetails(uid) {
    const b = benutzerListe.find((x) => x.uid === uid);
    if (!b) return;
    el.benutzerDetailsName.textContent = b.username || "Unbekannt";

    const statusText =
      b.status === "approved"
        ? "Aktiv"
        : b.status === "pending"
        ? "Wartet auf Freigabe"
        : b.status === "rejected"
        ? "Abgelehnt"
        : b.status === "locked"
        ? b.gesperrtBis
          ? `Gesperrt bis ${formatDatumUhrzeit(b.gesperrtBis)}`
          : "Dauerhaft gesperrt"
        : "—";

    el.benutzerDetailsBody.innerHTML = `
      <div class="detail-grid">
        ${
          b.status === "pending"
            ? `<div class="detail-row"><span class="detail-row__label">Registrierung</span>
                <button class="btn btn--primary btn--sm" data-benutzer-aktion="freigeben">Freigeben</button>
                <button class="btn btn--danger btn--sm" data-benutzer-aktion="ablehnen">Ablehnen</button></div>`
            : ""
        }

        <h4 class="detail-abschnitt-titel">Technischer Account</h4>
        <div class="detail-row"><span class="detail-row__label">Accountstatus</span><span>${escapeHtml(statusText)}</span></div>
        <div class="detail-row"><span class="detail-row__label">E-Mail</span><span>${escapeHtml(b.email || "—")}</span></div>
        <div class="detail-row"><span class="detail-row__label">Registriert</span><span>${formatDatumUhrzeit(b.createdAt)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Letzter Login</span><span>${formatDatumUhrzeit(b.lastLogin)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Verwalterrechte</span>
          <label class="field-checkbox-row"><input type="checkbox" id="detail-admin-checkbox" ${b.isAdmin ? "checked" : ""}/> Verwalter</label></div>
        <div class="detail-row"><span class="detail-row__label">Leitungsrechte</span>
          <label class="field-checkbox-row"><input type="checkbox" id="detail-leitung-checkbox" ${b.isLeitung ? "checked" : ""}/> Leitung (RP-Führungsebene)</label></div>
        <div class="detail-row"><span class="detail-row__label">RP-Rang</span>
          <span>${rangBadgeHtml(b.rolle) || "—"}</span></div>
        <p class="abschnitt__hint" style="margin: -10px 0 0;">RP-Rang wird über die Personalakte der Leitung verwaltet.</p>
        <div class="detail-row"><span class="detail-row__label">Umbenennen</span>
          <input type="text" class="field-input" id="detail-name-input" value="${escapeHtml(b.username || "")}" style="max-width:220px;" />
          <button class="btn btn--ghost btn--sm" data-benutzer-aktion="umbenennen">Speichern</button></div>
        <div class="detail-row"><span class="detail-row__label">Notiz</span>
          <input type="text" class="field-input" id="detail-notiz-input" value="${escapeHtml(b.adminNote || "")}" style="flex:1;" /></div>

        <h4 class="detail-abschnitt-titel">Aktionen</h4>
        <div class="detail-row"><span class="detail-row__label">Sperrstatus</span>
          ${
            b.status === "locked"
              ? `<button class="btn btn--ghost btn--sm" data-benutzer-aktion="entsperren">Entsperren</button>`
              : `<select class="field-input" id="detail-sperr-dauer" style="max-width:150px;">
                   <option value="0">Dauerhaft</option>
                   <option value="1">1 Tag</option>
                   <option value="7">7 Tage</option>
                   <option value="30">30 Tage</option>
                 </select>
                 <button class="btn btn--danger btn--sm" data-benutzer-aktion="sperren">Sperren</button>`
          }
        </div>
        ${
          b.email
            ? `<div class="detail-row"><span class="detail-row__label">Passwort</span>
                <button class="btn btn--ghost btn--sm" data-benutzer-aktion="passwort-reset">Zurücksetzen-E-Mail senden</button></div>`
            : ""
        }
        <div class="detail-row" style="justify-content:flex-end; border-top:1px solid var(--panel-edge); padding-top:14px;">
          <button class="btn btn--danger btn--sm" data-benutzer-aktion="loeschen">Benutzer löschen</button>
        </div>
      </div>`;

    // Das <select>-Feld hier wird per innerHTML neu erzeugt, ist also zur
    // Ladezeit noch nicht Teil des generischen Custom-Select-Upgrades (siehe
    // erzeugeCustomSelect in js/core/dom.js) - ohne diesen Aufruf bliebe es
    // das native, unauffällige Browser-Dropdown.
    const sperrDauerSelect = document.getElementById("detail-sperr-dauer");
    if (sperrDauerSelect) erzeugeCustomSelect(sperrDauerSelect);

    const adminCheckbox = document.getElementById("detail-admin-checkbox");
    if (adminCheckbox) adminCheckbox.addEventListener("change", () => window.BenutzerVerwaltung.setzeAdmin(uid, adminCheckbox.checked, b.username));

    // Leitungsrechte: technisch identisch zu Verwalterrechten (eigenes,
    // unabhängiges Feld), aber ausschließlich Admins dürfen sie vergeben
    // (siehe firestore.rules) - deshalb lebt diese Checkbox bewusst hier in
    // der Verwaltung, nicht in der Personalakte selbst.
    const leitungCheckbox = document.getElementById("detail-leitung-checkbox");
    if (leitungCheckbox) leitungCheckbox.addEventListener("change", () => window.BenutzerVerwaltung.setzeLeitung(uid, leitungCheckbox.checked, b.username));

    const notizInput = document.getElementById("detail-notiz-input");
    if (notizInput)
      notizInput.addEventListener("change", () => window.BenutzerVerwaltung.setzeNotiz(uid, notizInput.value.trim()));

    el.benutzerDetailsBody.querySelectorAll("[data-benutzer-aktion]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const aktion = btn.getAttribute("data-benutzer-aktion");
        try {
          if (aktion === "freigeben") await window.BenutzerVerwaltung.setzeStatus(uid, "approved", b.username);
          else if (aktion === "ablehnen") await window.BenutzerVerwaltung.setzeStatus(uid, "rejected", b.username);
          else if (aktion === "entsperren") await window.BenutzerVerwaltung.entsperreBenutzer(uid, b.username);
          else if (aktion === "sperren") {
            const tage = parseInt(document.getElementById("detail-sperr-dauer").value, 10);
            await window.BenutzerVerwaltung.sperreBenutzer(uid, tage, b.username);
          } else if (aktion === "umbenennen") {
            const neuerName = document.getElementById("detail-name-input").value.trim();
            if (neuerName && neuerName !== b.username) await window.BenutzerVerwaltung.benenneUm(uid, neuerName, b.username);
          } else if (aktion === "passwort-reset") {
            await window.BenutzerVerwaltung.sendePasswortReset(b.email, uid, b.username);
            zeigeToast("Passwort-Zurücksetzen-E-Mail versendet.");
          } else if (aktion === "loeschen") {
            schliesseModal("modal-benutzer-details");
            fordereLoeschungAn("Benutzer löschen", `Möchtest du „${b.username}“ wirklich endgültig löschen?`, async () => {
              await window.BenutzerVerwaltung.loesche(uid);
              aktiverDetailUid = null;
              zeigeToast("Benutzer gelöscht.");
            });
          }
        } catch (fehler) {
          zeigeToast(fehler.message || "Aktion fehlgeschlagen.");
          console.error(fehler);
        }
      });
    });
  }

  if (el.formAddBenutzer) {
    el.formAddBenutzer.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = el.neuerBenutzerNameInput.value.trim();
      const email = el.neuerBenutzerEmailInput.value.trim();
      const rolle = el.neuerBenutzerRolleInput.value;
      try {
        await window.BenutzerVerwaltung.erstelleNeuenBenutzer({ username, email, rolle });
        el.formAddBenutzer.reset();
        zeigeToast(`Benutzer „${username}“ erstellt — Passwort-E-Mail wurde versendet.`);
      } catch (fehler) {
        zeigeToast(fehler.message || "Benutzer konnte nicht erstellt werden.");
        console.error(fehler);
      }
    });
  }

  /* ------------------------------------------------------------------------
     19e. Aktivitätslog: Darstellung + Filter
     ------------------------------------------------------------------------ */
  // Gemeinsame Zeilen-Vorlage - auch von renderAdminUebersicht genutzt, damit
  // die "Letzte Systemaktivitäten"-Karte und das volle Log gleich aussehen.
  // Zeit zuerst (eigene Zeile), dann wer/was/wen - siehe Vorgabe-Beispiel.
  function adminLogEintragHtml(log) {
    return `<div class="admin-log__item">
        <span class="admin-log__item-zeit">${formatDatumUhrzeit(log.zeitpunkt)}</span>
        <span class="admin-log__item-text"><strong>${escapeHtml(log.adminName || "Unbekannt")}</strong> — ${escapeHtml(log.aktion)}${
      log.zielName ? ` · ${escapeHtml(log.zielName)}` : ""
    }${log.details ? ` (${escapeHtml(log.details)})` : ""}</span>
      </div>`;
  }

  function renderAdminLogAktionFilter() {
    if (!el.adminLogAktionFilter) return;
    const aktionen = Array.from(new Set(adminLogEintraege.map((l) => l.aktion).filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"));
    const gewaehlt = adminLogAktionFilterWert;
    el.adminLogAktionFilter.innerHTML =
      `<option value="alle">Alle Aktionen</option>` + aktionen.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
    // Falls die zuvor gewählte Aktion nicht mehr im (aktuellen 50er-Fenster)
    // Log vorkommt, fällt der Filter sauber auf "Alle Aktionen" zurück.
    el.adminLogAktionFilter.value = aktionen.includes(gewaehlt) ? gewaehlt : "alle";
    adminLogAktionFilterWert = el.adminLogAktionFilter.value;
    aktualisiereCustomSelect(el.adminLogAktionFilter);
  }

  function gefiltertesAdminLog() {
    let liste = adminLogEintraege;
    if (adminLogAktionFilterWert !== "alle") liste = liste.filter((l) => l.aktion === adminLogAktionFilterWert);
    if (adminLogZeitraumFilterWert !== "alle") {
      const grenzeMs = adminLogZeitraumFilterWert === "heute" ? tagAnfang(new Date()).getTime() : Date.now() - Number(adminLogZeitraumFilterWert) * 86400000;
      liste = liste.filter((l) => zeitstempelWert(l.zeitpunkt) >= grenzeMs);
    }
    const begriff = adminLogSuche.trim().toLowerCase();
    if (begriff) {
      liste = liste.filter((l) => (l.adminName || "").toLowerCase().includes(begriff) || (l.zielName || "").toLowerCase().includes(begriff));
    }
    return liste;
  }

  function renderAdminLog() {
    if (!el.adminLogListe) return;
    renderAdminLogAktionFilter();
    const liste = gefiltertesAdminLog();
    el.adminLogListe.innerHTML = liste.map(adminLogEintragHtml).join("");
    if (el.adminLogLeer) el.adminLogLeer.hidden = liste.length > 0;
  }

  if (el.adminLogSucheInput) {
    el.adminLogSucheInput.addEventListener("input", () => {
      adminLogSuche = el.adminLogSucheInput.value;
      renderAdminLog();
    });
  }
  if (el.adminLogAktionFilter) {
    el.adminLogAktionFilter.addEventListener("change", () => {
      adminLogAktionFilterWert = el.adminLogAktionFilter.value;
      renderAdminLog();
    });
  }
  if (el.adminLogZeitraumFilter) {
    el.adminLogZeitraumFilter.addEventListener("change", () => {
      adminLogZeitraumFilterWert = el.adminLogZeitraumFilter.value;
      renderAdminLog();
    });
  }
