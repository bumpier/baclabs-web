-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT,
    "weight_grams" INTEGER NOT NULL DEFAULT 0,
    "length_mm" INTEGER NOT NULL DEFAULT 0,
    "width_mm" INTEGER NOT NULL DEFAULT 0,
    "height_mm" INTEGER NOT NULL DEFAULT 0,
    "hs_code" TEXT,
    "origin_country_iso" TEXT,
    "service_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SkuComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kit_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "SkuComponent_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "Sku" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkuComponent_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contact_name" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "address_line_1" TEXT NOT NULL DEFAULT '',
    "address_line_2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "country_iso" TEXT NOT NULL DEFAULT 'GB',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pick_sequence" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Location_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "StockLevel_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockLevel_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "order_id" TEXT,
    "actor" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PickLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "location_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "picked_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PickLine_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PickLine_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PickLine_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostalService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "carrier" TEXT NOT NULL DEFAULT '',
    "tracked" BOOLEAN NOT NULL DEFAULT true,
    "min_weight_grams" INTEGER NOT NULL DEFAULT 0,
    "max_weight_grams" INTEGER NOT NULL DEFAULT 0,
    "max_length_mm" INTEGER NOT NULL DEFAULT 0,
    "max_width_mm" INTEGER NOT NULL DEFAULT 0,
    "max_height_mm" INTEGER NOT NULL DEFAULT 0,
    "size_formula" TEXT NOT NULL DEFAULT '',
    "size_limit_mm" INTEGER NOT NULL DEFAULT 0,
    "volumetric_divisor" INTEGER,
    "delivery_countries" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "synced_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "service_code" TEXT NOT NULL,
    "service_name" TEXT NOT NULL DEFAULT '',
    "service_choice" TEXT NOT NULL DEFAULT 'auto',
    "weight_grams" INTEGER NOT NULL,
    "length_mm" INTEGER NOT NULL,
    "width_mm" INTEGER NOT NULL,
    "height_mm" INTEGER NOT NULL,
    "carrier_shipment_id" TEXT,
    "tracking_numbers" TEXT NOT NULL DEFAULT '[]',
    "label_pdf" TEXT,
    "error" TEXT,
    "actor" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "voided_at" DATETIME,
    CONSTRAINT "Shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Sku_code_key" ON "Sku"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_barcode_key" ON "Sku"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "SkuComponent_kit_id_component_id_key" ON "SkuComponent"("kit_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_warehouse_id_code_key" ON "Location"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_sku_id_location_id_key" ON "StockLevel"("sku_id", "location_id");

-- CreateIndex
CREATE INDEX "StockMovement_sku_id_created_at_idx" ON "StockMovement"("sku_id", "created_at");

-- CreateIndex
CREATE INDEX "StockMovement_order_id_idx" ON "StockMovement"("order_id");

-- CreateIndex
CREATE INDEX "PickLine_order_id_idx" ON "PickLine"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "PostalService_code_key" ON "PostalService"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_reference_key" ON "Shipment"("reference");

-- CreateIndex
CREATE INDEX "Shipment_order_id_idx" ON "Shipment"("order_id");

