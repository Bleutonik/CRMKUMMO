const { Pool } = require('pg');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Mapeo de tipos de nota de Kommo a etiquetas legibles.
 * Los tipos pares/impares suelen ser entrante/saliente.
 * Si el tipo no está en el mapa, se usa 'Mensaje' por defecto
 * para no perder conversaciones de canales desconocidos.
 */
const TIPO_ETIQUETA = {
  4:   'Nota',        // nota común (agente)
  12:  'Llamada',     // llamada entrante
  13:  'Llamada',     // llamada saliente
  15:  'Email',       // email
  25:  'Cliente',     // mensaje entrante (WhatsApp, SMS, cualquier canal)
  26:  'Agente',      // mensaje saliente (WhatsApp, SMS, cualquier canal)
  102: 'Cliente',     // Kommo Talk / chat / SMS entrante
  103: 'Agente',      // Kommo Talk / chat / SMS saliente
};

/**
 * Extrae texto legible de cualquier nota de Kommo.
 * Intenta extraer de params.text, params.note, text, body, o contenido embebido.
 */
function extraerTextoNota(nota) {
  // Intentar todas las rutas posibles de texto
  const candidatos = [
    nota.params?.text,
    nota.params?.note,
    nota.text,
    nota.body,
  ];

  for (const candidato of candidatos) {
    if (!candidato) continue;

    // Email: texto es JSON con content_summary
    if (nota.note_type === 15) {
      try {
        const obj = typeof candidato === 'string' ? JSON.parse(candidato) : candidato;
        const resumen = obj.content_summary || obj.subject || obj.body || '';
        const de = obj.from?.name || obj.from?.email || '';
        const texto = resumen.trim();
        if (texto.length >= 10) return de ? `De: ${de} — ${texto}` : texto;
      } catch {}
      // Si no es JSON válido, usar el texto directamente
    }

    // Texto plano
    const str = typeof candidato === 'string' ? candidato.trim() : String(candidato).trim();

    // Ignorar prefijo del bot propio para no aprender bucles
    if (str.startsWith('🤖 Asistente IA:')) continue;

    if (str.length >= 5) return str;
  }

  return null;
}

/**
 * Determina la etiqueta de dirección de una nota.
 * Si no es un tipo conocido pero tiene texto, lo incluye como 'Mensaje'
 * para no perder datos de canales que no están en el mapa.
 */
function etiquetaNota(nota) {
  return TIPO_ETIQUETA[nota.note_type] || 'Mensaje';
}

/**
 * Guarda entradas de conocimiento extraídas por Claude en la DB,
 * evitando duplicados por similitud de pregunta.
 */
async function guardarEntradas(entradas) {
  let nuevas = 0;
  for (const entrada of entradas) {
    if (!entrada.pregunta || !entrada.respuesta) continue;
    const palabras = entrada.pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 4).slice(0, 3);
    if (palabras.length > 0) {
      const cond = palabras.map((_, i) => `LOWER(pregunta) LIKE $${i + 1}`).join(' AND ');
      const existe = await pool.query(
        `SELECT id FROM conocimiento WHERE ${cond} LIMIT 1`,
        palabras.map(p => `%${p}%`)
      );
      if (existe.rows.length > 0) continue;
    }
    await pool.query(
      'INSERT INTO conocimiento (pregunta, respuesta, categoria) VALUES ($1,$2,$3)',
      [entrada.pregunta, entrada.respuesta, entrada.categoria || 'general']
    );
    nuevas++;
  }
  return nuevas;
}

/**
 * Envía un lote de conversaciones a Claude para extraer conocimiento.
 */
async function analizarConClaude(textos) {
  if (textos.length === 0) return 0;
  try {
    const contenido = textos.join('\n\n---\n\n');
    const respuesta = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analiza estas conversaciones reales de una empresa de viajes llamada Fix A Trip (Puerto Rico).
Los mensajes pueden ser de WhatsApp, SMS, email, notas internas o llamadas.

CONVERSACIONES:
${contenido}

Tu tarea: identificar qué preguntan los clientes y cómo responden los agentes. Extrae ese conocimiento para que un bot pueda responder automáticamente en el futuro.

Devuelve SOLO un JSON válido (sin markdown, sin texto antes ni después):
[
  {
    "pregunta": "pregunta o solicitud representativa del cliente",
    "respuesta": "respuesta completa y útil que daría el agente",
    "categoria": "reservas | precios | tours | disponibilidad | contacto | cancelaciones | itinerario | general"
  }
]

Máximo 10 entradas. Si no hay contenido útil para responder clientes, devuelve [].
Prioriza situaciones que se repiten o que son comunes en viajes y reservas.`
      }]
    });

    const match = respuesta.content[0].text.match(/\[[\s\S]*\]/);
    if (!match) return 0;

    const entradas = JSON.parse(match[0]);
    return await guardarEntradas(entradas);
  } catch (err) {
    console.error('[TRAIN] Error Claude:', err.message);
    return 0;
  }
}

/**
 * Lee todos los leads de Kommo (todas las páginas) y extrae conocimiento con Claude.
 * Captura TODOS los tipos de nota/mensaje, no solo WhatsApp.
 */
async function entrenarDesdeKommo(req, res) {
  res.json({ ok: true, mensaje: 'Entrenamiento iniciado. Revisa los logs de Railway.' });

  console.log('[TRAIN] Iniciando entrenamiento completo desde Kommo...');

  const _sub = process.env.KOMMO_SUBDOMAIN || '';
  const kommoBaseUrl = process.env.KOMMO_BASE_URL
    || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
  const kommoToken = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

  const http = axios.create({
    baseURL: kommoBaseUrl,
    headers: { Authorization: `Bearer ${kommoToken}` },
    timeout: 12000
  });

  let pagina = 1;
  const limite = 250;
  let totalExtraidas = 0;
  let totalLeadsProcesados = 0;
  let totalLeadsConMensajes = 0;
  const BATCH = 20;
  let buffer = [];

  try {
    while (true) {
      // Obtener página de leads (sin 'with' para evitar 404)
      let leads = [];
      try {
        const r = await http.get('/api/v4/leads', {
          params: { page: pagina, limit: limite, order: { created_at: 'desc' } }
        });
        leads = r.data?._embedded?.leads || [];
      } catch (e) {
        if (e.response?.status === 204 || e.response?.status === 404) break;
        console.error(`[TRAIN] Error página ${pagina}:`, e.message);
        pagina++;
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      if (leads.length === 0) break;
      console.log(`[TRAIN] Página ${pagina} — ${leads.length} leads`);

      for (const lead of leads) {
        totalLeadsProcesados++;

        // Obtener nombre del lead (sin 'with' para contactos)
        const nombreLead = lead.name || `Lead ${lead.id}`;

        // Obtener TODAS las notas del lead
        let notas = [];
        try {
          const r = await http.get(`/api/v4/leads/${lead.id}/notes`, { params: { limit: 250 } });
          notas = r.data?._embedded?.notes || [];
        } catch {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }

        if (notas.length === 0) continue;

        // Extraer texto de TODAS las notas con contenido
        const lineas = notas
          .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
          .map(nota => {
            const texto = extraerTextoNota(nota);
            if (!texto) return null;
            const etiqueta = etiquetaNota(nota);
            return `${etiqueta}: ${texto}`;
          })
          .filter(Boolean);

        if (lineas.length < 2) continue; // al menos 2 mensajes para que tenga contexto

        totalLeadsConMensajes++;
        buffer.push(`[Lead: ${nombreLead}]\n${lineas.join('\n')}`);

        // Procesar en lotes de 20
        if (buffer.length >= BATCH) {
          const extraidas = await analizarConClaude(buffer);
          totalExtraidas += extraidas;
          buffer = [];
          console.log(`[TRAIN] Lote procesado — nuevas entradas: ${extraidas} | total acumulado: ${totalExtraidas}`);
          await new Promise(r => setTimeout(r, 2000));
        }

        await new Promise(r => setTimeout(r, 150));
      }

      if (leads.length < limite) break;
      pagina++;
      await new Promise(r => setTimeout(r, 500));
    }

    // Procesar buffer restante
    if (buffer.length > 0) {
      console.log(`[TRAIN] Procesando buffer final: ${buffer.length} leads`);
      const extraidas = await analizarConClaude(buffer);
      totalExtraidas += extraidas;
    }

    console.log(`[TRAIN] ✅ Completado — leads procesados: ${totalLeadsProcesados} | con mensajes: ${totalLeadsConMensajes} | conocimientos extraídos: ${totalExtraidas}`);

  } catch (err) {
    console.error('[TRAIN] Error fatal:', err.message);
  }
}

/**
 * Analiza las conversaciones guardadas en la DB (conversations table)
 * y extrae conocimiento adicional. Corre en background.
 */
async function aprenderDeConversacionesDB(req, res) {
  res.json({ ok: true, mensaje: 'Aprendizaje desde historial DB iniciado. Revisa los logs de Railway.' });

  console.log('[TRAIN-DB] Iniciando análisis de conversaciones en DB...');

  try {
    const resultado = await pool.query(`
      SELECT lead_id, contact_name, mensaje_cliente, respuesta_bot
      FROM conversations
      WHERE respuesta_bot IS NOT NULL
        AND LENGTH(respuesta_bot) > 20
        AND LENGTH(mensaje_cliente) > 3
      ORDER BY timestamp DESC
      LIMIT 500
    `);

    if (resultado.rows.length === 0) {
      console.log('[TRAIN-DB] Sin conversaciones en DB para analizar.');
      return;
    }

    console.log(`[TRAIN-DB] ${resultado.rows.length} pares encontrados. Analizando...`);

    // Agrupar por lead para contexto coherente
    const porLead = {};
    for (const row of resultado.rows) {
      if (!porLead[row.lead_id]) porLead[row.lead_id] = [];
      porLead[row.lead_id].push(row);
    }

    const leads = Object.values(porLead);
    let totalExtraidas = 0;
    const BATCH = 15;

    for (let i = 0; i < leads.length; i += BATCH) {
      const lote = leads.slice(i, i + BATCH);
      const textos = lote.map(conv => {
        const nombre = conv[0].contact_name || 'Cliente';
        const lineas = conv.map(r =>
          `Cliente: ${r.mensaje_cliente}\nAsistente: ${r.respuesta_bot}`
        ).join('\n');
        return `[${nombre}]\n${lineas}`;
      });

      const extraidas = await analizarConClaude(textos);
      totalExtraidas += extraidas;
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[TRAIN-DB] ✅ Completado — conocimientos extraídos de DB: ${totalExtraidas}`);
  } catch (err) {
    console.error('[TRAIN-DB] Error fatal:', err.message);
  }
}

module.exports = { entrenarDesdeKommo, aprenderDeConversacionesDB };
