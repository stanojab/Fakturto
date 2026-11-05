-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('ADMIN', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('ACCOUNTANT_PAYS', 'CLIENT_PAYS');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'IN_REVIEW', 'RETURNED', 'REJECTED', 'READY_FOR_PAYMENT', 'PAID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('UPN_QR', 'AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('ORIGINAL', 'PAYMENT_CONFIRMATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "firm_role" "FirmRole",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_number" TEXT NOT NULL,
    "registration_number" TEXT,
    "address" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'ACCOUNTANT_PAYS',
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountant_assignments" (
    "id" UUID NOT NULL,
    "accountant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountant_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UPLOADED',
    "extraction_method" "ExtractionMethod",
    "extraction_confidence" JSONB,
    "issuer_name" TEXT,
    "issuer_tax_number" TEXT,
    "issuer_iban" TEXT,
    "recipient_name" TEXT,
    "invoice_number" TEXT,
    "issue_date" DATE,
    "due_date" DATE,
    "amount" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "payment_reference" TEXT,
    "payment_purpose" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "paid_by_id" UUID,
    "paid_on" DATE,
    "status_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "invoice_id" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tax_number_key" ON "clients"("tax_number");

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "client_memberships_user_id_client_id_key" ON "client_memberships"("user_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "accountant_assignments_accountant_id_client_id_key" ON "accountant_assignments"("accountant_id", "client_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_issuer_tax_number_invoice_number_idx" ON "invoices"("client_id", "issuer_tax_number", "invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_assignments" ADD CONSTRAINT "accountant_assignments_accountant_id_fkey" FOREIGN KEY ("accountant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_assignments" ADD CONSTRAINT "accountant_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
