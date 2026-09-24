"use strict";

  /* ------------------------------------------------------------------------
     18. Einstellungen (Standard-Startseite)
     ------------------------------------------------------------------------ */
  const STARTSEITE_KEY = "mdApp.startseite";

  if (el.startseiteSelect) {
    el.startseiteSelect.addEventListener("change", () => {
      localStorage.setItem(STARTSEITE_KEY, el.startseiteSelect.value);
      zeigeToast("Standard-Startseite gespeichert.");
    });
  }

  // Darstellung: dunkel (Standard) oder hell. Das Attribut sitzt nur, solange
  // jemand angemeldet ist - der Login-Bildschirm bleibt immer dunkel (siehe
  // starteApp/stoppeApp in js/main.js). Farben: css/base/tokens.css.
  const THEMA_KEY = "mdApp.thema";

  function gespeichertesThema() {
    try {
      return localStorage.getItem(THEMA_KEY) === "hell" ? "hell" : "dunkel";
    } catch (fehler) {
      return "dunkel";
    }
  }

  function wendeThemaAn(thema) {
    if (thema === "hell") document.documentElement.setAttribute("data-theme", "hell");
    else document.documentElement.removeAttribute("data-theme");
  }

  function ladeThema() {
    const thema = gespeichertesThema();
    wendeThemaAn(thema);
    if (el.themaSelect) {
      el.themaSelect.value = thema;
      aktualisiereCustomSelect(el.themaSelect);
    }
  }

  if (el.themaSelect) {
    el.themaSelect.addEventListener("change", () => {
      const thema = el.themaSelect.value === "hell" ? "hell" : "dunkel";
      try {
        localStorage.setItem(THEMA_KEY, thema);
      } catch (fehler) {
        /* Speichern nicht möglich - gilt dann nur für diese Sitzung */
      }
      wendeThemaAn(thema);
    });
  }

  function ladeStartseite() {
    const gespeichert = localStorage.getItem(STARTSEITE_KEY);
    if (el.startseiteSelect && gespeichert) {
      el.startseiteSelect.value = gespeichert;
      aktualisiereCustomSelect(el.startseiteSelect);
    }
    return gespeichert && VIEW_META[gespeichert] ? gespeichert : "startseite";
  }
