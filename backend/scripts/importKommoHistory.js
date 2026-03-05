require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

// ─── Configuración ───────────────────────────────────────────────────────────
const _sub = process.env.KOMMO_SUBDOMAIN || '';
const KOMMO_BASE_URL = process.env.KOMMO_BASE_URL
  || (_sub ? (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`) : null);
const KOMMO_TOKEN    = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;
const DATABASE_URL   = process.env.DATABASE_URL;

if (!KOMMO_BASE_URL || !KOMMO_TOKEN || !DATABASE_URL) {
  console.error('❌ Faltan variables de entorno: KOMMO_SUBDOMAIN (o KOMMO_BASE_URL), KOMMO_ACCESS_TOKEN, DATABASE_URL');
  process.exit(1);
}

const http = axios.create({
  baseURL: KOMMO_BASE_URL,
  headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
  timeout: 15000
});

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ─── Contadores ───────────────────────────────────────────────────────────────
let totalLeads      = 0;
let leadsProcessados = 0;
let importados      = 0;
let duplicados      = 0;
let errores         = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Obtiene todos los leads de Kommo con paginación.
 * Devuelve un generador para no cargar todo en memoria.
 */
async function* obtenerLeads() {
  let pagina = 1;
  const limite = 250;

  while (true) {
    try {
      const res = await http.get('/api/v4/leads', {
        params: { page: pagina, limit: limite, with: 'contacts' }
      });

      const leads = res.data?._embedded?.leads || [];
      if (leads.length === 0) break;

      yield* leads;

      // Si devolvió menos del límite, no hay más páginas
      if (leads.length < limite) break;

      pagina++;
      await sleep(300); // respetar rate limit de Kommo
    } catch (err) {
      if (err.response?.status === 204 || err.response?.status === 404) break;
      console.error(`  ⚠️  Error obteniendo leads página ${pagina}:`, err.message);
      break;
    }
  }
}

/**
 * Obtiene todas las notas de un lead con paginación.
 */
async function obtenerNotasLead(leadId) {
  const notas = [];
  let pagina = 1;
  const limite = 250;

  while (true) {
    try {
      const res = await http.get(`/api/v4/leads/${leadId}/notes`, {
        params: { page: pagina, limit: limite }
      });

      const items = res.data?._embedded?.notes || [];
      notas.push(...items);

      if (items.length < limite) break;
      pagina++;
      await sleep(200);
    } catch (err) {
      if (err.response?.status === 204 || err.response?.status === 404) break;
      errores++;
      break;
    }
  }

  // Ordenar cronológicamente
  return notas.sort((a, b) => a.created_at - b.created_at);
}

/**
 * Obtiene el nombre del contacto principal de un lead.
 */
function obtenerNombreContacto(lead) {
  const contactos = lead._embedded?.contacts;
  if (contactos && contactos.length > 0) {
    return contactos[0].name || null;
  }
  return null;
}

/**
 * Extrae el texto de una nota.
 */
function extraerTexto(nota) {
  return nota.params?.text?.trim() || null;
}

/**
 * Clasifica si una nota es de cliente o de agente.
 * - note_type 25: mensaje entrante (cliente) ← tipo Twilio/WhatsApp
 * - note_type 26: mensaje saliente (agente)  ← tipo Twilio/WhatsApp
 * - note_type 4:  nota común — se clasifica por posición en la conversación
 */
function tipoNota(nota) {
  const t = nota.note_type;
  if (t === 25) return 'cliente';
  if (t === 26) return 'agente';
  if (t === 4)  return 'comun';   // se inferirá por contexto
  return 'otro';
}

/**
 * Convierte la lista de notas en pares [mensaje_cliente, respuesta_agente].
 * Estrategia:
 *  - Si hay tipos 25/26 definidos → parear entrante con siguiente saliente
 *  - Si solo hay tipo 4 → parear notas alternas (1=cliente, 2=agente, ...)
 */
function extraerPares(notas) {
  const pares = [];

  // Intentar con tipos 25/26 primero
  const tieneTipos = notas.some(n => n.note_type === 25 || n.note_type === 26);

  if (tieneTipos) {
    let pendienteCliente = null;
    let timestampCliente = null;

    for (const nota of notas) {
      const texto = extraerTexto(nota);
      if (!texto) continue;

      const tipo = tipoNota(nota);

      if (tipo === 'cliente') {
        pendienteCliente = texto;
        timestampCliente = nota.created_at;
      } else if (tipo === 'agente' && pendienteCliente) {
        pares.push({
          mensaje_cliente: pendienteCliente,
          respuesta_bot:   texto,
          timestamp:       new Date(timestampCliente * 1000).toISOString()
        });
        pendienteCliente = null;
        timestampCliente = null;
      }
    }

    // Mensaje de cliente sin respuesta (guardar igual)
    if (pendienteCliente) {
      pares.push({
        mensaje_cliente: pendienteCliente,
        respuesta_bot:   null,
        timestamp:       new Date(timestampCliente * 1000).toISOString()
      });
    }

  } else {
    // Solo notas comunes — parear alternas
    const textosValidos = notas
      .filter(n => n.note_type === 4 && extraerTexto(n))
      .map(n => ({ texto: extraerTexto(n), ts: n.created_at }));

    for (let i = 0; i < textosValidos.length; i += 2) {
      const cliente = textosValidos[i];
      const agente  = textosValidos[i + 1] || null;

      pares.push({
        mensaje_cliente: cliente.texto,
        respuesta_bot:   agente?.texto || null,
        timestamp:       new Date(cliente.ts * 1000).toISOString()
      });
    }
  }

  return pares;
}

/**
 * Guarda un par en la tabla conversations evitando duplicados.
 */
async function guardarPar(leadId, contactName, par) {
  // Verificar duplicado por lead_id + mensaje_cliente + timestamp
  const existe = await pool.query(
    `SELECT id FROM conversations
     WHERE lead_id = $1 AND mensaje_cliente = $2 AND timestamp = $3`,
    [String(leadId), par.mensaje_cliente, par.timestamp]
  );

  if (existe.rows.length > 0) {
    duplicados++;
    return false;
  }

  await pool.query(
    `INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot, timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [String(leadId), contactName, par.mensaje_cliente, par.respuesta_bot, par.timestamp]
  );

  importados++;
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  Importador de historial Kommo → PostgreSQL  ');
  console.log('══════════════════════════════════════════════');
  console.log(`  Base URL: ${KOMMO_BASE_URL}`);
  console.log('');

  // Obtener total de leads para mostrar progreso
  try {
    const res = await http.get('/api/v4/leads', { params: { limit: 1 } });
    totalLeads = res.data?._page_count
      ? res.data._page_count * 250
      : '?';
  } catch {}

  console.log(`  Leads estimados: ${totalLeads}`);
  console.log('  Iniciando importación...\n');

  const inicio = Date.now();

  for await (const lead of obtenerLeads()) {
    leadsProcessados++;
    const leadId      = lead.id;
    const contactName = obtenerNombreContacto(lead);

    process.stdout.write(
      `\r  Procesando lead ${leadsProcessados} / ${totalLeads} (lead_id: ${leadId}) — importados: ${importados}`
    );

    try {
      const notas = await obtenerNotasLead(leadId);
      if (notas.length === 0) continue;

      const pares = extraerPares(notas);
      for (const par of pares) {
        await guardarPar(leadId, contactName, par);
      }
    } catch (err) {
      errores++;
    }

    await sleep(100);
  }

  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log('\n');
  console.log('══════════════════════════════════════════════');
  console.log('  Importación completada');
  console.log('══════════════════════════════════════════════');
  console.log(`  Leads procesados : ${leadsProcessados}`);
  console.log(`  Conversaciones importadas : ${importados}`);
  console.log(`  Duplicados omitidos       : ${duplicados}`);
  console.log(`  Errores                   : ${errores}`);
  console.log(`  Tiempo total              : ${duracion}s`);
  console.log('══════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  pool.end();
  process.exit(1);
});
