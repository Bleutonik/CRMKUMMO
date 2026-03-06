const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../database/db');

const cliente = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

async function obtenerPromptSistema() {
  try {
    const resultado = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'prompt_sistema'"
    );
    return resultado.rows[0]?.valor || 'Eres un asistente de ventas profesional y amigable.';
  } catch {
    return 'Eres un asistente de ventas profesional y amigable.';
  }
}

async function obtenerConocimiento() {
  try {
    // Máximo 12 entradas generales para no saturar el prompt
    const resultado = await pool.query(
      'SELECT pregunta, respuesta, categoria FROM conocimiento WHERE activo = TRUE ORDER BY categoria, creado_en DESC LIMIT 12'
    );
    if (resultado.rows.length === 0) return '';
    const entradas = resultado.rows.map(r =>
      `[${r.categoria.toUpperCase()}] P: ${r.pregunta}\nR: ${r.respuesta}`
    ).join('\n\n');
    return `\n\n--- BASE DE CONOCIMIENTO ---\n${entradas}\n--- FIN BASE DE CONOCIMIENTO ---`;
  } catch {
    return '';
  }
}

// Historial reciente del lead actual (últimos intercambios)
async function obtenerHistorial(leadId, limite = 10) {
  try {
    const resultado = await pool.query(`
      SELECT mensaje_cliente, respuesta_bot
      FROM conversations
      WHERE lead_id = $1
        AND respuesta_bot IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT $2
    `, [leadId, limite]);

    return resultado.rows.reverse().flatMap(r => [
      { role: 'user',      content: r.mensaje_cliente },
      { role: 'assistant', content: r.respuesta_bot }
    ]);
  } catch {
    return [];
  }
}

// Ejemplos similares de conversaciones reales — busca por palabras clave
async function obtenerEjemplosRelevantes(mensaje, leadIdActual, limite = 6) {
  try {
    // Extraer palabras clave del mensaje (mínimo 4 caracteres)
    const palabras = mensaje
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/gi, '')
      .split(/\s+/)
      .filter(p => p.length >= 4);

    if (palabras.length === 0) return '';

    // Buscar en conversations (mensajes reales de WhatsApp/chat)
    const condiciones = palabras.slice(0, 6).map((p, i) =>
      `(LOWER(mensaje_cliente) LIKE $${i + 2} OR LOWER(respuesta_bot) LIKE $${i + 2})`
    ).join(' OR ');

    const params = [
      leadIdActual || '0',
      ...palabras.slice(0, 6).map(p => `%${p}%`)
    ];

    const resultado = await pool.query(`
      SELECT mensaje_cliente, respuesta_bot
      FROM conversations
      WHERE lead_id != $1
        AND respuesta_bot IS NOT NULL
        AND LENGTH(respuesta_bot) > 10
        AND (${condiciones})
      ORDER BY timestamp DESC
      LIMIT ${limite}
    `, params);

    if (resultado.rows.length === 0) return '';

    const ejemplos = resultado.rows.map((r, i) =>
      `Ejemplo ${i + 1}:\nCliente: ${r.mensaje_cliente}\nAgente: ${r.respuesta_bot}`
    ).join('\n\n');

    return `\n\n--- EJEMPLOS DE CONVERSACIONES REALES (usa este estilo y tono para responder) ---\n${ejemplos}\n--- FIN EJEMPLOS ---`;

  } catch {
    return '';
  }
}

// Conocimiento relevante por palabras clave del mensaje actual
async function obtenerConocimientoRelevante(mensaje) {
  try {
    const palabras = mensaje
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/gi, '')
      .split(/\s+/)
      .filter(p => p.length >= 4)
      .slice(0, 5);

    if (palabras.length === 0) return '';

    const condiciones = palabras.map((p, i) =>
      `(LOWER(pregunta) LIKE $${i + 1} OR LOWER(respuesta) LIKE $${i + 1})`
    ).join(' OR ');

    const resultado = await pool.query(`
      SELECT pregunta, respuesta, categoria
      FROM conocimiento
      WHERE activo = TRUE AND (${condiciones})
      ORDER BY creado_en DESC
      LIMIT 5
    `, palabras.map(p => `%${p}%`));

    if (resultado.rows.length === 0) return '';

    const entradas = resultado.rows.map(r =>
      `[${r.categoria.toUpperCase()}] P: ${r.pregunta}\nR: ${r.respuesta}`
    ).join('\n\n');

    return `\n\n--- CONOCIMIENTO RELEVANTE PARA ESTA CONSULTA ---\n${entradas}\n--- FIN ---`;
  } catch {
    return '';
  }
}

/**
 * Genera una respuesta de IA para el mensaje del cliente.
 */
async function generarRespuestaAI(mensaje, contexto = {}) {
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('[AI] CLAUDE_API_KEY no configurada, usando respuesta de fallback');
    return 'Gracias por tu mensaje. Un agente te responderá pronto.';
  }

  let promptSistema = 'Eres un asistente de ventas profesional y amigable.';
  try {
    console.log('[AI] Iniciando generarRespuestaAI para lead:', contexto.leadId);
    const [_prompt, conocimientoGeneral, historial, ejemplos, conocimientoRelevante] = await Promise.all([
      obtenerPromptSistema(),
      obtenerConocimiento(),
      obtenerHistorial(contexto.leadId),
      obtenerEjemplosRelevantes(mensaje, contexto.leadId),
      obtenerConocimientoRelevante(mensaje)
    ]);
    promptSistema = _prompt;
    console.log('[AI] Contexto cargado. Llamando a Claude...');

    // Construir contexto completo del lead/contacto
    let contextoTexto = '';
    if (contexto.contactName) contextoTexto += `\nContacto: ${contexto.contactName}`;
    if (contexto.telefono)    contextoTexto += `\nTeléfono: ${contexto.telefono}`;
    if (contexto.email)       contextoTexto += `\nEmail: ${contexto.email}`;
    if (contexto.nombre)      contextoTexto += `\nNombre del lead: ${contexto.nombre}`;
    if (contexto.etapa)       contextoTexto += `\nEtapa del pipeline: ${contexto.etapa}`;
    if (contexto.pipeline)    contextoTexto += `\nPipeline ID: ${contexto.pipeline}`;

    // El system prompt combina: prompt base + contexto lead + conocimiento general +
    // ejemplos similares + conocimiento específico relevante al mensaje
    const systemPrompt = promptSistema
      + (contextoTexto ? `\n\nDatos del contacto:${contextoTexto}` : '')
      + conocimientoGeneral
      + (conocimientoRelevante || '')
      + (ejemplos || '');

    const respuesta = await cliente.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...historial,
        { role: 'user', content: mensaje }
      ]
    });

    return respuesta.content[0].text;

  } catch (error) {
    // Rate limit: esperar 1 segundo y reintentar una vez
    if (error?.status === 429) {
      console.warn('[AI] Rate limit alcanzado, reintentando en 2s...');
      await new Promise(r => setTimeout(r, 2000));
      try {
        const retry = await cliente.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: promptSistema,   // usar solo el prompt base en el reintento
          messages: [{ role: 'user', content: mensaje }]
        });
        return retry.content[0].text;
      } catch {
        return 'En este momento hay mucha demanda. Por favor intenta en unos segundos.';
      }
    }
    console.error('[AI] Error generando respuesta:', error.message);
    return 'Gracias por tu mensaje. Un agente te responderá pronto.';
  }
}

module.exports = { generarRespuestaAI };
