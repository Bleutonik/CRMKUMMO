const { pool } = require('../services/database/db');
const { generarRespuestaAI } = require('../services/ai/claudeService');

async function obtenerEstadoBot(req, res) {
  try {
    const resultado = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'bot_activo'"
    );
    const activo = resultado.rows[0]?.valor === 'true';
    res.json({ activo });
  } catch (error) {
    console.error('Error obteniendo estado del bot:', error);
    res.status(500).json({ error: 'Error al obtener estado del bot' });
  }
}

async function toggleBot(req, res) {
  try {
    const resultado = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'bot_activo'"
    );
    const estadoActual = resultado.rows[0]?.valor === 'true';
    const nuevoEstado = !estadoActual;

    await pool.query(
      "UPDATE configuracion SET valor = $1, actualizado_en = NOW() WHERE clave = 'bot_activo'",
      [nuevoEstado.toString()]
    );

    console.log(`[BOT] Estado cambiado a: ${nuevoEstado ? 'ACTIVO' : 'INACTIVO'}`);
    res.json({ activo: nuevoEstado });
  } catch (error) {
    console.error('Error cambiando estado del bot:', error);
    res.status(500).json({ error: 'Error al cambiar estado del bot' });
  }
}

async function obtenerConversacionesPorPares(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT
        lead_id,
        contact_name,
        mensaje_cliente,
        respuesta_bot,
        timestamp
      FROM conversations
      ORDER BY timestamp DESC
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
}

async function obtenerConocimiento(req, res) {
  try {
    const resultado = await pool.query(
      'SELECT * FROM conocimiento WHERE activo = TRUE ORDER BY categoria, creado_en DESC'
    );
    res.json({ conocimiento: resultado.rows });
  } catch (error) {
    console.error('Error obteniendo conocimiento:', error);
    res.status(500).json({ error: 'Error al obtener conocimiento' });
  }
}

async function crearConocimiento(req, res) {
  try {
    const { pregunta, respuesta, categoria = 'general' } = req.body;

    if (!pregunta || !respuesta) {
      return res.status(400).json({ error: 'Pregunta y respuesta son requeridas' });
    }

    const resultado = await pool.query(
      'INSERT INTO conocimiento (pregunta, respuesta, categoria) VALUES ($1, $2, $3) RETURNING *',
      [pregunta.trim(), respuesta.trim(), categoria.trim()]
    );

    res.status(201).json({ entrada: resultado.rows[0] });
  } catch (error) {
    console.error('Error creando conocimiento:', error);
    res.status(500).json({ error: 'Error al crear conocimiento' });
  }
}

async function eliminarConocimiento(req, res) {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE conocimiento SET activo = FALSE, actualizado_en = NOW() WHERE id = $1',
      [id]
    );
    res.json({ eliminado: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar conocimiento' });
  }
}

async function probarBot(req, res) {
  const { mensaje } = req.body;
  if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje requerido' });

  console.log('[BOT-TEST] Mensaje recibido:', mensaje.trim().slice(0, 80));
  console.log('[BOT-TEST] CLAUDE_API_KEY presente:', !!process.env.CLAUDE_API_KEY);

  try {
    const respuesta = await generarRespuestaAI(mensaje.trim(), {
      leadId: 'test',
      contactName: 'Prueba'
    });
    console.log('[BOT-TEST] Respuesta generada OK, longitud:', respuesta?.length);
    res.json({ respuesta });
  } catch (error) {
    console.error('[BOT-TEST] Error tipo:', error.constructor?.name);
    console.error('[BOT-TEST] Error mensaje:', error.message);
    console.error('[BOT-TEST] Error stack:', error.stack?.split('\n').slice(0,3).join(' | '));
    res.status(500).json({ error: 'Error generando respuesta', detalle: error.message });
  }
}

module.exports = {
  obtenerEstadoBot,
  toggleBot,
  obtenerConversacionesPorPares,
  obtenerConocimiento,
  crearConocimiento,
  eliminarConocimiento,
  probarBot
};
