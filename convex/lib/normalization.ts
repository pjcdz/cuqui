/**
 * Normalización de precios según SRS v1 RF-016
 * Convierte precios de empaque a precios por unidad estándar (litro, kg, unidad)
 */

export type UnitOfMeasure = "litro" | "ml" | "kg" | "g" | "unidad";

export interface ParsedPresentation {
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  containerType: string;
  multiplier?: number; // Para multi-pack: 12 X 1,5 LT → multiplier=12, quantity=1.5
}

/**
 * Parsea la presentación del producto para extraer cantidad y unidad
 * Ejemplos:
 * - "BIDON X 5 LTS" → { quantity: 5, unitOfMeasure: "litro", containerType: "BID" }
 * - "BOT X 250 ML" → { quantity: 250, unitOfMeasure: "ml", containerType: "BOT" }
 * - "CAJ X 12 UNIDADES" → { quantity: 12, unitOfMeasure: "unidad", containerType: "CAJ" }
 * - "CAJ 12 X 1,5 LT." → { quantity: 1.5, unitOfMeasure: "litro", multiplier: 12, containerType: "CAJ" }
 *
 * @returns ParsedPresentation | null - Returns null if parsing fails (cannot normalize)
 */
export function parsePresentation(presentation: string): ParsedPresentation | null {
  const upper = presentation.toUpperCase();

  // Primero: detectar formato multi-pack con validación de contexto y rango
  // FIXED: Ahora requiere keyword de contenedor Y rango válido de multiplier
  // para prevenir false-positivos en códigos de producto como "1938 X 250 ML"
  const multiPackPatterns = [
    // "CAJ 12 X 1,5 LT" - válido (multiplier=12, dentro de rango)
    // Requiere keyword de contenedor (CAJ, BULT, BID, BOT, PAQ, ENV)
    /(?:CAJ|BULT|BID|BOT|PAQ|ENV)\s*(\d{1,3})\s*X\s*(\d+[,\.]?\d*)\s*(L\.?T\.?S\.?|L\.?T\.?|M\.?L\.?|C\.?C\.?|K\.?G\.?|G\.?(R)?\.?|U\.?N\.?I\.?D\.?A\.?D\.?E\.?S\.?|UNIDADES?)/i,
    // "12 X 1,5 LT" - solo si el multiplier es razonable (no un año como 1938)
    /(\b\d{1,2}\b)\s*X\s*(\d+[,\.]?\d*)\s*(L\.?T\.?S\.?|L\.?T\.?|M\.?L\.?|C\.?C\.?|K\.?G\.?|G\.?(R)?\.?|U\.?N\.?I\.?D\.?A\.?D\.?E\.?S\.?|UNIDADES?)/i
  ];

  for (const pattern of multiPackPatterns) {
    const match = upper.match(pattern);
    if (match) {
      const multiplier = parseInt(match[1], 10);
      const quantity = parseFloat(match[2].replace(",", "."));
      const unitPart = match[3];

      // VALIDACIÓN: Rechazar multipliers que parezcan años o códigos de producto
      if (multiplier < 1 || multiplier > 100) {
        continue; // Skip este patrón, intentar el siguiente o usar patrones estándar
      }

      const unitOfMeasure = parseUnitFromMatch(unitPart);
      if (unitOfMeasure === null) {
        return null; // No se puede normalizar
      }

      return {
        quantity,
        unitOfMeasure,
        multiplier,
        containerType: extractContainerType(upper),
      };
    }
  }

  // Patrones de búsqueda para formato estándar "BIDON X 5 LTS"
  const patterns = [
    // "X 5 LTS" o " X 5 LT." o " X 1,5 LT"
    { regex: /X\s*(\d+[,\.]?\d*)\s*L\.?T\.?S\.?/i, unit: "litro" as UnitOfMeasure },
    { regex: /X\s*(\d+[,\.]?\d*)\s*L\.?T\.?/i, unit: "litro" as UnitOfMeasure },
    // "X 250 ML" o " X 250 CC"
    { regex: /X\s*(\d+)\s*M\.?L\.?/i, unit: "ml" as UnitOfMeasure },
    { regex: /X\s*(\d+)\s*C\.?C\.?/i, unit: "ml" as UnitOfMeasure },
    // "X 1 KG" o " X 500 G"
    { regex: /X\s*(\d+[,\.]?\d*)\s*K\.?G\.?/i, unit: "kg" as UnitOfMeasure },
    { regex: /X\s*(\d+)\s*G\.?(R)?\.?/i, unit: "g" as UnitOfMeasure },
    // "X 12 UNIDADES" - FIXED: Now matches UNIDADES correctly (U-N-I-D-A-D-E-S)
    { regex: /X\s*(\d+)\s*U\.?N\.?I\.?D\.?A\.?D\.?E\.?S\.?/i, unit: "unidad" as UnitOfMeasure },
    { regex: /X\s*(\d+)\s*U\.?N\.?I\.?T\.?/i, unit: "unidad" as UnitOfMeasure },
    { regex: /\b(\d+)U\b/i, unit: "unidad" as UnitOfMeasure },
    { regex: /\b(\d+)\s*UN\b/i, unit: "unidad" as UnitOfMeasure },
  ];

  for (const pattern of patterns) {
    const match = upper.match(pattern.regex);
    if (match) {
      const quantity = parseFloat(match[1].replace(",", "."));

      // Validar que la cantidad sea válida
      if (!isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        quantity,
        unitOfMeasure: pattern.unit,
        containerType: extractContainerType(upper),
      };
    }
  }

  // No se pudo parsear - retornar null en lugar de valores por defecto
  // Esto indica que NO se puede normalizar el precio
  return null;
}

/**
 * Convierte el string de unidad del match a UnitOfMeasure
 */
function parseUnitFromMatch(unitPart: string): UnitOfMeasure | null {
  const upper = unitPart.toUpperCase();

  if (/L\.?T\.?S\.?/.test(upper) || /L\.?T\.?/.test(upper)) {
    return "litro";
  }
  if (/M\.?L\.?/.test(upper) || /C\.?C\.?/.test(upper)) {
    return "ml";
  }
  if (/K\.?G\.?/.test(upper)) {
    return "kg";
  }
  if (/G\.?(R)?\.?/.test(upper)) {
    return "g";
  }
  // FIXED: Changed UNITADES to UNIDADES (U-N-I-D-A-D-E-S)
  if (/U\.?N\.?I\.?D\.?A\.?D\.?E\.?S\.?/.test(upper) || /U\.?N\.?I\.?T\.?/.test(upper)) {
    return "unidad";
  }

  return null;
}

/**
 * Extrae el tipo de contenedor de la presentación
 */
function extractContainerType(presentation: string): string {
  const types = ["BID", "BOT", "CAJ", "UNI", "PAQ", "BOL", "ENV", "TETRA"];
  for (const type of types) {
    if (presentation.includes(type)) {
      return type;
    }
  }
  return "UNIDAD";
}

/**
 * Calcula el precio normalizado por unidad estándar
 * @param price - Precio total del empaque
 * @param quantity - Cantidad en el empaque
 * @param unitOfMeasure - Unidad de medida (litro, kg, ml, g, unidad)
 * @param multiplier - Multiplicador para multi-pack (opcional)
 * @returns Precio por unidad estándar (siempre litro, kg o unidad), o NaN si hay error
 */
export function calculateNormalizedPrice(
  price: number,
  quantity: number,
  unitOfMeasure: UnitOfMeasure,
  multiplier?: number
): number {
  // Validaciones defensivas
  if (!isFinite(price) || price <= 0) {
    return NaN; // Precio inválido
  }
  if (!isFinite(quantity) || quantity <= 0) {
    return NaN; // Cantidad inválida
  }

  // Calcular cantidad total (considerando multiplier para multi-pack)
  const totalQuantity = multiplier ? quantity * multiplier : quantity;

  // Convertir a unidades estándar
  switch (unitOfMeasure) {
    case "litro":
      return price / totalQuantity;
    case "ml":
      return (price / totalQuantity) * 1000; // Convertir a litro
    case "kg":
      return price / totalQuantity;
    case "g":
      return (price / totalQuantity) * 1000; // Convertir a kg
    case "unidad":
      return price / totalQuantity;
    default:
      return NaN; // Unidad no reconocida
  }
}

/**
 * Formatea el precio normalizado para mostrar en UI
 * @param normalizedPrice - Precio normalizado
 * @param unitOfMeasure - Unidad de medida original
 * @returns String formateado (ej: "$5,501.40/litro")
 */
export function formatNormalizedPrice(
  normalizedPrice: number,
  unitOfMeasure: UnitOfMeasure
): string {
  let displayUnit = "unidad";

  // Convertir a unidad de display estándar
  switch (unitOfMeasure) {
    case "litro":
    case "ml":
      displayUnit = "litro";
      break;
    case "kg":
    case "g":
      displayUnit = "kg";
      break;
    case "unidad":
      displayUnit = "unidad";
      break;
  }

  return `$${normalizedPrice.toFixed(2)}/${displayUnit}`;
}
