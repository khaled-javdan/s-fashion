-- Enable trigram matching for fuzzy product search (typo tolerance + ranking).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes backing the storefront search. Names are matched
-- case-insensitively in English (lower()); Arabic has no case so it is indexed
-- as-is. Descriptions are indexed too so a keyword in the body still matches.
CREATE INDEX IF NOT EXISTS "product_name_en_trgm" ON "Product" USING gin (lower("nameEn") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "product_name_ar_trgm" ON "Product" USING gin ("nameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "product_desc_en_trgm" ON "Product" USING gin (lower("descEn") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "product_desc_ar_trgm" ON "Product" USING gin ("descAr" gin_trgm_ops);
