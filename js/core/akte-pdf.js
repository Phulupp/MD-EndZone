"use strict";

  /* ------------------------------------------------------------------------
     Akte als PDF
     ------------------------------------------------------------------------
     Erzeugt die Datei direkt im Browser mit jsPDF (kleine Bibliothek, per
     <script> von cdnjs eingebunden - siehe index.html und akte.html). Kein
     Server nötig. Nutzt die Standardschrift Helvetica: deutsche Umlaute
     funktionieren, exotische Zeichen (Emoji, kyrillisch ...) werden durch "?"
     ersetzt statt kaputt dargestellt zu werden.
     Erwartet dasselbe Datenobjekt "d" wie js/core/akte-dokument.js. */
  function pdfSicher(text) {
    const erlaubtSonder = [0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x20ac];
    let aus = "";
    for (const zeichen of String(text == null ? "" : text).replace(/\r/g, "")) {
      const c = zeichen.codePointAt(0);
      const ok = c === 10 || c === 9 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || erlaubtSonder.includes(c);
      aus += ok ? zeichen : "?";
    }
    return aus;
  }

  function aktePdfDateiname(d) {
    const name = `Akte ${d.nummer} - ${d.patientName || "Patient"}`.replace(/[\\/:*?"<>|]+/g, "").trim();
    return `${name}.pdf`;
  }

  // Wirft einen Fehler, wenn jsPDF nicht geladen werden konnte (z. B. offline).
  function speichereAktePdf(d) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF ist nicht geladen.");
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const seiteB = 210;
    const seiteH = 297;
    const rand = 22;
    const unten = 24;
    const breite = seiteB - 2 * rand;
    const PT = 0.3528; // 1 pt in mm
    const SCHWARZ = [25, 30, 35];
    const GRAU = [105, 115, 125];
    const ROT = [190, 50, 65];
    let y = rand;

    const seiteVoll = (hoehe) => {
      if (y + hoehe > seiteH - unten) {
        doc.addPage();
        y = rand;
      }
    };

    // Schreibt umgebrochenen Text ab der aktuellen Position, Seitenwechsel
    // inklusive. "x" erlaubt eingerückten Text (z. B. neben einer Beschriftung).
    const schreibe = (text, groesse, stil, farbe, abstandNach, x, maxBreite) => {
      doc.setFont("helvetica", stil);
      doc.setFontSize(groesse);
      doc.setTextColor(...farbe);
      const zeilenHoehe = groesse * PT * 1.5;
      doc.splitTextToSize(pdfSicher(text), maxBreite || breite).forEach((zeile) => {
        seiteVoll(zeilenHoehe);
        doc.text(zeile, x || rand, y + groesse * PT);
        y += zeilenHoehe;
      });
      y += abstandNach || 0;
    };

    // Kopf
    schreibe("MEDICAL DEPARTMENT", 8.5, "bold", GRAU, 1);
    schreibe(`BEHANDLUNGSAKTE  ·  AKTE ${d.nummer}`, 9.5, "bold", ROT, 3);
    schreibe(d.behandlungsgrund || "Behandlungsakte", 20, "bold", SCHWARZ, 5);

    doc.setDrawColor(200, 205, 210);
    doc.setLineWidth(0.3);
    doc.line(rand, y, seiteB - rand, y);
    y += 6;

    // Eckdaten: Beschriftung links, Wert rechts daneben
    const meta = [
      ["Patient", d.patientName],
      ["Geburtsdatum", d.geburtsdatum],
      ["Datum", d.datum],
      ["Vitalwerte", d.vitalwerte],
      ["Verfasst von", d.autor],
      ["Zuletzt bearbeitet", d.bearbeitetVon ? `${d.bearbeitetVon} · ${d.bearbeitetAm}` : ""],
    ].filter(([, wert]) => wert);
    const spalte = 38;
    meta.forEach(([label, wert]) => {
      const start = y;
      schreibe(label, 10, "normal", GRAU, 0, rand, spalte - 4);
      const nachLabel = y;
      y = start;
      schreibe(wert, 10.5, "bold", SCHWARZ, 1.2, rand + spalte, breite - spalte);
      y = Math.max(y, nachLabel);
    });
    y += 3;

    // Warnzeile bei Allergien / Vorerkrankungen
    [["Allergien", d.allergien], ["Vorerkrankungen", d.vorerkrankungen]]
      .filter(([, wert]) => wert)
      .forEach(([label, wert]) => {
        const start = y;
        schreibe(`${label}:`, 10.5, "bold", ROT, 0, rand, spalte - 4);
        const nachLabel = y;
        y = start;
        schreibe(wert, 10.5, "normal", SCHWARZ, 1.5, rand + spalte, breite - spalte);
        y = Math.max(y, nachLabel);
      });

    y += 3;
    doc.line(rand, y, seiteB - rand, y);
    y += 8;

    // Abschnitte
    const gefuellt = AKTE_ABSCHNITTE.filter(([, feld]) => d[feld]);
    if (!gefuellt.length) schreibe("Keine weiteren Angaben.", 11, "normal", GRAU, 0);
    gefuellt.forEach(([label, feld]) => {
      seiteVoll(20);
      schreibe(label.toUpperCase(), 8.5, "bold", GRAU, 1.5);
      schreibe(d[feld], 11, "normal", SCHWARZ, 7);
    });

    // Fußzeile auf jeder Seite
    const seiten = doc.getNumberOfPages();
    for (let i = 1; i <= seiten; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 205, 210);
      doc.line(rand, seiteH - 17, seiteB - rand, seiteH - 17);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAU);
      doc.text(pdfSicher(`Medical Department  ·  Akte ${d.nummer}  ·  ${d.patientName || ""}`), rand, seiteH - 12);
      doc.text(`Seite ${i} von ${seiten}`, seiteB - rand, seiteH - 12, { align: "right" });
    }

    doc.save(aktePdfDateiname(d));
  }
