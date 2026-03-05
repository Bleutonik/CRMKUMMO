const { pool } = require('../services/database/db');

async function obtenerConversaciones(req, res) {
  try {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 20;
    const offset = (pagina - 1) * limite;

    const resultado = await pool.query(`
      SELECT
        c.id,
        c.kommo_lead_id,
        c.total_mensajes,
        c.ultimo_mensaje_en,
        c.estado,
        c.creado_en,
        l.nombre as lead_nombre,
        l.contacto_nombre,
        l.contacto_email,
        (
          SELECT contenido FROM mensajes
          WHERE conversacion_id = c.id
          ORDER BY creado_en DESC LIMIT 1
        ) as ultimo_mensaje
      FROM conversaciones c
      LEFT JOIN leads l ON c.lead_id = l.id
      ORDER BY c.ultimo_mensaje_en DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `, [limite, offset]);

    const total = await pool.query('SELECT COUNT(*) FROM conversaciones');

    res.json({
      conversaciones: resultado.rows,
      paginacion: {
        total: parseInt(total.rows[0].count),
        pagina,
        limite,
        paginas: Math.ceil(total.rows[0].count / limite)
      }
    });
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
}

async function obtenerConversacion(req, res) {
  try {
    const { id } = req.params;

    const conv = await pool.query(`
      SELECT c.*, l.nombre as lead_nombre, l.contacto_nombre, l.contacto_email, l.contacto_telefono
      FROM conversaciones c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.id = $1
    `, [id]);

    if (conv.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const mensajes = await pool.query(`
      SELECT * FROM mensajes
      WHERE conversacion_id = $1
      ORDER BY creado_en ASC
    `, [id]);

    res.json({
      conversacion: conv.rows[0],
      mensajes: mensajes.rows
    });
  } catch (error) {
    console.error('Error obteniendo conversación:', error);
    res.status(500).json({ error: 'Error al obtener la conversación' });
  }
}

async function obtenerLeads(req, res) {
  try {
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 20;
    const offset = (pagina - 1) * limite;

    const resultado = await pool.query(`
      SELECT
        l.*,
        COUNT(c.id) as total_conversaciones,
        SUM(c.total_mensajes) as total_mensajes
      FROM leads l
      LEFT JOIN conversaciones c ON l.id = c.lead_id
      GROUP BY l.id
      ORDER BY l.actualizado_en DESC
      LIMIT $1 OFFSET $2
    `, [limite, offset]);

    const total = await pool.query('SELECT COUNT(*) FROM leads');

    res.json({
      leads: resultado.rows,
      paginacion: {
        total: parseInt(total.rows[0].count),
        pagina,
        limite,
        paginas: Math.ceil(total.rows[0].count / limite)
      }
    });
  } catch (error) {
    console.error('Error obteniendo leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
}

async function obtenerEstadisticas(req, res) {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM leads) as total_leads,
        (SELECT COUNT(*) FROM conversaciones) as total_conversaciones,
        (SELECT COUNT(*) FROM mensajes WHERE rol = 'asistente' AND error = FALSE) as respuestas_ia,
        (SELECT COUNT(*) FROM mensajes WHERE error = TRUE) as total_errores,
        (SELECT ROUND(AVG(tiempo_respuesta_ms)) FROM mensajes WHERE rol = 'asistente' AND error = FALSE) as tiempo_promedio_ms,
        (SELECT ROUND(AVG(tokens_usados)) FROM mensajes WHERE rol = 'asistente' AND error = FALSE) as tokens_promedio,
        (SELECT COUNT(*) FROM conversaciones WHERE creado_en >= NOW() - INTERVAL '24 hours') as conversaciones_hoy,
        (SELECT COUNT(*) FROM mensajes WHERE creado_en >= NOW() - INTERVAL '24 hours' AND rol = 'asistente') as respuestas_hoy
    `);

    // Actividad por hora (últimas 24 horas)
    const actividad = await pool.query(`
      SELECT
        DATE_TRUNC('hour', creado_en) as hora,
        COUNT(*) as mensajes
      FROM mensajes
      WHERE creado_en >= NOW() - INTERVAL '24 hours'
      GROUP BY hora
      ORDER BY hora
    `);

    res.json({
      resumen: stats.rows[0],
      actividadPorHora: actividad.rows
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

async function obtenerConfiguracion(req, res) {
  try {
    const resultado = await pool.query('SELECT * FROM configuracion ORDER BY clave');
    res.json({ configuracion: resultado.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
}

async function actualizarConfiguracion(req, res) {
  try {
    const { clave, valor } = req.body;

    if (!clave || valor === undefined) {
      return res.status(400).json({ error: 'Clave y valor son requeridos' });
    }

    await pool.query(`
      INSERT INTO configuracion (clave, valor, actualizado_en)
      VALUES ($1, $2, NOW())
      ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_en = NOW()
    `, [clave, valor]);

    res.json({ exito: true, mensaje: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
}

module.exports = {
  obtenerConversaciones,
  obtenerConversacion,
  obtenerLeads,
  obtenerEstadisticas,
  obtenerConfiguracion,
  actualizarConfiguracion
};
