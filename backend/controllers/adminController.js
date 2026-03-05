const { Pool } = require('pg');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// ─── IMPORTAR HISTORIAL DE KOMMO ─────────────────────────────────────────────

async function importarHistorial(req, res) {
  // Responde inmediatamente y procesa en background
  res.json({ ok: true, mensaje: 'Importación iniciada. Revisa los logs de Railway.' });

  console.log('[IMPORT] Iniciando importación del historial de Kommo...');

  const _sub = process.env.KOMMO_SUBDOMAIN || '';
  const kommoBaseUrl = process.env.KOMMO_BASE_URL
    || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
  const kommoToken = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

  const http = axios.create({
    baseURL: kommoBaseUrl,
    headers: { Authorization: `Bearer ${kommoToken}` },
    timeout: 15000
  });

  let importados = 0;
  let duplicados = 0;
  let pagina = 1;
  const limite = 250;
  const BATCH_SIZE = 5; // procesar 5 leads en paralelo

  async function procesarLead(lead) {
    const leadId = String(lead.id);
    const contactName = lead._embedded?.contacts?.[0]?.name || null;

    let notas = [];
    try {
      const resNotas = await http.get(`/api/v4/leads/${lead.id}/notes`, { params: { limit: 250 } });
      notas = resNotas.data?._embedded?.notes || [];
      notas.sort((a, b) => a.created_at - b.created_at);
    } catch {}

    const tieneTipos = notas.some(n => n.note_type === 25 || n.note_type === 26);
    const pares = [];

    if (tieneTipos) {
      let pendiente = null, ts = null;
      for (const nota of notas) {
        const texto = nota.params?.text?.trim();
        if (!texto) continue;
        if (nota.note_type === 25) { pendiente = texto; ts = nota.created_at; }
        else if (nota.note_type === 26 && pendiente) {
          pares.push({ mensaje_cliente: pendiente, respuesta_bot: texto, ts });
          pendiente = null;
        }
      }
      if (pendiente) pares.push({ mensaje_cliente: pendiente, respuesta_bot: null, ts });
    } else {
      const validas = notas.filter(n => n.note_type === 4 && n.params?.text?.trim());
      for (let i = 0; i < validas.length; i += 2) {
        pares.push({
          mensaje_cliente: validas[i].params.text.trim(),
          respuesta_bot:   validas[i + 1]?.params?.text?.trim() || null,
          ts:              validas[i].created_at
        });
      }
    }

    let imp = 0, dup = 0;
    for (const par of pares) {
      const timestamp = new Date(par.ts * 1000).toISOString();
      const existe = await pool.query(
        'SELECT id FROM conversations WHERE lead_id=$1 AND mensaje_cliente=$2 AND timestamp=$3',
        [leadId, par.mensaje_cliente, timestamp]
      );
      if (existe.rows.length > 0) { dup++; continue; }
      await pool.query(
        'INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot, timestamp) VALUES ($1,$2,$3,$4,$5)',
        [leadId, contactName, par.mensaje_cliente, par.respuesta_bot, timestamp]
      );
      imp++;
    }
    return { imp, dup };
  }

  try {
    while (true) {
      let leads = [];
      try {
        const res = await http.get('/api/v4/leads', {
          params: { page: pagina, limit: limite, with: 'contacts' }
        });
        leads = res.data?._embedded?.leads || [];
      } catch (e) {
        if (e.response?.status === 204) break;
        console.error('[IMPORT] Error obteniendo leads:', e.message);
        break;
      }

      if (leads.length === 0) break;
      console.log(`[IMPORT] Página ${pagina} — ${leads.length} leads`);

      // Procesar en lotes de BATCH_SIZE en paralelo
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const lote = leads.slice(i, i + BATCH_SIZE);
        const resultados = await Promise.all(lote.map(procesarLead));
        for (const r of resultados) { importados += r.imp; duplicados += r.dup; }
        await new Promise(r => setTimeout(r, 100)); // pequeña pausa entre lotes
      }

      if (leads.length < limite) break;
      pagina++;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[IMPORT] Completado — importados: ${importados} | duplicados: ${duplicados}`);

  } catch (err) {
    console.error('[IMPORT] Error fatal:', err.message);
  }
}

// ─── EXTRAER CONOCIMIENTO ─────────────────────────────────────────────────────

async function extraerConocimiento(req, res) {
  res.json({ ok: true, mensaje: 'Extracción iniciada. Revisa los logs de Railway.' });

  console.log('[KNOWLEDGE] Iniciando extracción de conocimiento...');

  const BATCH = 50;
  let offset = 0;
  let extraidas = 0;
  let duplicadas = 0;
  let batch = 0;

  try {
    const { rows: [{ total }] } = await pool.query(
      "SELECT COUNT(*) as total FROM conversations WHERE respuesta_bot IS NOT NULL AND LENGTH(TRIM(respuesta_bot)) > 20"
    );
    const totalBatches = Math.min(20, Math.ceil(total / BATCH));
    console.log(`[KNOWLEDGE] ${total} conversaciones — ${totalBatches} batches`);

    while (batch < totalBatches) {
      const { rows } = await pool.query(
        `SELECT mensaje_cliente, respuesta_bot FROM conversations
         WHERE respuesta_bot IS NOT NULL AND LENGTH(TRIM(respuesta_bot)) > 20
         ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      );

      if (rows.length === 0) break;
      batch++;
      offset += BATCH;

      console.log(`[KNOWLEDGE] Analizando batch ${batch}/${totalBatches}...`);

      try {
        const texto = rows.map((c, i) =>
          `[${i + 1}] Cliente: ${c.mensaje_cliente}\n    Agente: ${c.respuesta_bot}`
        ).join('\n\n');

        const respuesta = await claude.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Analiza estas conversaciones reales entre clientes y agentes de una empresa de viajes/tours.

CONVERSACIONES:
${texto}

Identifica los temas/preguntas más frecuentes e importantes y escribe la mejor respuesta basada en cómo respondieron los agentes.

Devuelve SOLO un JSON válido (sin markdown):
[
  {
    "pregunta": "¿pregunta representativa?",
    "respuesta": "respuesta completa basada en las conversaciones",
    "categoria": "reservas | precios | tours | disponibilidad | contacto | cancelaciones | general"
  }
]

Máximo 10 entradas. Solo temas con respuestas claras y útiles.`
          }]
        });

        const match = respuesta.content[0].text.match(/\[[\s\S]*\]/);
        if (!match) continue;

        const entradas = JSON.parse(match[0]);

        for (const entrada of entradas) {
          if (!entrada.pregunta || !entrada.respuesta) continue;

          const palabras = entrada.pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 4).slice(0, 3);
          if (palabras.length > 0) {
            const cond = palabras.map((_, i) => `LOWER(pregunta) LIKE $${i + 1}`).join(' AND ');
            const existe = await pool.query(
              `SELECT id FROM conocimiento WHERE ${cond} LIMIT 1`,
              palabras.map(p => `%${p}%`)
            );
            if (existe.rows.length > 0) { duplicadas++; continue; }
          }

          await pool.query(
            'INSERT INTO conocimiento (pregunta, respuesta, categoria) VALUES ($1,$2,$3)',
            [entrada.pregunta, entrada.respuesta, entrada.categoria || 'general']
          );
          extraidas++;
        }

      } catch (err) {
        console.error(`[KNOWLEDGE] Error batch ${batch}:`, err.message);
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[KNOWLEDGE] Completado — entradas creadas: ${extraidas} | duplicadas: ${duplicadas}`);

  } catch (err) {
    console.error('[KNOWLEDGE] Error fatal:', err.message);
  }
}

module.exports = { importarHistorial, extraerConocimiento };
