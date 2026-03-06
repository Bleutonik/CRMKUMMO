const { pool } = require('../services/database/db');

async function obtenerAlertas(req, res) {
  try {
    const resultado = await pool.query(`
      SELECT id, lead_id, contact_name, mensaje_cliente, respuesta_bot, tipo, leida, timestamp
      FROM alertas
      ORDER BY timestamp DESC
      LIMIT 50
    `);
    const noLeidas = resultado.rows.filter(a => !a.leida).length;
    res.json({ alertas: resultado.rows, noLeidas });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo alertas' });
  }
}

async function marcarLeida(req, res) {
  try {
    const { id } = req.params;
    await pool.query('UPDATE alertas SET leida = TRUE WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error marcando alerta' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    await pool.query('UPDATE alertas SET leida = TRUE WHERE leida = FALSE');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error marcando alertas' });
  }
}

module.exports = { obtenerAlertas, marcarLeida, marcarTodasLeidas };
