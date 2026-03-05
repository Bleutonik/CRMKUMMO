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
    const resultado = await pool.query(
      'SELECT pregunta, respuesta, categoria FROM conocimiento WHERE activo = TRUE ORDER BY categoria'
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

/**
 * Genera una respuesta de IA para el mensaje del cliente.
 * Si CLAUDE_API_KEY no está configurada, devuelve un mensaje de fallback.
 */
async function generarRespuestaAI(mensaje, contexto = {}) {
  // Fallback si no hay API key configurada
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('[AI] CLAUDE_API_KEY no configurada, usando respuesta de fallback');
    return 'Gracias por tu mensaje. Un agente te responderá pronto.';
  }

  try {
    const [promptSistema, conocimiento, historial] = await Promise.all([
      obtenerPromptSistema(),
      obtenerConocimiento(),
      obtenerHistorial(contexto.leadId)
    ]);

    // Construir contexto del lead
    let contextoTexto = '';
    if (contexto.contactName) contextoTexto += `\nContacto: ${contexto.contactName}`;
    if (contexto.etapa)       contextoTexto += `\nEtapa del pipeline: ${contexto.etapa}`;
    if (contexto.pipeline)    contextoTexto += `\nPipeline: ${contexto.pipeline}`;

    const systemPrompt = promptSistema + (contextoTexto ? `\n\nDatos del lead:${contextoTexto}` : '') + conocimiento;

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
    console.error('[AI] Error generando respuesta:', error.message);
    return 'Gracias por tu mensaje. Un agente te responderá pronto.';
  }
}

module.exports = { generarRespuestaAI };
