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

async function obtenerHistorialConversacion(kommoLeadId, limite = 10) {
  try {
    const resultado = await pool.query(`
      SELECT m.rol, m.contenido
      FROM mensajes m
      JOIN conversaciones c ON m.conversacion_id = c.id
      WHERE c.kommo_lead_id = $1
        AND m.error = FALSE
      ORDER BY m.creado_en DESC
      LIMIT $2
    `, [kommoLeadId, limite]);

    // Invertir para orden cronológico
    return resultado.rows.reverse().map(fila => ({
      role: fila.rol === 'cliente' ? 'user' : 'assistant',
      content: fila.contenido
    }));
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return [];
  }
}

async function generarRespuesta(mensajeCliente, kommoLeadId, contextoLead = {}) {
  const inicio = Date.now();

  try {
    const promptSistema = await obtenerPromptSistema();
    const historial = await obtenerHistorialConversacion(kommoLeadId);

    // Construir contexto del lead si existe
    let contextoTexto = '';
    if (contextoLead.nombre) {
      contextoTexto = `\n\nInformación del lead:\n- Nombre: ${contextoLead.nombre}`;
      if (contextoLead.etapa) contextoTexto += `\n- Etapa del pipeline: ${contextoLead.etapa}`;
      if (contextoLead.responsable) contextoTexto += `\n- Responsable: ${contextoLead.responsable}`;
    }

    const mensajes = [
      ...historial,
      { role: 'user', content: mensajeCliente }
    ];

    const respuesta = await cliente.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: promptSistema + contextoTexto,
      messages: mensajes
    });

    const tiempoMs = Date.now() - inicio;
    const textoRespuesta = respuesta.content[0].text;
    const tokensUsados = respuesta.usage.input_tokens + respuesta.usage.output_tokens;

    return {
      texto: textoRespuesta,
      tokensUsados,
      tiempoMs,
      error: false
    };

  } catch (error) {
    console.error('Error en Claude API:', error);
    return {
      texto: null,
      tokensUsados: 0,
      tiempoMs: Date.now() - inicio,
      error: true,
      detalleError: error.message
    };
  }
}

module.exports = { generarRespuesta };
