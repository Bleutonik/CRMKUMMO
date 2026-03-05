const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function inicializarDB() {
  const cliente = await pool.connect();
  try {
    console.log('Conectando a la base de datos...');

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        kommo_lead_id INTEGER UNIQUE NOT NULL,
        nombre VARCHAR(255),
        contacto_nombre VARCHAR(255),
        contacto_email VARCHAR(255),
        contacto_telefono VARCHAR(50),
        estado VARCHAR(100) DEFAULT 'activo',
        pipeline VARCHAR(255),
        etapa VARCHAR(255),
        responsable VARCHAR(255),
        creado_en TIMESTAMP DEFAULT NOW(),
        actualizado_en TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS conversaciones (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        kommo_lead_id INTEGER NOT NULL,
        total_mensajes INTEGER DEFAULT 0,
        ultimo_mensaje_en TIMESTAMP,
        estado VARCHAR(50) DEFAULT 'activa',
        creado_en TIMESTAMP DEFAULT NOW(),
        actualizado_en TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS mensajes (
        id SERIAL PRIMARY KEY,
        conversacion_id INTEGER REFERENCES conversaciones(id) ON DELETE CASCADE,
        kommo_lead_id INTEGER NOT NULL,
        rol VARCHAR(20) NOT NULL CHECK (rol IN ('cliente', 'asistente', 'sistema')),
        contenido TEXT NOT NULL,
        tokens_usados INTEGER DEFAULT 0,
        tiempo_respuesta_ms INTEGER,
        error BOOLEAN DEFAULT FALSE,
        detalle_error TEXT,
        creado_en TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        descripcion TEXT,
        actualizado_en TIMESTAMP DEFAULT NOW()
      )
    `);

    // Prompt del sistema por defecto
    await cliente.query(`
      INSERT INTO configuracion (clave, valor, descripcion)
      VALUES (
        'prompt_sistema',
        'Eres un asistente de ventas profesional y amigable para una empresa de tours en barco. Tu objetivo es ayudar a los clientes con información sobre tours disponibles, precios, disponibilidad y reservas. Responde siempre en el mismo idioma que el cliente. Sé conciso, útil y orientado a cerrar la venta. Si no tienes información específica, ofrece conectar al cliente con un agente humano.',
        'Prompt principal del asistente IA'
      )
      ON CONFLICT (clave) DO NOTHING
    `);

    // Índices para mejorar rendimiento
    await cliente.query(`
      CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_id ON mensajes(conversacion_id);
      CREATE INDEX IF NOT EXISTS idx_conversaciones_kommo_lead_id ON conversaciones(kommo_lead_id);
      CREATE INDEX IF NOT EXISTS idx_leads_kommo_lead_id ON leads(kommo_lead_id);
    `);

    console.log('Base de datos inicializada correctamente');
  } finally {
    cliente.release();
  }
}

module.exports = { pool, inicializarDB };
