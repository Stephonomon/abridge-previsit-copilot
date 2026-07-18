import "../env.js";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DATA_DIR } from "../data/store.js";

interface PdfPage {
  heading: string;
  lines: string[];
}
interface PdfSpec {
  file: string;
  faxHeader: string;
  title: string;
  facility: string;
  pages: PdfPage[];
}

async function generate(patientDir: string, spec: PdfSpec) {
  const doc = await PDFDocument.create();
  const courier = await doc.embedFont(StandardFonts.Courier);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);

  for (const [i, pageSpec] of spec.pages.entries()) {
    const page = doc.addPage([612, 792]); // US Letter
    let y = 750;
    const draw = (text: string, opts: { bold?: boolean; size?: number; gray?: boolean } = {}) => {
      page.drawText(text, {
        x: 48,
        y,
        size: opts.size ?? 10,
        font: opts.bold ? courierBold : courier,
        color: opts.gray ? rgb(0.4, 0.4, 0.4) : rgb(0.05, 0.05, 0.05),
      });
      y -= (opts.size ?? 10) + 5;
    };

    draw(spec.faxHeader, { gray: true, size: 8 });
    y -= 6;
    page.drawLine({ start: { x: 48, y: y + 8 }, end: { x: 564, y: y + 8 }, thickness: 0.7, color: rgb(0.6, 0.6, 0.6) });
    y -= 8;
    if (i === 0) {
      draw(spec.title, { bold: true, size: 13 });
      draw(spec.facility, { gray: true, size: 9 });
      y -= 8;
    }
    draw(pageSpec.heading, { bold: true, size: 11 });
    y -= 4;
    for (const line of pageSpec.lines) {
      if (y < 60) break;
      draw(line);
    }
    draw(`Page ${i + 1} of ${spec.pages.length}`, { gray: true, size: 8 });
  }

  const outPath = path.join(patientDir, spec.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, await doc.save());
  console.log(`  wrote ${spec.file}`);
}

async function main() {
  const patientsDir = path.join(DATA_DIR, "patients");
  for (const id of fs.readdirSync(patientsDir)) {
    const specPath = path.join(patientsDir, id, "pdf-spec.json");
    if (!fs.existsSync(specPath)) continue;
    console.log(`Generating PDFs for ${id}:`);
    const { pdfs } = JSON.parse(fs.readFileSync(specPath, "utf8")) as { pdfs: PdfSpec[] };
    for (const spec of pdfs) await generate(path.join(patientsDir, id), spec);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
