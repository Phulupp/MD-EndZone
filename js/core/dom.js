"use strict";

  /* ------------------------------------------------------------------------
     3. DOM-Referenzen
     ------------------------------------------------------------------------ */
  const el = {
    authScreen: document.getElementById("auth-screen"),
    appRoot: document.getElementById("app-root"),

    sidebarNav: document.getElementById("sidebar-nav"),
    // Zwei GETRENNTE geschützte Sidebar-Buttons - siehe main.js für die
    // jeweils eigene Sichtbarkeitslogik (istLeitung()||istAdmin() vs. nur
    // istAdmin()). Nicht wieder zu einem Button zusammenführen.
    navLeitungToggle: document.getElementById("nav-leitung-toggle"),
    navAdminToggle: document.getElementById("nav-admin-toggle"),
    navAdminBadge: document.getElementById("nav-admin-badge"),
    views: document.querySelectorAll(".view"),
    viewTitle: document.getElementById("view-title"),
    viewSubtitle: document.getElementById("view-subtitle"),

    onlineWidgetBtn: document.getElementById("online-widget-btn"),
    onlineCount: document.getElementById("online-count"),
    onlinePanel: document.getElementById("online-panel"),
    onlinePanelList: document.getElementById("online-panel-list"),

    // Topbar-Uhr (siehe aktualisiereTopbarUhr in js/ui/nav.js)
    topbarDatum: document.getElementById("topbar-datum"),

    // Konto-Menü: jetzt in der Topbar statt im Sidebar-Footer (siehe index.html).
    sidebarUserBtn: document.getElementById("sidebar-user-btn"),
    sidebarUserMenu: document.getElementById("sidebar-user-menu"),
    sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
    sidebarUserName: document.getElementById("sidebar-user-name"),
    sidebarUserRole: document.getElementById("sidebar-user-role"),
    // sidebar-rang-stufen gibt es in der kompakten Topbar-Fassung des Kontos
    // bewusst nicht mehr (kein Platz) - main.js prüft dieses Element bereits
    // per "if (el.sidebarRangStufen)", daher hier unproblematisch "null".
    sidebarRangStufen: document.getElementById("sidebar-rang-stufen"),
    btnLogout: document.getElementById("btn-logout"),

    // Leitung — Übersicht (siehe js/views/leitung.js)
    leitungKpiMitarbeiter: document.getElementById("leitung-kpi-mitarbeiter"),
    leitungKpiDienst: document.getElementById("leitung-kpi-dienst"),
    leitungKpiTermine: document.getElementById("leitung-kpi-termine"),
    leitungDienstListe: document.getElementById("leitung-dienst-liste"),
    leitungInfoText: document.getElementById("leitung-info-text"),
    leitungInfoLeer: document.getElementById("leitung-info-leer"),
    leitungInfoMeta: document.getElementById("leitung-info-meta"),
    leitungTermineListe: document.getElementById("leitung-termine-liste"),

    // Leitung — Personal (siehe js/views/leitung-personal.js)
    leitungPersonalListe: document.getElementById("leitung-personal-liste"),
    leitungPersonalEmpty: document.getElementById("leitung-personal-empty"),

    // Leitung — Personalakte (eine Person, siehe js/views/leitung-personal.js)
    personalakteName: document.getElementById("personalakte-name"),
    personalakteDaten: document.getElementById("personalakte-daten"),
    personalaktePanelUebersicht: document.getElementById("personalakte-panel-uebersicht"),
    personalakteUebersichtInhalt: document.getElementById("personalakte-uebersicht-inhalt"),
    personalaktePanelKarriere: document.getElementById("personalakte-panel-karriere"),
    personalakteRangSelect: document.getElementById("personalakte-rang-select"),
    personalakteRangBegruendung: document.getElementById("personalakte-rang-begruendung"),
    personalakteRangError: document.getElementById("personalakte-rang-error"),
    btnPersonalakteRangSpeichern: document.getElementById("btn-personalakte-rang-speichern"),
    personalakteKarriereListe: document.getElementById("personalakte-karriere-liste"),
    personalaktePanelNotizen: document.getElementById("personalakte-panel-notizen"),
    personalakteNotizEingabe: document.getElementById("personalakte-notiz-eingabe"),
    personalakteNotizError: document.getElementById("personalakte-notiz-error"),
    btnPersonalakteNotizSpeichern: document.getElementById("btn-personalakte-notiz-speichern"),
    personalakteNotizenListe: document.getElementById("personalakte-notizen-liste"),

    toast: document.getElementById("toast"),

    // Startseite
    leitstelleFunk: document.getElementById("leitstelle-funk"),
    dienstError: document.getElementById("dienst-error"),
    dienstZaehler: document.getElementById("dienst-zaehler"),
    dienstListe: document.getElementById("dienst-liste"),
    infoAnsicht: document.getElementById("info-ansicht"),
    infoText: document.getElementById("info-text"),
    infoLeer: document.getElementById("info-leer"),
    infoMeta: document.getElementById("info-meta"),
    infoForm: document.getElementById("info-form"),
    infoEingabe: document.getElementById("info-eingabe"),
    infoError: document.getElementById("info-error"),
    btnInfoBearbeiten: document.getElementById("btn-info-bearbeiten"),
    btnInfoSpeichern: document.getElementById("btn-info-speichern"),
    btnInfoAbbrechen: document.getElementById("btn-info-abbrechen"),

    // Patientenakten
    patientenSearch: document.getElementById("patienten-search"),
    patientenListe: document.getElementById("patienten-liste"),
    patientenEmpty: document.getElementById("patienten-empty"),
    patientenNoResults: document.getElementById("patienten-no-results"),
    btnPatientAnlegen: document.getElementById("btn-patient-anlegen"),

    patientAnlegenName: document.getElementById("patient-anlegen-name"),
    patientAnlegenError: document.getElementById("patient-anlegen-error"),
    btnConfirmPatientAnlegen: document.getElementById("btn-confirm-patient-anlegen"),

    // Patient-Detail: eigene Ansicht statt Modal (siehe view-patient-detail
    // in index.html und oeffnePatientSeite in js/views/patientenakten.js).
    patientDetailId: document.getElementById("patient-detail-id"),
    patientDetailName: document.getElementById("patient-detail-name"),
    patientGeburtsdatum: document.getElementById("patient-geburtsdatum"),
    patientTelefonnummer: document.getElementById("patient-telefonnummer"),
    patientAllergien: document.getElementById("patient-allergien"),
    patientVorerkrankungen: document.getElementById("patient-vorerkrankungen"),
    patientBesondereHinweise: document.getElementById("patient-besondere-hinweise"),
    patientNotfallkontakt: document.getElementById("patient-notfallkontakt"),
    patientNotfallkontaktTelefon: document.getElementById("patient-notfallkontakt-telefon"),
    patientProfilMeta: document.getElementById("patient-profil-meta"),
    patientProfilError: document.getElementById("patient-profil-error"),
    btnConfirmPatientProfil: document.getElementById("btn-confirm-patient-profil"),
    patientAktenListe: document.getElementById("patient-akten-liste"),
    patientAktenLeer: document.getElementById("patient-akten-leer"),
    patientAktenAnzahl: document.getElementById("patient-akten-anzahl"),
    btnPatientLoeschen: document.getElementById("btn-patient-loeschen"),
    viewPatientDetail: document.getElementById("view-patient-detail"),
    patientKopfName: document.getElementById("patient-kopf-name"),
    patientKopfDaten: document.getElementById("patient-kopf-daten"),
    patientHinweise: document.getElementById("patient-hinweise"),
    patientEdit: document.getElementById("patient-edit"),
    btnPatientBearbeiten: document.getElementById("btn-patient-bearbeiten"),
    btnPatientAbbrechen: document.getElementById("btn-patient-abbrechen"),
    patientAktenSuche: document.getElementById("patient-akten-suche"),
    btnAkteErste: document.getElementById("btn-akte-erste"),
    btnAkteNeu: document.getElementById("btn-akte-neu"),

    akteFormTitel: document.getElementById("akte-form-titel"),
    akteEditingId: document.getElementById("akte-editing-id"),
    akteFormPatientId: document.getElementById("akte-form-patient-id"),
    akteFormPatientName: document.getElementById("akte-form-patient-name"),
    akteFormPatientGeb: document.getElementById("akte-form-patient-geb"),
    akteFormHinweise: document.getElementById("akte-form-hinweise"),
    akteDatum: document.getElementById("akte-datum"),
    akteBehandlungsgrund: document.getElementById("akte-behandlungsgrund"),
    akteTitelZaehler: document.getElementById("akte-titel-zaehler"),
    akteBefund: document.getElementById("akte-befund"),
    akteBehandlung: document.getElementById("akte-behandlung"),
    akteBemerkungen: document.getElementById("akte-bemerkungen"),
    akteError: document.getElementById("akte-error"),
    btnConfirmAkte: document.getElementById("btn-confirm-akte"),

    akteHergang: document.getElementById("akte-hergang"),

    akteDetailKicker: document.getElementById("akte-detail-kicker"),
    akteDetailTitel: document.getElementById("akte-detail-titel"),
    akteDetailInhalt: document.getElementById("akte-detail-inhalt"),
    akteDetailSeite: document.getElementById("akte-detail-seite"),
    btnAkteBearbeiten: document.getElementById("btn-akte-bearbeiten"),
    btnAkteKopieren: document.getElementById("btn-akte-kopieren"),
    btnAktePdf: document.getElementById("btn-akte-pdf"),
    btnAkteLink: document.getElementById("btn-akte-link"),

    // Zugriffslink-Dialog (siehe js/views/akte-link.js)
    akteLinkTitel: document.getElementById("akte-link-titel"),
    akteLinkTage: document.getElementById("akte-link-tage"),
    akteLinkLeer: document.getElementById("akte-link-leer"),
    akteLinkAktiv: document.getElementById("akte-link-aktiv"),
    akteLinkFeld: document.getElementById("akte-link-feld"),
    akteLinkInfo: document.getElementById("akte-link-info"),
    akteLinkError: document.getElementById("akte-link-error"),
    btnAkteLinkErstellen: document.getElementById("btn-akte-link-erstellen"),
    btnAkteLinkKopieren: document.getElementById("btn-akte-link-kopieren"),
    btnAkteLinkAktualisieren: document.getElementById("btn-akte-link-aktualisieren"),
    btnAkteLinkLoeschen: document.getElementById("btn-akte-link-loeschen"),

    patientAnlegenAehnlich: document.getElementById("patient-anlegen-aehnlich"),
    patientAnwesend: document.getElementById("patient-anwesend"),
    patientAnwesendText: document.getElementById("patient-anwesend-text"),
    patientKonflikt: document.getElementById("patient-konflikt"),
    patientKonfliktText: document.getElementById("patient-konflikt-text"),
    btnPatientKonfliktLaden: document.getElementById("btn-patient-konflikt-laden"),
    akteAnwesend: document.getElementById("akte-anwesend"),
    akteAnwesendText: document.getElementById("akte-anwesend-text"),
    akteKonflikt: document.getElementById("akte-konflikt"),
    akteKonfliktText: document.getElementById("akte-konflikt-text"),
    btnAkteKonfliktLaden: document.getElementById("btn-akte-konflikt-laden"),
    btnAkteLoeschen: document.getElementById("btn-akte-loeschen"),

    // Gutachten (siehe js/views/gutachten.js)
    ptabZaehlerAkten: document.getElementById("ptab-zaehler-akten"),
    ptabZaehlerGutachten: document.getElementById("ptab-zaehler-gutachten"),
    ptabAkten: document.getElementById("ptab-akten"),
    ptabGutachten: document.getElementById("ptab-gutachten"),
    patientGutachtenListe: document.getElementById("patient-gutachten-liste"),
    patientGutachtenLeer: document.getElementById("patient-gutachten-leer"),
    btnGutachtenNeu: document.getElementById("btn-gutachten-neu"),
    btnGutachtenErste: document.getElementById("btn-gutachten-erste"),
    gutachtenFormTitel: document.getElementById("gutachten-form-titel"),
    gutachtenOptionen: document.getElementById("gutachten-optionen"),
    gutachtenBegruendungFeld: document.getElementById("gutachten-begruendung-feld"),
    gutachtenBegruendung: document.getElementById("gutachten-begruendung"),
    gutachtenNotizen: document.getElementById("gutachten-notizen"),
    gutachtenName: document.getElementById("gutachten-name"),
    gutachtenGeburtsdatum: document.getElementById("gutachten-geburtsdatum"),
    gutachtenTelefon: document.getElementById("gutachten-telefon"),
    gutachtenDatum: document.getElementById("gutachten-datum"),
    gutachtenAussteller: document.getElementById("gutachten-aussteller"),
    gutachtenError: document.getElementById("gutachten-error"),
    btnConfirmGutachten: document.getElementById("btn-confirm-gutachten"),
    gutachtenDetailKicker: document.getElementById("gutachten-detail-kicker"),
    gutachtenDetailTitel: document.getElementById("gutachten-detail-titel"),
    gutachtenDetailInhalt: document.getElementById("gutachten-detail-inhalt"),
    gutachtenDetailSeite: document.getElementById("gutachten-detail-seite"),
    btnGutachtenBearbeiten: document.getElementById("btn-gutachten-bearbeiten"),
    btnGutachtenKopieren: document.getElementById("btn-gutachten-kopieren"),
    btnGutachtenLoeschen: document.getElementById("btn-gutachten-loeschen"),

    // Termine (siehe js/views/termine.js)
    termineFilter: document.getElementById("termine-filter"),
    termineListe: document.getElementById("termine-liste"),
    termineEmpty: document.getElementById("termine-empty"),
    btnTerminNeu: document.getElementById("btn-termin-neu"),

    // Mitarbeiterliste (siehe js/views/mitarbeiterliste.js)
    maAktionen: document.getElementById("ma-aktionen"),
    btnMaBearbeiten: document.getElementById("btn-ma-bearbeiten"),
    btnMaZeile: document.getElementById("btn-ma-zeile"),
    btnMaAbbrechen: document.getElementById("btn-ma-abbrechen"),
    btnMaSpeichern: document.getElementById("btn-ma-speichern"),
    maKonflikt: document.getElementById("ma-konflikt"),
    maKonfliktText: document.getElementById("ma-konflikt-text"),
    btnMaKonfliktLaden: document.getElementById("btn-ma-konflikt-laden"),
    maTabelle: document.getElementById("ma-tabelle"),
    maBody: document.getElementById("ma-body"),
    maError: document.getElementById("ma-error"),
    maFuss: document.getElementById("ma-fuss"),

    terminModalTitel: document.getElementById("termin-modal-titel"),
    terminEditingId: document.getElementById("termin-editing-id"),
    terminPatientInput: document.getElementById("termin-patient-input"),
    terminPatientVorschlaege: document.getElementById("termin-patient-vorschlaege"),
    terminPatientHinweis: document.getElementById("termin-patient-hinweis"),
    terminDatum: document.getElementById("termin-datum"),
    terminArtSelect: document.getElementById("termin-art-select"),
    terminArtFreiFeld: document.getElementById("termin-art-frei-feld"),
    terminArtFrei: document.getElementById("termin-art-frei"),
    terminGrund: document.getElementById("termin-grund"),
    terminNotiz: document.getElementById("termin-notiz"),
    terminStatusFeld: document.getElementById("termin-status-feld"),
    terminStatusSelect: document.getElementById("termin-status-select"),
    terminError: document.getElementById("termin-error"),
    btnConfirmTermin: document.getElementById("btn-confirm-termin"),
    btnTerminLoeschen: document.getElementById("btn-termin-loeschen"),

    // Beispiele (Behandlungsleitfäden)
    beispieleKrumen: document.getElementById("beispiele-krumen"),
    beispieleListe: document.getElementById("beispiele-liste"),
    beispieleEmpty: document.getElementById("beispiele-empty"),
    btnBeispielHinzufuegen: document.getElementById("btn-beispiel-hinzufuegen"),
    btnBeispielKategorieHinzufuegen: document.getElementById("btn-beispiel-kategorie-hinzufuegen"),
    beispielKategorieSelect: document.getElementById("beispiel-kategorie-select"),
    beispielKategorieModalTitel: document.getElementById("beispiel-kategorie-modal-titel"),
    beispielKategorieEditingId: document.getElementById("beispiel-kategorie-editing-id"),
    beispielKategorieTitelInput: document.getElementById("beispiel-kategorie-titel-input"),
    beispielKategorieError: document.getElementById("beispiel-kategorie-error"),
    btnConfirmBeispielKategorie: document.getElementById("btn-confirm-beispiel-kategorie"),
    beispielBearbeitenTitel: document.getElementById("beispiel-bearbeiten-titel"),
    beispielEditingId: document.getElementById("beispiel-editing-id"),
    beispielTitelInput: document.getElementById("beispiel-titel-input"),
    beispielTextInput: document.getElementById("beispiel-text-input"),
    beispielError: document.getElementById("beispiel-error"),
    btnConfirmBeispiel: document.getElementById("btn-confirm-beispiel"),

    // Einstellungen
    startseiteSelect: document.getElementById("startseite-select"),
    themaSelect: document.getElementById("thema-select"),

    // Verwaltung — Übersicht
    adminKpiInsgesamt: document.getElementById("admin-kpi-insgesamt"),
    adminKpiAktiv: document.getElementById("admin-kpi-aktiv"),
    adminKpiGesperrt: document.getElementById("admin-kpi-gesperrt"),
    adminKpiAntraege: document.getElementById("admin-kpi-antraege"),
    adminKpiAdmins: document.getElementById("admin-kpi-admins"),
    adminKpiLeitung: document.getElementById("admin-kpi-leitung"),
    adminUebersichtAktivitaeten: document.getElementById("admin-uebersicht-aktivitaeten"),

    // Verwaltung — Benutzer
    formAddBenutzer: document.getElementById("form-add-benutzer"),
    neuerBenutzerNameInput: document.getElementById("neuer-benutzer-name-input"),
    neuerBenutzerEmailInput: document.getElementById("neuer-benutzer-email-input"),
    neuerBenutzerRolleInput: document.getElementById("neuer-benutzer-rolle-input"),
    benutzerverwaltungSearchInput: document.getElementById("benutzerverwaltung-search-input"),
    benutzerverwaltungStatusFilter: document.getElementById("benutzerverwaltung-status-filter"),
    benutzerverwaltungListe: document.getElementById("benutzerverwaltung-liste"),
    benutzerDetailsName: document.getElementById("benutzer-details-name"),
    benutzerDetailsBody: document.getElementById("benutzer-details-body"),

    // Verwaltung — Ränge & Rollen
    adminRaengeListe: document.getElementById("admin-raenge-liste"),
    btnRangAnlegen: document.getElementById("btn-rang-anlegen"),
    rangFormTitel: document.getElementById("rang-form-titel"),
    rangEditingId: document.getElementById("rang-editing-id"),
    rangNameInput: document.getElementById("rang-name-input"),
    rangKurznameInput: document.getElementById("rang-kurzname-input"),
    rangBeschreibungInput: document.getElementById("rang-beschreibung-input"),
    rangFarbeSelect: document.getElementById("rang-farbe-select"),
    rangPositionInput: document.getElementById("rang-position-input"),
    rangAkzentringCheckbox: document.getElementById("rang-akzentring-checkbox"),
    rangAktivCheckbox: document.getElementById("rang-aktiv-checkbox"),
    rangFormError: document.getElementById("rang-form-error"),
    btnConfirmRang: document.getElementById("btn-confirm-rang"),

    // Verwaltung — System
    adminSystemVersion: document.getElementById("admin-system-version"),

    // Verwaltung — Aktivitätslog
    adminLogSucheInput: document.getElementById("admin-log-suche"),
    adminLogAktionFilter: document.getElementById("admin-log-aktion-filter"),
    adminLogZeitraumFilter: document.getElementById("admin-log-zeitraum-filter"),
    adminLogListe: document.getElementById("admin-log-liste"),
    adminLogLeer: document.getElementById("admin-log-leer"),

    // Modals allgemein
    deleteTitle: document.getElementById("delete-title"),
    deleteText: document.getElementById("delete-text"),
    btnConfirmDelete: document.getElementById("btn-confirm-delete"),

    updateBanner: document.getElementById("update-banner"),
    updateBannerBtn: document.getElementById("update-banner-btn"),
  };

  /* ------------------------------------------------------------------------
     3b. Generisches Custom-Dropdown für alle <select>-Felder
     ------------------------------------------------------------------------
     Verwandelt ein ganz normales <select class="field-input"> automatisch in
     dieselbe dunkle/goldene Dropdown-Optik, die für die Produktauswahl im
     Bestellungs-Fenster bereits gebaut wurde (.custom-select) - damit
     NIRGENDWO auf der Seite mehr das helle Standard-Dropdown des Browsers
     auftaucht. Das ursprüngliche <select> bleibt unsichtbar als einzige
     "Wahrheitsquelle" bestehen (Wert, Optionen, bestehende change-Listener
     funktionieren unverändert weiter) - es wird nur visuell durch einen
     Button + eine aufklappbare Liste ersetzt. Ein MutationObserver hält die
     sichtbare Liste automatisch synchron, wenn eine Funktion die Optionen
     des <select> später per innerHTML neu befüllt. */
  const customSelectRegistry = new Map();

  function aktualisiereCustomSelect(select) {
    const eintrag = select && customSelectRegistry.get(select);
    if (eintrag) eintrag.sync();
  }

  function erzeugeCustomSelect(select) {
    if (!select || select.dataset.customSelectInit || !select.parentNode) return;
    select.dataset.customSelectInit = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select__trigger";

    const label = document.createElement("span");
    const chevron = document.createElement("span");
    chevron.className = "custom-select__chevron";
    chevron.textContent = "⌄";
    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const panel = document.createElement("div");
    panel.className = "custom-select__panel";
    panel.hidden = true;

    // Manche <select>-Felder haben ein Inline-style für ihre Breite im
    // Layout - dieses muss auf den neuen, sichtbaren Wrapper übertragen
    // werden, sonst würde der Wrapper (der jetzt statt des <select> die
    // Breite im Layout bestimmt) einfach die volle Breite einnehmen und das
    // Formular verrutschen lassen.
    const inlineStyle = select.getAttribute("style");
    if (inlineStyle) wrapper.setAttribute("style", inlineStyle);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    wrapper.appendChild(select);
    select.classList.add("visually-hidden");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("aria-hidden", "true");
    document.body.appendChild(panel);

    function sync() {
      const deaktiviert = !!select.disabled;
      trigger.disabled = deaktiviert;
      trigger.classList.toggle("custom-select__trigger--disabled", deaktiviert);
      const gewaehlt = select.options[select.selectedIndex];
      label.textContent = gewaehlt ? gewaehlt.textContent : select.options.length ? "Bitte wählen" : "Keine Optionen vorhanden";
      panel.innerHTML = select.options.length
        ? Array.from(select.options)
            .map(
              (option, index) =>
                `<button type="button" class="custom-select__option ${
                  index === select.selectedIndex ? "custom-select__option--aktiv" : ""
                }" data-index="${index}">${escapeHtml(option.textContent)}</button>`
            )
            .join("")
        : `<div class="custom-select__leer">Keine Optionen vorhanden</div>`;
    }

    function positioniere() {
      const rect = trigger.getBoundingClientRect();
      const maxPanelHoehe = 280;
      const platzUnten = window.innerHeight - rect.bottom;
      const nachObenOeffnen = platzUnten < maxPanelHoehe + 12 && rect.top > platzUnten;
      panel.style.left = `${rect.left}px`;
      panel.style.width = `${rect.width}px`;
      if (nachObenOeffnen) {
        panel.style.top = "auto";
        panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      } else {
        panel.style.bottom = "auto";
        panel.style.top = `${rect.bottom + 6}px`;
      }
    }

    function oeffnen() {
      if (select.disabled || !select.options.length) return;
      sync();
      positioniere();
      panel.hidden = false;
      trigger.classList.add("custom-select__trigger--offen");
    }

    function schliessen() {
      panel.hidden = true;
      trigger.classList.remove("custom-select__trigger--offen");
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (panel.hidden) oeffnen();
      else schliessen();
    });

    panel.addEventListener("click", (event) => {
      const option = event.target.closest("[data-index]");
      if (!option) return;
      const index = parseInt(option.getAttribute("data-index"), 10);
      if (select.selectedIndex !== index) {
        select.selectedIndex = index;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      schliessen();
    });

    document.addEventListener("click", (event) => {
      if (panel.hidden) return;
      if (!wrapper.contains(event.target) && !panel.contains(event.target)) schliessen();
    });
    window.addEventListener("resize", schliessen);
    document.addEventListener(
      "scroll",
      (event) => {
        if (panel.hidden) return;
        if (event.target && panel.contains(event.target)) return;
        schliessen();
      },
      true
    );

    // Fängt Fälle ab, in denen eine Funktion die Optionsliste des <select>
    // per innerHTML neu aufbaut - die sichtbare Liste bleibt dadurch
    // automatisch aktuell, auch ohne dass jede Stelle im Code extra Bescheid
    // geben muss.
    new MutationObserver(sync).observe(select, { childList: true });
    select.addEventListener("change", sync);

    sync();
    customSelectRegistry.set(select, { sync, schliessen });
  }

  // Alle "normalen" <select>-Felder, die schon im HTML stehen, auf das dunkle
  // Custom-Dropdown umstellen. Bewusst erst NACH dem Laden aller Skripte
  // (DOMContentLoaded feuert nach dem letzten defer-Skript): erzeugeCustomSelect
  // nutzt escapeHtml aus js/core/utils.js, das erst NACH dieser Datei geladen
  // wird - direkt hier aufgerufen bricht es ab (ReferenceError) und die Felder
  // bleiben als helle Browser-Auswahl stehen. Jedes Feld einzeln abgesichert,
  // damit ein Fehler nicht die übrigen mitnimmt.
  function wandleAuswahlfelderUm() {
    [
      el.startseiteSelect,
      el.themaSelect,
      el.neuerBenutzerRolleInput,
      el.beispielKategorieSelect,
      el.terminArtSelect,
      el.terminStatusSelect,
      el.personalakteRangSelect,
      el.adminLogAktionFilter,
      el.adminLogZeitraumFilter,
      el.rangFarbeSelect,
    ].forEach((select) => {
      try {
        erzeugeCustomSelect(select);
      } catch (fehler) {
        console.error("Auswahlfeld konnte nicht umgestellt werden:", select && select.id, fehler);
      }
    });
  }
  document.addEventListener("DOMContentLoaded", wandleAuswahlfelderUm);
