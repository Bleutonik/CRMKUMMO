require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

// ─── Config ───────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const BATCH_SIZE  = 50;  // conversaciones por análisis
const MAX_BATCHES = 20;  // máximo de batches (20 × 50 = 1000 conversaciones)

let totalExtraidas  = 0;
let totalDuplicadas = 0;
let batchesAnalizados = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Obtiene conversaciones con respuesta real en lotes paginados.
 */
async function obtenerConversaciones(offset, limit) {
  const res = await pool.query(`
    SELECT mensaje_cliente, respuesta_bot
    FROM conversations
    WHERE respuesta_bot IS NOT NULL
      AND LENGTH(TRIM(respuesta_bot)) > 20
      AND LENGTH(TRIM(mensaje_cliente)) > 5
    ORDER BY timestamp DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return res.rows;
}

/**
 * Llama a Claude para analizar un batch de conversaciones y extraer
 * preguntas frecuentes con sus mejores respuestas.
 */
async function analizarConClaude(conversaciones) {
  const texto = conversaciones.map((c, i) =>
    `[${i + 1}] Cliente: ${c.mensaje_cliente}\n    Agente: ${c.respuesta_bot}`
  ).join('\n\n');

  const prompt = `Analiza estas conversaciones reales entre clientes y agentes de una empresa de viajes/tours.

CONVERSACIONES:
${texto}

Tu tarea:
1. Identifica los TEMAS y PREGUNTAS más frecuentes o importantes.
2. Para cada tema, escribe la MEJOR respuesta basada en cómo respondieron los agentes.
3. Agrupa por categoría.

Devuelve SOLO un JSON válido con este formato exacto (sin markdown, sin explicaciones):
[
  {
    "pregunta": "¿pregunta representativa del tema?",
    "respuesta": "respuesta completa y útil basada en cómo respondían los agentes",
    "categoria": "una de: reservas | precios | tours | disponibilidad | contacto | cancelaciones | general"
  }
]

Reglas:
- Máximo 10 entradas por análisis
- Solo incluir temas con respuestas claras y útiles
- Las respuestas deben ser completas, no vagas
- No inventar información que no esté en las conversaciones`;

  const respuesta = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  });

  const textoRespuesta = respuesta.content[0].text.trim();

  // Extraer JSON aunque venga con texto alrededor
  const match = textoRespuesta.match(/\[[\s\S]*\]/);
  if (!match) return [];

  return JSON.parse(match[0]);
}

/**
 * Guarda una entrada en conocimiento evitando duplicados por pregunta similar.
 */
async function guardarConocimiento(entrada) {
  // Verificar si ya existe una pregunta muy similar (por palabras clave)
  const palabras = entrada.pregunta
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length > 4)
    .slice(0, 3);

  if (palabras.length > 0) {
    const condicion = palabras.map((p, i) => `LOWER(pregunta) LIKE $${i + 1}`).join(' AND ');
    const existe = await pool.query(
      `SELECT id FROM conocimiento WHERE ${condicion} LIMIT 1`,
      palabras.map(p => `%${p}%`)
    );
    if (existe.rows.length > 0) {
      totalDuplicadas++;
      return;
    }
  }

  await pool.query(
    `INSERT INTO conocimiento (pregunta, respuesta, categoria)
     VALUES ($1, $2, $3)`,
    [entrada.pregunta, entrada.respuesta, entrada.categoria || 'general']
  );
  totalExtraidas++;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  Extractor de conocimiento desde historial de Kommo  ');
  console.log('══════════════════════════════════════════════════════');

  // Total de conversaciones disponibles
  const { rows } = await pool.query(`
    SELECT COUNT(*) as total FROM conversations
    WHERE respuesta_bot IS NOT NULL AND LENGTH(TRIM(respuesta_bot)) > 20
  `);
  const totalDisponibles = parseInt(rows[0].total);
  const batchesToProcesar = Math.min(MAX_BATCHES, Math.ceil(totalDisponibles / BATCH_SIZE));

  console.log(`  Conversaciones disponibles : ${totalDisponibles}`);
  console.log(`  Batches a analizar         : ${batchesToProcesar} × ${BATCH_SIZE} conversaciones`);
  console.log(`  Modelo                     : claude-sonnet-4-6`);
  console.log('');
  console.log('  Iniciando análisis...\n');

  for (let i = 0; i < batchesToProcesar; i++) {
    const offset = i * BATCH_SIZE;
    batchesAnalizados++;

    process.stdout.write(
      `\r  Analizando batch ${batchesAnalizados} / ${batchesToProcesar} — conocimiento extraído: ${totalExtraidas}`
    );

    try {
      const conversaciones = await obtenerConversaciones(offset, BATCH_SIZE);
      if (conversaciones.length === 0) break;

      const entradas = await analizarConClaude(conversaciones);

      for (const entrada of entradas) {
        if (entrada.pregunta && entrada.respuesta) {
          await guardarConocimiento(entrada);
        }
      }

      // Pausa entre llamadas a Claude para no saturar la API
      await sleep(1500);

    } catch (err) {
      console.error(`\n  ⚠️  Error en batch ${batchesAnalizados}:`, err.message);
      await sleep(3000);
    }
  }

  console.log('\n');
  console.log('══════════════════════════════════════════════════════');
  console.log('  Extracción completada');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Batches analizados         : ${batchesAnalizados}`);
  console.log(`  Entradas creadas           : ${totalExtraidas}`);
  console.log(`  Duplicados omitidos        : ${totalDuplicadas}`);
  console.log('');
  console.log('  El bot ahora usará este conocimiento en cada respuesta.');
  console.log('  Puedes verlo y editarlo en el dashboard → /training');
  console.log('══════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  pool.end();
  process.exit(1);
});
