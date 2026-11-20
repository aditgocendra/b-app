-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable role_permissions
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Insert Default System Roles
INSERT INTO "roles" ("id", "key", "name", "description", "is_system", "status", "created_at", "updated_at")
VALUES
    (gen_random_uuid()::text, 'super_admin', 'Super Admin', 'Full unrestricted access across all omnichannel operations, financial data, and security governance.', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'admin', 'Admin', 'Primary operational administration for product catalog, marketplace order processing, and user accounts.', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'warehouse_admin', 'Warehouse Admin', 'Supervises multi-facility warehouse stock, inter-warehouse transfers, physical audits, and dispatch.', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'cashier', 'Cashier', 'Frontline retail point of sale counter operator, checkout receipts, and cash register shifts.', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable users: Add role_id as nullable first
ALTER TABLE "users" ADD COLUMN "role_id" TEXT;

-- Migrate Existing Users role column to role_id
UPDATE "users" 
SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = 'super_admin') 
WHERE "role"::text = 'SUPER_ADMIN';

UPDATE "users" 
SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = 'admin') 
WHERE "role"::text = 'ADMIN';

UPDATE "users" 
SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = 'warehouse_admin') 
WHERE "role"::text = 'WAREHOUSE_ADMIN';

UPDATE "users" 
SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = 'cashier') 
WHERE "role"::text = 'CASHIER' OR "role_id" IS NULL;

-- If any remaining rows without role_id, default to cashier
UPDATE "users" 
SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = 'cashier')
WHERE "role_id" IS NULL;

-- Enforce NOT NULL on users.role_id
ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;

-- Drop old role column and old enum
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";

-- Create Indexes
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_module_idx" ON "permissions"("module");
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- Add Foreign Keys
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
