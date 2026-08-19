-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kitsPerLot" INTEGER NOT NULL DEFAULT 48,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectVariant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sourceFileName" TEXT,
    "templateName" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    CONSTRAINT "ForecastVersion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "ForecastVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ForecastVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forecastVersionId" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "lotRef" TEXT,
    "quantityKits" REAL NOT NULL,
    CONSTRAINT "ForecastLine_forecastVersionId_fkey" FOREIGN KEY ("forecastVersionId") REFERENCES "ForecastVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BOMLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qtyPerKitL2" REAL NOT NULL DEFAULT 0,
    "qtyPerKitL3" REAL NOT NULL DEFAULT 0,
    "scrapPct" REAL NOT NULL DEFAULT 0,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    "changeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BOMLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BOMLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupplierPlant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierCompanyId" TEXT NOT NULL,
    "plantName" TEXT NOT NULL,
    "country" TEXT,
    "accountCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPlant_supplierCompanyId_fkey" FOREIGN KEY ("supplierCompanyId") REFERENCES "SupplierCompany" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadTimeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierPlantId" TEXT NOT NULL,
    "manufacturingDays" INTEGER NOT NULL DEFAULT 0,
    "transitDays" INTEGER NOT NULL DEFAULT 0,
    "customsDays" INTEGER NOT NULL DEFAULT 0,
    "inspectionDays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadTimeProfile_supplierPlantId_fkey" FOREIGN KEY ("supplierPlantId") REFERENCES "SupplierPlant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalRef" TEXT NOT NULL,
    "supplierPartNo" TEXT,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "moq" INTEGER NOT NULL DEFAULT 0,
    "orderMultiple" INTEGER NOT NULL DEFAULT 1,
    "safetyStock" REAL NOT NULL DEFAULT 0,
    "criticality" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupplierMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "supplierPlantId" TEXT NOT NULL,
    "supplierPartNo" TEXT,
    "moq" INTEGER,
    "orderMultiple" INTEGER,
    "unitPrice" REAL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierMaterial_supplierPlantId_fkey" FOREIGN KEY ("supplierPlantId") REFERENCES "SupplierPlant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "transactionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryTransaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierPlantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "orderDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_supplierPlantId_fkey" FOREIGN KEY ("supplierPlantId") REFERENCES "SupplierPlant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "POLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "requiredDate" DATETIME,
    "unitPrice" REAL,
    CONSTRAINT "POLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "POLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blNumber" TEXT,
    "purchaseOrderId" TEXT,
    "mode" TEXT,
    "shippingLine" TEXT,
    "pol" TEXT,
    "pod" TEXT,
    "ets" DATETIME,
    "eta" DATETIME,
    "customsStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "deliveredDate" DATETIME,
    "confidence" TEXT NOT NULL DEFAULT 'UNCONFIRMED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shipment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "poLineId" TEXT,
    "materialId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShipmentLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "POLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShipmentLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannedOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "supplierPlantId" TEXT NOT NULL,
    "needDate" DATETIME NOT NULL,
    "orderByDate" DATETIME NOT NULL,
    "grossRequirement" REAL NOT NULL,
    "netRequirement" REAL NOT NULL,
    "recommendedQty" REAL NOT NULL,
    "finalQty" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "calcTraceJson" TEXT NOT NULL,
    "overrideQty" REAL,
    "overrideReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannedOrder_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlannedOrder_supplierPlantId_fkey" FOREIGN KEY ("supplierPlantId") REFERENCES "SupplierPlant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlannedOrder_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "materialId" TEXT,
    "plannedOrderId" TEXT,
    "whatHappened" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "dueDate" DATETIME,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Exception_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exception_plannedOrderId_fkey" FOREIGN KEY ("plannedOrderId") REFERENCES "PlannedOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "userId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_accountId_name_key" ON "Project"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVariant_projectId_code_key" ON "ProjectVariant"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastVersion_projectId_versionNumber_key" ON "ForecastVersion"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_periodStart_idx" ON "ForecastLine"("forecastVersionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "BOMLine_projectId_materialId_effectiveFrom_key" ON "BOMLine"("projectId", "materialId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCompany_name_key" ON "SupplierCompany"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPlant_supplierCompanyId_plantName_key" ON "SupplierPlant"("supplierCompanyId", "plantName");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTimeProfile_supplierPlantId_key" ON "LeadTimeProfile"("supplierPlantId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_internalRef_key" ON "Material"("internalRef");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMaterial_materialId_supplierPlantId_key" ON "SupplierMaterial"("materialId", "supplierPlantId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_materialId_transactionDate_idx" ON "InventoryTransaction"("materialId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
