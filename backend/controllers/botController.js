const { pool } = require('../services/database/db');

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

async function obtenerConversacionesSimple(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 50;

    const resultado = await pool.query(`
      SELECT
        m.id,
        c.kommo_lead_id AS lead_id,
        l.contacto_nombre AS nombre_contacto,
        MAX(CASE WHEN m2.rol = 'cliente' THEN m2.contenido END) AS mensaje_cliente,
        MAX(CASE WHEN m2.rol = 'asistente' THEN m2.contenido END) AS respuesta_bot,
        MAX(m2.creado_en) AS timestamp
      FROM conversaciones c
      LEFT JOIN leads l ON c.lead_id = l.id
      JOIN mensajes m ON m.conversacion_id = c.id
      JOIN mensajes m2 ON m2.conversacion_id = c.id
      WHERE m.error = FALSE
      GROUP BY m.id, c.kommo_lead_id, l.contacto_nombre
      ORDER BY MAX(m2.creado_en) DESC
      LIMIT $1
    `, [limite]);

    res.json({ conversaciones: resultado.rows });
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
}

async function obtenerConversacionesPorPares(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 50;

    const resultado = await pool.query(`
      SELECT
        c.kommo_lead_id AS lead_id,
        l.contacto_nombre AS nombre_contacto,
        mc.contenido AS mensaje_cliente,
        ma.contenido AS respuesta_bot,
        mc.creado_en AS timestamp
      FROM conversaciones c
      LEFT JOIN leads l ON c.lead_id = l.id
      JOIN mensajes mc ON mc.conversacion_id = c.id AND mc.rol = 'cliente'
      LEFT JOIN LATERAL (
        SELECT contenido FROM mensajes
        WHERE conversacion_id = c.id
          AND rol = 'asistente'
          AND creado_en > mc.creado_en
        ORDER BY creado_en ASC
        LIMIT 1
      ) ma ON TRUE
      ORDER BY mc.creado_en DESC
      LIMIT $1
    `, [limite]);

    res.json({ conversaciones: resultado.rows });
  } catch (error) {
    console.error('Error obteniendo conversaciones por pares:', error);
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

module.exports = {
  obtenerEstadoBot,
  toggleBot,
  obtenerConversacionesPorPares,
  obtenerConocimiento,
  crearConocimiento,
  eliminarConocimiento
};
