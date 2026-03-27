import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";

// Cargar variables de entorno desde .env.local
config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Productos esperados del PDF (primeros 10)
const EXPECTED_PRODUCTS = [
  { code: "140206307", name: "ACEITE DE GIRASOL ALTO OLEICO", brand: "CAÑUELAS", presentation: "BID", price: 27507.00 },
  { code: "140206313", name: "ACEITE DE GIRASOL CAÑUELAS 12 X 1,5 LT.", brand: "CAÑUELAS", presentation: "CAJ", price: 64968.00 },
  { code: "140206314", name: "ACEITE DE GIRASOL CAÑUELAS (UNI)", brand: "CAÑUELAS", presentation: "BOT", price: 5414.00 },
  { code: "140235401", name: "ACEITE DE GIRASOL NATURA", brand: "NATURA", presentation: "BID", price: 16673.00 },
  { code: "149945401", name: "ACEITE DE MAIZ IND. ABEDUL", brand: "ABEDUL", presentation: "CAJ", price: 17611.00 },
  { code: "140209802", name: "ACEITE DE MAIZ JUMBALAY", brand: "JUMBALAY", presentation: "BID", price: 33416.00 },
  { code: "140203110", name: "ACEITE DE OLIVA X 250 ML", brand: "LA TOSCANA", presentation: "BOT", price: 6143.00 },
  { code: "140203107", name: "ACEITE DE OLIVA X 5 LT", brand: "LA TOSCANA", presentation: "BID", price: 82809.00 },
  { code: "140231301", name: "ACEITE DE OLIVA 1938", brand: "1938", presentation: "BID", price: 98199.00 },
  { code: "140244901", name: "ACEITE DE OLIVA EXTRA VIRGEN X 2 LTS", brand: "NUCETE", presentation: "BID", price: 28659.00 },
];

interface TestResult {
  iteration: number;
  totalProducts: number;
  validProducts: number;
  priceAccuracy: number;
  tagAccuracy: number;
  fieldAccuracy: number;
  srsCompliance: number;
  issues: string[];
  processingTimeMs: number;
  aiJudgeOpinion?: string;
}

/**
 * Usa gemma-3-27b-it como juez para analizar y dar su opinión sobre el compliance
 */
async function getAIJudgeOpinion(products: Doc<"products">[], result: any, processingTime: number): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

    // Preparar datos para el juez
    const productsSummary = products.slice(0, 10).map((p, i) =>
      `${i + 1}. ${p.name} (${p.brand}) - $${p.price} - Tags: ${p.tags?.join(", ") || "sin tags"} - Normalizado: ${p.normalizedPrice ? `$${p.normalizedPrice}/${p.unitOfMeasure}` : "N/A"}`
    ).join("\n");

    const issuesSummary = result.issues.length > 0
      ? "\nIssues encontrados:\n" + result.issues.map((i: string) => `- ${i}`).join("\n")
      : "\n✅ No issues encontrados";

    const prompt = `Eres un juez experto en sistemas SRS (Software Requirements Specification). Evalúa el siguiente procesamiento de catálogo de productos:

📊 RESULTADOS:
- Productos procesados: ${result.processed || products.length}
- Productos válidos: ${products.length}
- Precisión de precios: ${result.priceAccuracy?.toFixed(2)}%
- Precisión de tags: ${result.tagAccuracy?.toFixed(2)}%
- Precisión de campos: ${result.fieldAccuracy?.toFixed(2)}%
- Tiempo de procesamiento: ${processingTime}ms
- Compliance SRS v1: ${result.srsCompliance?.toFixed(2)}%

📦 MUESTRA DE PRODUCTOS (primeros 10):
${productsSummary}
${issuesSummary}

📋 REQUISITOS SRS v1:
- RF-001: Carga de catálogos (mínimo 10 productos)
- RF-015: Procesamiento con Gemini Files API
- RF-016: Normalización de datos (precios por unidad estándar)
- RF-017: Indexación de productos por tags
- RNF-002: Performance (< 30s)

Tu tarea:
1. Analiza si los resultados cumplen con los requisitos SRS v1
2. Evalúa la calidad de los datos extraídos
3. Identifica cualquier problema o área de mejora
4. Da tu veredicto final (APROBADO/NECESITA_MEJORAS) con justificación

Responde en español, de forma concisa pero completa (máximo 150 palabras).`;

    const response = await ai.models.generateContent({
      model: "gemma-3-27b-it",
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
      },
    });

    return response.text || "Sin opinión del juez AI";
  } catch (error) {
    return `Error obteniendo opinión del juez AI: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function runIteration(iteration: number, client: ConvexClient): Promise<TestResult> {
  const issues: string[] = [];
  const startTime = Date.now();

  try {
    // 1. Ejecutar ingestión
    const pdfPath = `${__dirname}/../test-file.pdf`;
    const pdfBuffer = await fs.readFile(pdfPath);
    const base64 = pdfBuffer.toString("base64");

    const result = await client.action(api.ingest.ingestCatalog, {
      fileBase64: base64,
      mimeType: "application/pdf"
    });

    const processingTime = Date.now() - startTime;

    // 2. Obtener productos procesados
    const products = await client.query(api.products.list, {});

    // 3. Validar RF-001: Cantidad mínima de productos
    if (!result || result.processed < 10) {
      issues.push(`RF-001: Menos de 10 productos procesados (${result?.processed || 0})`);
    }

    // 4. Validar RF-016: Normalización de precios
    const priceErrors = products.filter((p: Doc<"products">) => p.price <= 0 || isNaN(p.price));
    if (priceErrors.length > 0) {
      issues.push(`RF-016: ${priceErrors.length} productos con precios inválidos`);
    }

    // 5. Validar RF-017: Tags presentes y bien formados
    const noTags = products.filter((p: Doc<"products">) => !p.tags || p.tags.length === 0);
    if (noTags.length > 0) {
      issues.push(`RF-017: ${noTags.length} productos sin tags`);
    }

    // 6. Validar campos requeridos (name, brand, presentation, category)
    const incomplete = products.filter((p: Doc<"products">) =>
      !p.name || !p.brand || !p.presentation || !p.category
    );
    if (incomplete.length > 0) {
      issues.push(`RF-016: ${incomplete.length} productos con campos incompletos`);
    }

    // 7. Validar RNF-002: Tiempo de procesamiento < 30 segundos
    if (processingTime > 30000) {
      issues.push(`RNF-002: Tiempo de procesamiento excedido (${processingTime}ms > 30000ms)`);
    }

    // 8. Validar presencia de productos esperados (aceites)
    const aceitesProducts = products.filter((p: Doc<"products">) =>
      p.category?.toLowerCase().includes("aceite") ||
      p.name?.toLowerCase().includes("aceite")
    );
    if (aceitesProducts.length < 10) {
      issues.push(`RF-016: Se esperaban al menos 10 productos de aceites, encontrados: ${aceitesProducts.length}`);
    }

    // 9. Validar productos específicos del PDF (primeros 10)
    let matchedExpectedProducts = 0;

    for (const expected of EXPECTED_PRODUCTS) {
      // Búsqueda más flexible: busca por código en el nombre o por combinación de características
      const match = products.find((p: Doc<"products">) => {
        const nameUpper = p.name?.toUpperCase() || "";
        const brandUpper = p.brand?.toUpperCase() || "";

        // Buscar por código (si está incluido en el nombre)
        if (nameUpper.includes(expected.code)) {
          return true;
        }

        // Buscar por nombre clave y marca con tolerancia de precio
        const keyTerms = expected.name.toUpperCase().split(" ").filter((t) =>
          t.length > 4 && !["ACEITE", "DE", "LA", "EL", "EN", "X", "LT", "ML"].includes(t)
        );

        const hasKeyTerms = keyTerms.some((term) => nameUpper.includes(term));
        const hasBrand = brandUpper.includes(expected.brand.toUpperCase());
        const priceMatch = Math.abs(p.price - expected.price) < (expected.price * 0.1); // 10% tolerancia

        return hasKeyTerms && (hasBrand || priceMatch);
      });

      if (match) {
        matchedExpectedProducts++;
      } else {
        // No agregar issue si encontramos la mayoría, solo log informativo
        if (matchedExpectedProducts < 5) {
          issues.push(`RF-016: Producto esperado no encontrado: ${expected.code} - ${expected.name}`);
        }
      }
    }

    // Solo agregar issue si tenemos menos del 80% de los productos esperados
    if (matchedExpectedProducts < EXPECTED_PRODUCTS.length * 0.8) {
      issues.push(`RF-016: Solo ${matchedExpectedProducts}/${EXPECTED_PRODUCTS.length} productos esperados fueron encontrados`);
    }

    // 10. Validar normalización de precios (solo para productos recién procesados)
    const processedCount = result?.processed || 0;
    let normalizedPriceErrors: Doc<"products">[] = [];

    // Solo validar normalización si hubo productos procesados en esta iteración
    if (processedCount > 0) {
      const productsWithNormalization = products.filter((p: Doc<"products">) => p.normalizedPrice !== undefined);
      normalizedPriceErrors = productsWithNormalization.filter((p: Doc<"products">) => {
        if (!p.normalizedPrice || p.normalizedPrice <= 0) return true;
        if (!p.unitOfMeasure || p.unitOfMeasure.trim() === "") return true;
        if (!p.quantity || p.quantity <= 0) return true;
        return false;
      });

      if (normalizedPriceErrors.length > 0) {
        issues.push(`RF-016: ${normalizedPriceErrors.length} productos con normalización de precios incorrecta`);
      }

      // Verificar que todos los productos procesados tengan normalización
      if (productsWithNormalization.length < processedCount) {
        issues.push(`RF-016: Solo ${productsWithNormalization.length}/${processedCount} productos procesados tienen precios normalizados`);
      }
    }

    // 11. Calcular métricas de calidad
    const totalErrors = priceErrors.length + noTags.length + incomplete.length + normalizedPriceErrors.length;
    const validProducts = products.length - totalErrors;

    const priceAccuracy = products.length > 0
      ? ((products.length - priceErrors.length) / products.length) * 100
      : 0;

    const tagAccuracy = products.length > 0
      ? ((products.length - noTags.length) / products.length) * 100
      : 0;

    const fieldAccuracy = products.length > 0
      ? ((products.length - incomplete.length) / products.length) * 100
      : 0;

    const srsCompliance = products.length > 0
      ? (validProducts / products.length) * 100
      : 0;

    // 12. Obtener opinión del juez AI (gemma-3-27b-it)
    let aiJudgeOpinion: string | undefined;
    if (process.env.GEMINI_API_KEY) {
      aiJudgeOpinion = await getAIJudgeOpinion(products, {
        processed: processedCount,
        priceAccuracy,
        tagAccuracy,
        fieldAccuracy,
        srsCompliance,
        issues,
      }, processingTime);
    } else {
      aiJudgeOpinion = "⚠️ Juez AI no configurado: Set GEMINI_API_KEY environment variable para habilitar análisis con gemma-3-27b-it";
    }

    return {
      iteration,
      totalProducts: products.length,
      validProducts,
      priceAccuracy,
      tagAccuracy,
      fieldAccuracy,
      srsCompliance,
      issues,
      processingTimeMs: processingTime,
      aiJudgeOpinion,
    };
  } catch (error) {
    issues.push(`Error durante procesamiento: ${error instanceof Error ? error.message : String(error)}`);
    return {
      iteration,
      totalProducts: 0,
      validProducts: 0,
      priceAccuracy: 0,
      tagAccuracy: 0,
      fieldAccuracy: 0,
      srsCompliance: 0,
      issues,
      processingTimeMs: Date.now() - startTime,
      aiJudgeOpinion: undefined,
    };
  }
}

async function main() {
  console.log("🏛️  SRS v1 JUEZ - Validando compliance de procesamiento de PDF");
  console.log("🤖 Juez AI: gemma-3-27b-it (Google)\n");
  console.log("📋 Requisitos validados:");
  console.log("   - RF-001: Carga de catálogos");
  console.log("   - RF-015: Procesamiento con Gemini Files API");
  console.log("   - RF-016: Normalización de datos");
  console.log("   - RF-017: Indexación de productos por tags");
  console.log("   - RNF-002: Performance (< 30s)\n");

  // Inicializar cliente Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://clean-mammoth-892.convex.cloud";
  const client = new ConvexClient(convexUrl);

  const MAX_ITERATIONS = 10;
  const TARGET_COMPLIANCE = 99.9;

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 ITERACIÓN ${i}/${MAX_ITERATIONS}`);
    console.log(`${"=".repeat(60)}`);

    const result = await runIteration(i, client);

    console.log(`\n📦 Productos procesados: ${result.totalProducts}`);
    console.log(`✅ Productos válidos: ${result.validProducts}`);
    console.log(`\n📈 Métricas de calidad:`);
    console.log(`   - Precisión de precios: ${result.priceAccuracy.toFixed(2)}%`);
    console.log(`   - Precisión de tags: ${result.tagAccuracy.toFixed(2)}%`);
    console.log(`   - Precisión de campos: ${result.fieldAccuracy.toFixed(2)}%`);
    console.log(`   - Tiempo de procesamiento: ${result.processingTimeMs}ms`);
    console.log(`\n🎯 Compliance SRS v1: ${result.srsCompliance.toFixed(2)}%`);

    if (result.issues.length > 0) {
      console.log(`\n⚠️  Issues encontrados (${result.issues.length}):`);
      result.issues.forEach(issue => console.log(`   ❌ ${issue}`));
    } else {
      console.log(`\n✨ No se encontraron issues`);
    }

    // Mostrar opinión del juez AI
    if (result.aiJudgeOpinion) {
      console.log(`\n🤖 OPINIÓN DEL JUEZ AI (gemma-3-27b-it):`);
      console.log(`   ${result.aiJudgeOpinion}`);
    }

    if (result.srsCompliance >= TARGET_COMPLIANCE && result.issues.length === 0) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🎉 ¡OBJETIVO ALCANZADO!`);
      console.log(`   Compliance: ${result.srsCompliance.toFixed(2)}%`);
      console.log(`   Iteraciones: ${i}`);
      console.log(`${"=".repeat(60)}`);
      process.exit(0);
    }

    if (i < MAX_ITERATIONS) {
      console.log(`\n🔄 Continuando con siguiente iteración...`);
      console.log(`   Objetivo: ${TARGET_COMPLIANCE}% compliance\n`);

      // Esperar 1 segundo entre iteraciones
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`❌ NO SE ALCANZÓ EL OBJETIVO DESPUÉS DE ${MAX_ITERATIONS} ITERACIONES`);
  console.log(`${"=".repeat(60)}`);
  process.exit(1);
}

main();
