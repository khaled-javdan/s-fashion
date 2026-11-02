-- Storefront category fields: optional bilingual intro text and a "show in
-- menu" flag. Additive only; existing categories default to not-in-menu.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "descAr" TEXT,
ADD COLUMN     "descEn" TEXT,
ADD COLUMN     "showInMenu" BOOLEAN NOT NULL DEFAULT false;
