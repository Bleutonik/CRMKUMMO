const { Pool } = require('pg');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Extrae texto legible de una nota de Kommo según su tipo.
 */
function extraerTextoNota(nota) {
  const texto = nota.params?.text;
  if (!texto) return null;

  // Tipo 15 = email (texto es un JSON con content_summary)
  if (nota.note_type === 15) {
    try {
      const obj = typeof texto === 'string' ? JSON.parse(texto) : texto;
      const resumen = obj.content_summary || obj.subject || '';
      const de = obj.from?.name || obj.from?.email || '';
      if (resumen.length < 10) return null;
      return de ? `De: ${de}\n${resumen}` : resumen;
    } catch { return null; }
  }

  // Tipos 4, 25, 26, 102 y otros con texto plano
  const str = typeof texto === 'string' ? texto.trim() : String(texto).trim();
  return str.length > 10 ? str : null;
}

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
  const LEADS_POR_BATCH = 20;
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
          content: `Analiza estas conversaciones/emails reales de una empresa de tours y viajes en Puerto Rico (Fix A Trip).

CONVERSACIONES:
${contenido}

Identifica preguntas frecuentes de clientes y cómo responden los agentes. Extrae conocimiento útil para un bot de WhatsApp.

Devuelve SOLO un JSON válido (sin markdown, sin texto antes ni después):
[
  {
    "pregunta": "pregunta representativa del cliente",
    "respuesta": "respuesta completa y útil del agente",
    "categoria": "reservas | precios | tours | disponibilidad | contacto | cancelaciones | general"
  }
]

Máximo 8 entradas. Si no hay contenido útil para un bot, devuelve [].`
        }]
      });

      const match = respuesta.content[0].text.match(/\[[\s\S]*\]/);
      if (!match) return;

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
          if (existe.rows.length > 0) continue;
        }

        await pool.query(
          'INSERT INTO conocimiento (pregunta, respuesta, categoria) VALUES ($1,$2,$3)',
          [entrada.pregunta, entrada.respuesta, entrada.categoria || 'general']
        );
        extraidas++;
      }
      console.log(`[TRAIN] Claude procesó ${textos.length} leads → ${entradas.length} entradas nuevas (total: ${extraidas})`);
    } catch (err) {
      console.error('[TRAIN] Error Claude:', err.message);
    }
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
        if (e.response?.status === 204 || e.response?.status === 404) break;
        console.error(`[TRAIN] Error página ${pagina} — saltando:`, e.message);
        pagina++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (leads.length === 0) break;
      console.log(`[TRAIN] Página ${pagina} — ${leads.length} leads`);

      for (const lead of leads) {
        let notas = [];
        try {
          const res = await http.get(`/api/v4/leads/${lead.id}/notes`, { params: { limit: 250 } });
          notas = res.data?._embedded?.notes || [];
        } catch {
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        // Extraer texto de TODOS los tipos de notas relevantes
        const lineas = notas
          .sort((a, b) => a.created_at - b.created_at)
          .map(n => {
            const texto = extraerTextoNota(n);
            if (!texto) return null;
            const tipo = n.note_type === 25 ? 'Cliente'
              : n.note_type === 26 ? 'Agente'
              : n.note_type === 15 ? 'Email'
              : n.note_type === 4  ? 'Nota'
              : null;
            return tipo ? `${tipo}: ${texto}` : null;
          })
          .filter(Boolean);

        if (lineas.length > 0) {
          const contacto = lead._embedded?.contacts?.[0]?.name || 'Cliente';
          bufferTexto.push(`[${contacto}]\n${lineas.join('\n')}`);
        }

        if (bufferTexto.length >= LEADS_POR_BATCH) {
          await analizarConClaude(bufferTexto);
          bufferTexto = [];
          await new Promise(r => setTimeout(r, 1500));
        }

        await new Promise(r => setTimeout(r, 120));
      }

      paginasProcesadas++;
      console.log(`[TRAIN] Página ${pagina} procesada — leads con texto: ${bufferTexto.length} en buffer | total extraídas: ${extraidas}`);

      if (leads.length < limite) break;
      pagina++;
      await new Promise(r => setTimeout(r, 400));
    }

    // Procesar buffer restante
    if (bufferTexto.length > 0) {
      console.log(`[TRAIN] Procesando buffer final: ${bufferTexto.length} leads`);
      await analizarConClaude(bufferTexto);
    }

    console.log(`[TRAIN] ✅ Completado — conocimientos extraídos: ${extraidas} | páginas: ${paginasProcesadas}`);

  } catch (err) {
    console.error('[TRAIN] Error fatal:', err.message);
  }
}

module.exports = { entrenarDesdeKommo };
