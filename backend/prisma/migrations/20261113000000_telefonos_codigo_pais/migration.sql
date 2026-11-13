-- Teléfonos de clientes con código de país (+53 por defecto) y una sola clave de reconocimiento.
--
-- Antes «55354530», «5535 4530» y «+53 5535 4530» eran tres claves distintas (phoneKey solo quitaba
-- símbolos) y generaban fichas duplicadas. Mismas reglas que backend/src/lib/phone.ts:
--   · con «+» o «00» delante se respeta el país indicado;
--   · sin prefijo y de 8 cifras o menos, se antepone 53;
--   · sin prefijo y de 9 o más cifras, ya lleva país.
-- No se borra ninguna ficha: si dos clientes del mismo salón quedan con el mismo número, la más
-- antigua conserva la clave y la otra queda sin clave (su teléfono sí se normaliza).

UPDATE "Client" SET "phoneKey" = NULL WHERE "phoneKey" IS NOT NULL;

WITH calc AS (
  SELECT id, "tenantId", "createdAt",
         regexp_replace(phone, '\D', '', 'g') AS d,
         phone ~ '^\s*\(?\s*\+' AS plus,
         phone ~ '^\s*00' AS zeros
  FROM "Client"
  WHERE phone IS NOT NULL AND btrim(phone) <> ''
), norm AS (
  SELECT id, "tenantId", "createdAt",
         CASE WHEN plus THEN d
              WHEN zeros THEN substr(d, 3)
              WHEN length(d) <= 8 THEN '53' || d
              ELSE d END AS k
  FROM calc
), valid AS (
  SELECT * FROM norm WHERE length(k) BETWEEN 8 AND 15
), ranked AS (
  SELECT id, k, row_number() OVER (PARTITION BY "tenantId", k ORDER BY "createdAt", id) AS rn
  FROM valid
)
UPDATE "Client" c
SET phone = '+' || r.k,
    "phoneKey" = CASE WHEN r.rn = 1 THEN r.k ELSE NULL END
FROM ranked r
WHERE c.id = r.id;
