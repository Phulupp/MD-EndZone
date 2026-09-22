"use strict";

  /* ------------------------------------------------------------------------
     Akte als Dokument - gemeinsame Darstellung
     ------------------------------------------------------------------------
     Wird vom Akte-Fenster in der App (js/views/patientenakten.js) UND von der
     öffentlichen Zugriffslink-Seite (akte.html) genutzt, damit beide exakt
     gleich aussehen. Bewusst ohne Abhängigkeiten zu anderen Dateien.

     "d" ist ein einfaches Objekt (siehe akteDaten in patientenakten.js):
     { nummer, patientName, geburtsdatum, allergien, vorerkrankungen, datum,
       autor, bearbeitetVon, bearbeitetAm, behandlungsgrund, vitalwerte,
       hergang, befund, behandlung, bemerkungen } - alle Werte fertige
       Anzeige-Texte. */
  function dokEsc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  // [Beschriftung, Feldname] in der Reihenfolge des Dokuments. Der
  // Behandlungsgrund ist die Überschrift und steht nicht in dieser Liste.
  const AKTE_ABSCHNITTE = [
    ["Hergang", "hergang"],
    ["Befund", "befund"],
    ["Behandlung", "behandlung"],
    ["Zusätzliche Informationen", "bemerkungen"],
  ];

  // Linke Hauptspalte unter der Überschrift: Warnzeile (nur wenn beim
  // Patienten etwas Relevantes steht) + die ausgefüllten Abschnitte. Leere
  // Abschnitte werden weggelassen.
  function akteInhaltHtml(d) {
    let html = "";
    const hinweise = [
      ["Allergien", d.allergien],
      ["Vorerkrankungen", d.vorerkrankungen],
    ].filter(([, wert]) => wert);
    if (hinweise.length) {
      html += `<div class="akte-hinweis">${hinweise
        .map(([label, wert]) => `<p class="akte-hinweis__zeile"><span class="akte-hinweis__label">${label}</span>${dokEsc(wert)}</p>`)
        .join("")}</div>`;
    }
    const gefuellt = AKTE_ABSCHNITTE.filter(([, feld]) => d[feld]);
    html += gefuellt.length
      ? gefuellt
          .map(
            ([label, feld]) =>
              `<section class="akte-abschnitt"><h4 class="akte-abschnitt__label">${label}</h4><p>${dokEsc(d[feld])}</p></section>`
          )
          .join("")
      : '<p class="akte-leer">Keine weiteren Angaben.</p>';
    return html;
  }

  // Rechte Spalte mit den Eckdaten.
  function akteSeiteHtml(d) {
    const zeile = (label, wert) => (wert ? `<div><dt>${label}</dt><dd>${dokEsc(wert)}</dd></div>` : "");
    return (
      zeile("Patient", d.patientName) +
      zeile("Geburtsdatum", d.geburtsdatum) +
      zeile("Datum", d.datum) +
      zeile("Vitalwerte", d.vitalwerte) +
      zeile("Verfasst von", d.autor) +
      zeile("Zuletzt bearbeitet", d.bearbeitetVon ? `${d.bearbeitetVon} · ${d.bearbeitetAm}` : "")
    );
  }

  // Reiner Text (Zwischenablage, z. B. für Discord/TeamSpeak-Chat).
  function akteAlsText(d) {
    const zeilen = [`Behandlungsakte - Akte ${d.nummer}`, d.behandlungsgrund || "", "", `Patient: ${d.patientName || "—"}`];
    if (d.geburtsdatum) zeilen.push(`Geburtsdatum: ${d.geburtsdatum}`);
    zeilen.push(`Datum: ${d.datum || "—"}`, `Verfasst von: ${d.autor || "—"}`);
    if (d.vitalwerte) zeilen.push(`Vitalwerte: ${d.vitalwerte}`);
    if (d.allergien) zeilen.push(`Allergien: ${d.allergien}`);
    if (d.vorerkrankungen) zeilen.push(`Vorerkrankungen: ${d.vorerkrankungen}`);
    zeilen.push("");
    AKTE_ABSCHNITTE.forEach(([label, feld]) => {
      if (d[feld]) zeilen.push(`${label}:`, d[feld], "");
    });
    return zeilen.join("\n").trim();
  }
