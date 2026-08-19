/**
 * One-time, reviewed migration of the four source Excel files into the
 * normalized schema. This mirrors "Phase 1" of the blueprint: source data
 * is read, mapped against explicit lookup tables (not guessed at runtime),
 * and written once. It is NOT the live forecast-ingestion pipeline (that
 * pipeline is the /forecast/upload API + UI, which stages and requires
 * planner confirmation before writing ForecastLine rows).
 */
import ExcelJS from "exceljs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

// Demo credentials — every seeded user shares this password so the
// README can hand out one login line. Real deployments replace this
// with proper account provisioning; nothing about the auth flow itself
// depends on shared passwords.
const DEMO_PASSWORD = "mobica-demo";

// ---------------------------------------------------------------------
// Explicit Supplier Plant registry.
//
// The source files spell the same plant multiple ways ("Adient Kinetra"
// vs "Adient Keintra, Morocco: 21004640" vs the Materials workbook's own
// sheet name "Adient Kinetra"). Rather than fuzzy-matching free text at
// import time -- which is exactly the "duplicate master record" trap the
// blueprint calls out -- every known spelling is enumerated once here and
// resolved through `resolveSupplierPlant()`.
// ---------------------------------------------------------------------
type PlantDef = {
  key: string; // canonical key used elsewhere in this script
  company: string;
  plantName: string;
  country: string;
  accountCode?: string;
  aliases: string[]; // raw strings seen across the source files
};

const PLANTS: PlantDef[] = [
  {
    key: "adient_zaragoza",
    company: "Adient",
    plantName: "Adient Zaragoza",
    country: "Spain",
    accountCode: "21004595",
    aliases: [
      "Adient Zaragoza, Spain:21004595",
      "Adient Zaragoza, Spain: 21004595",
      "Adient Zaragoza",
      "Adient Seating Spain",
    ],
  },
  {
    key: "adient_kinetra",
    company: "Adient",
    plantName: "Adient Kinetra",
    country: "Morocco",
    accountCode: "21004640",
    aliases: [
      "Adient Keintra, Morocco: 21004640",
      "Adient Keintra, Morocco:21004640",
      "Adient Kinetra",
    ],
  },
  {
    key: "tesca_spain",
    company: "Tesca",
    plantName: "Tesca Spain Barcelona",
    country: "Spain",
    accountCode: "21004605",
    aliases: [
      "Tesca Spain Barcelona, Spain: 21004605",
      "Tesca Spain Barcelona, Spain:21004605",
      "Tesca Spain",
    ],
  },
  {
    key: "tesca_morocco",
    company: "Tesca",
    plantName: "Tesca Morocco",
    country: "Morocco",
    accountCode: "21004835",
    aliases: ["Tesca Morocco:21004835", "Tesca Morocco"],
  },
  {
    key: "sage_italy",
    company: "Sage",
    plantName: "Apollo (Sage Italy plant)",
    country: "Italy",
    accountCode: "21004626",
    aliases: [
      "Apollo (Sage italy plant):21004626",
      "Apollo (Sage italy plant): 21004626",
      "Sage Italy",
    ],
  },
  {
    key: "sage_kenitra",
    company: "Sage",
    plantName: "Sage Kenitra",
    country: "Morocco",
    accountCode: "21004625",
    aliases: [
      "Sage Kenitra, Morocco:21004625",
      "Sage Kenitra, Morocco: 21004625",
      "Sage Kintra",
    ],
  },
];

function resolveSupplierPlant(raw: string | undefined | null): PlantDef | undefined {
  if (!raw) return undefined;
  const norm = raw.trim().toLowerCase();
  return PLANTS.find((p) => p.aliases.some((a) => norm.includes(a.toLowerCase()) || a.toLowerCase().includes(norm)));
}

async function loadWorkbook(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DATA_DIR, file));
  return wb;
}

function cellStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object" && v !== null && "text" in (v as any)) return String((v as any).text).trim();
  const s = String(v).trim();
  return s.length ? s : undefined;
}
function cellNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  console.log("Seeding SCM Control Tower from source Excel files…");

  // Wipe (dev only) so the seed is idempotent.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.exception.deleteMany(),
    prisma.plannedOrder.deleteMany(),
    prisma.shipmentLine.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.pOLine.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.inventoryTransaction.deleteMany(),
    prisma.supplierMaterial.deleteMany(),
    prisma.bOMLine.deleteMany(),
    prisma.forecastLine.deleteMany(),
    prisma.forecastVersion.deleteMany(),
    prisma.projectVariant.deleteMany(),
    prisma.project.deleteMany(),
    prisma.account.deleteMany(),
    prisma.material.deleteMany(),
    prisma.leadTimeProfile.deleteMany(),
    prisma.supplierPlant.deleteMany(),
    prisma.supplierCompany.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // -------------------------------------------------------------
  // Users
  // -------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const planner = await prisma.user.create({
    data: { name: "Supply Chain Specialist", email: "planner@mobica.demo", role: "PLANNER", passwordHash },
  });
  await prisma.user.createMany({
    data: [
      { name: "Buyer", email: "buyer@mobica.demo", role: "BUYER", passwordHash },
      { name: "SCM Manager", email: "manager@mobica.demo", role: "MANAGER", passwordHash },
      { name: "Warehouse", email: "warehouse@mobica.demo", role: "WAREHOUSE", passwordHash },
    ],
  });

  // -------------------------------------------------------------
  // Accounts (Automotive Accounts sheet)
  // -------------------------------------------------------------
  const acctWb = await loadWorkbook("accounts_suppliers.xlsx");
  const acctSheet = acctWb.getWorksheet("Automotive Accounts")!;
  const accountNames: string[] = [];
  acctSheet.eachRow((row, i) => {
    if (i === 1) return;
    const v = cellStr(row.getCell(1).value);
    if (v) accountNames.push(v);
  });
  const accountsByName = new Map<string, string>();
  for (const name of accountNames) {
    const acc = await prisma.account.create({ data: { name } });
    accountsByName.set(name, acc.id);
  }
  const citroenId = accountsByName.get("Citroen")!;

  // -------------------------------------------------------------
  // Supplier plants + lead-time profiles (Citroen's Suppliers sheet)
  // -------------------------------------------------------------
  const leadSheet = acctWb.getWorksheet("Citroen's Suppliers")!;
  const plantIds = new Map<string, string>(); // key -> SupplierPlant.id
  const companyIds = new Map<string, string>();

  for (const p of PLANTS) {
    let companyId = companyIds.get(p.company);
    if (!companyId) {
      const c = await prisma.supplierCompany.upsert({
        where: { name: p.company },
        update: {},
        create: { name: p.company },
      });
      companyId = c.id;
      companyIds.set(p.company, companyId);
    }
    const plant = await prisma.supplierPlant.create({
      data: {
        supplierCompanyId: companyId,
        plantName: p.plantName,
        country: p.country,
        accountCode: p.accountCode,
      },
    });
    plantIds.set(p.key, plant.id);
  }

  const leadRows: any[] = [];
  leadSheet.eachRow((row, i) => {
    if (i < 3) return;
    leadRows.push({
      supplierRaw: cellStr(row.getCell(2).value),
      mfg: cellNum(row.getCell(4).value) ?? 0,
      transit: cellNum(row.getCell(5).value) ?? 0,
      customs: cellNum(row.getCell(6).value) ?? 0,
      inspection: cellNum(row.getCell(7).value) ?? 0,
    });
  });
  for (const r of leadRows) {
    const plant = resolveSupplierPlant(r.supplierRaw);
    if (!plant) continue;
    await prisma.leadTimeProfile.create({
      data: {
        supplierPlantId: plantIds.get(plant.key)!,
        manufacturingDays: r.mfg,
        transitDays: r.transit,
        customsDays: r.customs,
        inspectionDays: r.inspection,
      },
    });
  }

  // -------------------------------------------------------------
  // Project + variants (Citroen / IMP C4X — the demo account/program)
  // -------------------------------------------------------------
  const project = await prisma.project.create({
    data: { accountId: citroenId, name: "IMP C4X", kitsPerLot: 48 },
  });
  await prisma.projectVariant.createMany({
    data: [
      { projectId: project.id, code: "L2", label: "Level 2" },
      { projectId: project.id, code: "L3", label: "Level 3 Optional" },
    ],
  });

  // -------------------------------------------------------------
  // Materials + BOM + MOQ from the Order sheet (Adient Zaragoza —
  // this is the richest source: real MOQ per material, and
  // per-vehicle L2 / L3 consumption already split out).
  // -------------------------------------------------------------
  const orderWb = await loadWorkbook("order_sheet.xlsx");
  const orderSheet = orderWb.getWorksheet("Order")!;
  const stockSheet = orderWb.getWorksheet("Stock")!;

  const materialIdByInternalRef = new Map<string, string>();

  const orderRows: any[] = [];
  orderSheet.eachRow((row, i) => {
    if (i < 3) return; // two header rows
    const stlPn = cellStr(row.getCell(2).value);
    if (!stlPn) return;
    orderRows.push({
      stlPn,
      supplierRaw: cellStr(row.getCell(3).value), // "Adient Zaragoza"
      adientPn: cellStr(row.getCell(4).value),
      description: cellStr(row.getCell(5).value) ?? "(no description)",
      uom: cellStr(row.getCell(6).value) ?? "EA",
      qtyL2: cellNum(row.getCell(7).value) ?? 0, // col G "L2"
      qtyL3: cellNum(row.getCell(11).value) ?? 0, // col K "L3 Opt."
      moq: cellNum(row.getCell(15).value) ?? 0, // col O "MOQ"
    });
  });

  for (const r of orderRows) {
    if (materialIdByInternalRef.has(r.stlPn)) {
      console.warn(`  ! duplicate STL PN in Order sheet, skipping: ${r.stlPn}`);
      continue;
    }
    const plant = resolveSupplierPlant(r.supplierRaw) ?? PLANTS.find((p) => p.key === "adient_zaragoza")!;
    const material = await prisma.material.create({
      data: {
        internalRef: r.stlPn,
        supplierPartNo: r.adientPn,
        descriptionEn: r.description,
        uom: r.uom,
        moq: r.moq,
        orderMultiple: r.moq > 0 ? r.moq : 1, // Order sheet applies MOQ as the reorder step itself
      },
    });
    materialIdByInternalRef.set(r.stlPn, material.id);

    await prisma.bOMLine.create({
      data: {
        projectId: project.id,
        materialId: material.id,
        qtyPerKitL2: r.qtyL2,
        qtyPerKitL3: r.qtyL3,
      },
    });

    await prisma.supplierMaterial.create({
      data: {
        materialId: material.id,
        supplierPlantId: plantIds.get(plant.key)!,
        supplierPartNo: r.adientPn,
        moq: r.moq,
        orderMultiple: r.moq > 0 ? r.moq : 1,
        isPrimary: true,
      },
    });
  }

  // Opening stock from the Stock tab
  const stockTasks: Array<() => Promise<void>> = [];
  stockSheet.eachRow((row, i) => {
    if (i < 2) return;
    const stlPn = cellStr(row.getCell(2).value);
    const qty = cellNum(row.getCell(5).value);
    if (!stlPn || qty === undefined) return;
    const materialId = materialIdByInternalRef.get(stlPn);
    if (!materialId) return;
    stockTasks.push(() =>
      prisma.inventoryTransaction
        .create({
          data: {
            materialId,
            type: "OPENING",
            quantity: qty,
            reference: "order_sheet.xlsx: Stock tab",
            note: "Opening balance migrated from source spreadsheet",
          },
        })
        .then(() => {})
    );
  });
  for (const t of stockTasks) await t();

  // -------------------------------------------------------------
  // Additional materials from Materials_Information.xlsx (other
  // supplier plants not covered by the Order sheet: Tesca, Sage,
  // Adient Kinetra). These sheets have no MOQ column, so MOQ/order
  // multiple default to 1 (documented assumption — flagged in
  // Section K of the blueprint; a buyer can correct via the UI).
  // -------------------------------------------------------------
  const matWb = await loadWorkbook("materials.xlsx");
  const otherSheets: Array<{ sheet: string; plantKey: string; pnCol: number; enCol: number; arCol: number; itemCol: number; l2Col: number; l3Col: number; totalCol: number }> = [
    { sheet: "Adient Kinetra", plantKey: "adient_kinetra", pnCol: 2, enCol: 3, arCol: 4, itemCol: 5, l2Col: 6, l3Col: 7, totalCol: 8 },
    { sheet: "Tesca Spain", plantKey: "tesca_spain", pnCol: 2, enCol: 3, arCol: 4, itemCol: 5, l2Col: 6, l3Col: 7, totalCol: 8 },
    { sheet: "Tesca Morocco ", plantKey: "tesca_morocco", pnCol: 2, enCol: 3, arCol: 4, itemCol: 5, l2Col: 6, l3Col: 7, totalCol: 8 },
    { sheet: "Sage Italy", plantKey: "sage_italy", pnCol: 2, enCol: 3, arCol: 4, itemCol: 5, l2Col: 6, l3Col: 7, totalCol: 8 },
    { sheet: "Sage Kintra", plantKey: "sage_kenitra", pnCol: 2, enCol: 3, arCol: 4, itemCol: 5, l2Col: 6, l3Col: 7, totalCol: 8 },
  ];

  for (const cfg of otherSheets) {
    const ws = matWb.getWorksheet(cfg.sheet);
    if (!ws) {
      console.warn(`  ! sheet not found: ${cfg.sheet}`);
      continue;
    }
    const rowsToImport: any[] = [];
    ws.eachRow((row, i) => {
      if (i < 3) return;
      const pn = cellStr(row.getCell(cfg.pnCol).value);
      if (!pn || materialIdByInternalRef.has(pn)) return; // avoid dup vs Order sheet
      rowsToImport.push({
        pn,
        en: cellStr(row.getCell(cfg.enCol).value) ?? "(no description)",
        ar: cellStr(row.getCell(cfg.arCol).value),
        l2: cellNum(row.getCell(cfg.l2Col).value) ?? 0,
        l3: cellNum(row.getCell(cfg.l3Col).value) ?? 0,
        total: cellNum(row.getCell(cfg.totalCol).value) ?? 0,
      });
    });
    for (const r of rowsToImport) {
      const material = await prisma.material.create({
        data: {
          internalRef: r.pn,
          descriptionEn: r.en,
          descriptionAr: r.ar,
          uom: "EA",
          moq: 0,
          orderMultiple: 1,
        },
      });
      materialIdByInternalRef.set(r.pn, material.id);
      await prisma.bOMLine.create({
        data: { projectId: project.id, materialId: material.id, qtyPerKitL2: r.l2, qtyPerKitL3: r.l3 },
      });
      await prisma.supplierMaterial.create({
        data: { materialId: material.id, supplierPlantId: plantIds.get(cfg.plantKey)!, isPrimary: true },
      });
      await prisma.inventoryTransaction.create({
        data: {
          materialId: material.id,
          type: "OPENING",
          quantity: r.total,
          reference: "materials.xlsx",
          note: "Opening balance migrated from source spreadsheet",
        },
      });
    }
  }

  // -------------------------------------------------------------
  // Forecast (Citroen IMP C4X — CW/lot grid)
  // -------------------------------------------------------------
  const fWb = await loadWorkbook("forecast.xlsx");
  const fSheet = fWb.getWorksheet("IMP Citroen")!;

  const forecastVersion = await prisma.forecastVersion.create({
    data: {
      accountId: citroenId,
      projectId: project.id,
      versionNumber: 1,
      sourceFileName: "Forecast.xlsx",
      templateName: "Citroen CW/Lot grid v1",
      uploadedById: planner.id,
      status: "CONFIRMED",
      notes: "Migrated from initial source file at platform go-live.",
    },
  });

  const lotRow = fSheet.getRow(6);
  const cwRow = fSheet.getRow(7);
  const l2Row = fSheet.getRow(8);
  const l3Row = fSheet.getRow(9);

  // Monday of the week containing 2026-01-01, used as the CW01 anchor.
  const jan1 = new Date(Date.UTC(2026, 0, 1));
  const dow = jan1.getUTCDay() || 7; // Mon=1..Sun=7
  const cw01Monday = new Date(jan1);
  cw01Monday.setUTCDate(jan1.getUTCDate() - (dow - 1));

  const forecastLines: any[] = [];
  const lastCol = fSheet.actualColumnCount;
  for (let c = 2; c <= lastCol; c++) {
    const cwLabel = cellStr(cwRow.getCell(c).value);
    if (!cwLabel || !/^CW\s*\d+/i.test(cwLabel)) continue;
    const cwNum = parseInt(cwLabel.replace(/\D/g, ""), 10);
    if (!cwNum || cwNum > 53) continue;
    const periodStart = new Date(cw01Monday);
    periodStart.setUTCDate(cw01Monday.getUTCDate() + (cwNum - 1) * 7);
    const lotRef = cellStr(lotRow.getCell(c).value);
    const qtyL2 = cellNum(l2Row.getCell(c).value) ?? 0;
    const qtyL3 = cellNum(l3Row.getCell(c).value) ?? 0;

    if (qtyL2 > 0) {
      forecastLines.push({
        forecastVersionId: forecastVersion.id,
        variantCode: "L2",
        periodStart,
        periodLabel: cwLabel.replace(/\s+/g, " ").trim(),
        lotRef,
        quantityKits: qtyL2,
      });
    }
    if (qtyL3 > 0) {
      forecastLines.push({
        forecastVersionId: forecastVersion.id,
        variantCode: "L3",
        periodStart,
        periodLabel: cwLabel.replace(/\s+/g, " ").trim(),
        lotRef,
        quantityKits: qtyL3,
      });
    }
  }
  if (forecastLines.length) {
    await prisma.forecastLine.createMany({ data: forecastLines });
  }

  console.log(`Done. Materials: ${materialIdByInternalRef.size}, Forecast lines: ${forecastLines.length}, Supplier plants: ${plantIds.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
