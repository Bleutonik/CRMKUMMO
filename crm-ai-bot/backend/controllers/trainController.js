const { Pool } = require('pg');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Lee leads directamente de Kommo y extrae conocimiento con Claude.
 * NO guarda conversaciones en la DB — va directo a la tabla conocimiento.
 */
async function entrenarDesdeKommo(req, res) {
  res.json({ ok: true, mensaje: 'Entrenamiento iniciado. Revisa los logs de Railway.' });

  console.log('[TRAIN] Iniciando entrenamiento directo desde Kommo...');

  const _sub = process.env.KOMMO_SUBDOMAIN || '';
  const kommoBaseUrl = process.env.KOMMO_BASE_URL
    || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
  const kommoToken = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

  const http = axios.create({
    baseURL: kommoBaseUrl,
    headers: { Authorization: `Bearer ${kommoToken}` },
    timeout: 8000
  });

  let pagina = 1;
  const limite = 250;
  let extraidas = 0;
  let paginasProcesadas = 0;
  const LEADS_POR_BATCH_CLAUDE = 30; // analizar cada 30 leads con Claude
  let bufferTexto = [];

  async function analizarConClaude(textos) {
    if (textos.length === 0) return;
    try {
      const contenido = textos.join('\n\n---\n\n');
      const respuesta = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Analiza estas conversaciones reales de una empresa de tours/viajes en Puerto Rico.

CONVERSACIONES:
${contenido}

Identifica los temas más frecuentes y escribe respuestas útiles basadas en cómo respondieron los agentes.

Devuelve SOLO un JSON válido (sin markdown, sin explicaciones):
[
  {
    "pregunta": "pregunta representativa del cliente",
    "respuesta": "respuesta completa y útil del agente",
    "categoria": "reservas | precios | tours | disponibilidad | contacto | cancelaciones | general"
  }
]

Máximo 8 entradas. Solo incluye temas con respuestas claras y útiles. Si no hay suficiente contenido útil, devuelve [].`
        }]
      });

      const match = respuesta.content[0].text.match(/\[[\s\S]*\]/);
      if (!match) return;

      const entradas = JSON.parse(match[0]);
      for (const entrada of entradas) {
        if (!entrada.pregunta || !entrada.respuesta) continue;

        // Deduplicar por similitud de palabras clave
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
        extraidas++;
      }
      console.log(`[TRAIN] Claude extrajo ${entradas.length} entradas — total acumulado: ${extraidas}`);
    } catch (err) {
      console.error('[TRAIN] Error Claude:', err.message);
    }
  }

  try {
    while (true) {
      // Obtener página de leads
      let leads = [];
      try {
        const res = await http.get('/api/v4/leads', {
          params: { page: pagina, limit: limite, with: 'contacts' }
        });
        leads = res.data?._embedded?.leads || [];
      } catch (e) {
        if (e.response?.status === 204 || e.response?.status === 404) break;
        console.error(`[TRAIN] Error página ${pagina} — saltando:`, e.message);
        pagina++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (leads.length === 0) break;
      console.log(`[TRAIN] Página ${pagina} — ${leads.length} leads`);

      for (const lead of leads) {
        // Obtener notas (sin retry, timeout corto)
        let notas = [];
        try {
          const res = await http.get(`/api/v4/leads/${lead.id}/notes`, { params: { limit: 250 } });
          notas = res.data?._embedded?.notes || [];
        } catch {
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        // Extraer texto útil de las notas
        const textoLead = notas
          .filter(n => [4, 25, 26].includes(n.note_type) && n.params?.text?.trim())
          .map(n => {
            const tipo = n.note_type === 25 ? 'Cliente' : n.note_type === 26 ? 'Agente' : 'Nota';
            return `${tipo}: ${n.params.text.trim()}`;
          })
          .join('\n');

        if (textoLead.length > 50) {
          const contacto = lead._embedded?.contacts?.[0]?.name || 'Cliente';
          bufferTexto.push(`[Lead ${lead.id} - ${contacto}]\n${textoLead}`);
        }

        // Cada LEADS_POR_BATCH_CLAUDE leads con texto, analizar con Claude
        if (bufferTexto.length >= LEADS_POR_BATCH_CLAUDE) {
          await analizarConClaude(bufferTexto);
          bufferTexto = [];
          await new Promise(r => setTimeout(r, 1000)); // pausa después de Claude
        }

        await new Promise(r => setTimeout(r, 120)); // 120ms entre leads
      }

      paginasProcesadas++;
      console.log(`[TRAIN] Página ${pagina} procesada (${paginasProcesadas} páginas | ${extraidas} conocimientos extraídos)`);

      if (leads.length < limite) break;
      pagina++;
      await new Promise(r => setTimeout(r, 400));
    }

    // Procesar buffer restante
    if (bufferTexto.length > 0) {
      await analizarConClaude(bufferTexto);
    }

    console.log(`[TRAIN] ✅ Entrenamiento completado — conocimientos extraídos: ${extraidas} | páginas procesadas: ${paginasProcesadas}`);

  } catch (err) {
    console.error('[TRAIN] Error fatal:', err.message);
  }
}

module.exports = { entrenarDesdeKommo };
