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

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS conocimiento (
        id SERIAL PRIMARY KEY,
        pregunta TEXT NOT NULL,
        respuesta TEXT NOT NULL,
        categoria VARCHAR(100) DEFAULT 'general',
        activo BOOLEAN DEFAULT TRUE,
        creado_en TIMESTAMP DEFAULT NOW(),
        actualizado_en TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id TEXT,
        contact_name TEXT,
        mensaje_cliente TEXT,
        respuesta_bot TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
    `);

    const promptFixATrip = [
      'Eres el asistente virtual de Fix A Trip, la agencia de experiencias y tours #1 en Puerto Rico. Reservamos experiencias unicas en la Isla del Encanto.',
      '',
      'EMPRESA:',
      '- Nombre: Fix A Trip Puerto Rico',
      '- Telefono: +1 787 488 0202',
      '- Email: bookings@fixatrippr.com',
      '- Web: fixatrippuertorico.com',
      '- Ubicacion: San Juan, Puerto Rico',
      '',
      'SERVICIOS QUE OFRECEMOS:',
      '- Tours de aventura: ATV, zipline, jet ski, equitacion',
      '- Tours de naturaleza: El Yunque, cascadas, toboganes naturales',
      '- Paseos en barco: catamaran, snorkel, pesca deportiva',
      '- Tours culturales: Old San Juan, destilerias de ron',
      '- Vida nocturna: bar hopping, tours al atardecer',
      '- Servicios adicionales: Fix A Boat, Fix A Chef, Fix A Transport, Fix A Wellness',
      '',
      'TOURS POPULARES CON PRECIOS:',
      '- Bahia Bioluminiscente: $59-$100 | 2 horas | Fajardo',
      '- Culebra Island Beach & Snorkel: $165 | 6 horas | Marina Fajardo',
      '- El Yunque Off the Beaten Path: $85 | 7 horas | Ceiba',
      '- Cascadas y tobogan natural: $65 | 5 horas | El Yunque',
      '- Old San Juan Historical Walk: $45 | 2 horas | Plaza Colon',
      '',
      'DESTINOS: Old San Juan, El Yunque, Culebra, Fajardo, Luquillo, Vieques, Icacos',
      '',
      'COMO COMPORTARTE:',
      '- Responde SIEMPRE en el mismo idioma que el cliente (español o ingles)',
      '- Se amigable, entusiasta y orientado a cerrar la venta',
      '- Cuando el cliente pregunta por un tour, da precio, duracion y que incluye',
      '- Pregunta siempre: fecha, numero de personas y si necesitan transporte',
      '- Si no tienes disponibilidad exacta, di que un agente confirmara en breve',
      '- Para reservar: pide nombre completo, fecha, numero de personas y telefono',
      '- No inventes precios que no conozcas — ofrece que un agente de el detalle',
      '- Cuando el cliente quiera reservar, recoge sus datos y confirma que un agente lo contactara'
    ].join('\n');

    await cliente.query(
      `INSERT INTO configuracion (clave, valor, descripcion)
       VALUES ($1, $2, $3)
       ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_en = NOW()`,
      ['prompt_sistema', promptFixATrip, 'Prompt principal del asistente IA']
    );

    // Bot OFF por defecto — activar manualmente desde el dashboard cuando esté listo
    await cliente.query(`
      INSERT INTO configuracion (clave, valor, descripcion)
      VALUES ('bot_activo', 'false', 'Estado del bot (true/false)')
      ON CONFLICT (clave) DO NOTHING
    `);

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS alertas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id TEXT,
        contact_name TEXT,
        mensaje_cliente TEXT,
        respuesta_bot TEXT,
        tipo VARCHAR(50) DEFAULT 'intencion_compra',
        leida BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    await cliente.query(`
      CREATE INDEX IF NOT EXISTS idx_alertas_leida ON alertas(leida, timestamp DESC);
    `);

    await cliente.query(`
      CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_id ON mensajes(conversacion_id);
      CREATE INDEX IF NOT EXISTS idx_conversaciones_kommo_lead_id ON conversaciones(kommo_lead_id);
      CREATE INDEX IF NOT EXISTS idx_leads_kommo_lead_id ON leads(kommo_lead_id);
    `);

    // Conocimiento base de Fix A Trip (se actualiza con cada deploy)
    const conocimientoFixATrip = [
      {
        pregunta: '¿Qué tours ofrecen?',
        respuesta: 'Ofrecemos más de 40 experiencias en Puerto Rico: tours de aventura (ATV, zipline, jet ski), naturaleza (El Yunque, cascadas), paseos en barco (catamarán, snorkel), tours culturales (Old San Juan, destilerías de ron) y vida nocturna. ¿Qué tipo de experiencia te interesa?',
        categoria: 'tours'
      },
      {
        pregunta: '¿Cuánto cuesta la Bahía Bioluminiscente?',
        respuesta: 'El tour de la Bahía Bioluminiscente tiene un precio de $59 a $100 por persona dependiendo de la opción. Dura aproximadamente 2 horas y sale desde Fajardo. ¿Para cuántas personas y qué fecha tienes en mente?',
        categoria: 'precios'
      },
      {
        pregunta: '¿Cuánto cuesta el tour a Culebra?',
        respuesta: 'El tour a Culebra Island Beach & Snorkel tiene un precio de $165 por persona. Incluye 6 horas de experiencia y sale desde la Marina de Fajardo. Es uno de nuestros tours más populares. ¿Te interesa reservar?',
        categoria: 'precios'
      },
      {
        pregunta: '¿Cuánto cuesta El Yunque?',
        respuesta: 'Tenemos dos opciones en El Yunque: "Off the Beaten Path" a $85 por persona (7 horas, desde Ceiba) y "Cascadas y Tobogán Natural" a $65 por persona (5 horas). ¿Cuál te llama más la atención?',
        categoria: 'precios'
      },
      {
        pregunta: '¿Cuánto cuesta el tour de Old San Juan?',
        respuesta: 'El tour histórico a pie por Old San Juan cuesta $45 por persona y dura 2 horas. Sale desde la Plaza Colón. Es perfecto para conocer la historia y arquitectura colonial de Puerto Rico.',
        categoria: 'precios'
      },
      {
        pregunta: '¿Cómo puedo reservar?',
        respuesta: 'Para hacer tu reserva necesitamos: nombre completo, tour que te interesa, fecha, número de personas y si necesitas transporte. Puedes escribirnos o llamarnos al +1 787 488 0202 / email: bookings@fixatrippr.com. Un agente te confirmará disponibilidad y enviará los detalles de pago.',
        categoria: 'reservas'
      },
      {
        pregunta: '¿Dónde están ubicados?',
        respuesta: 'Estamos en San Juan, Puerto Rico. Nuestros tours salen desde diferentes puntos según la experiencia: Old San Juan, Fajardo, El Yunque, Luquillo, entre otros. El punto de encuentro exacto se confirma al reservar. ¿Necesitas transporte desde tu hotel?',
        categoria: 'contacto'
      },
      {
        pregunta: '¿Ofrecen transporte desde el hotel?',
        respuesta: 'Sí, ofrecemos servicio de transporte a través de Fix A Transport. Al reservar, indícanos tu dirección de hospedaje y te incluimos el traslado en el paquete. ¿Dónde te estás quedando?',
        categoria: 'tours'
      },
      {
        pregunta: '¿Qué incluyen los tours?',
        respuesta: 'Todos nuestros tours incluyen guías locales expertos. Dependiendo del tour puede incluir: equipo de snorkel, kayak, entrada a parques, almuerzo o snacks. Los detalles específicos de inclusiones se confirman al reservar. ¿Sobre cuál tour quieres más información?',
        categoria: 'tours'
      },
      {
        pregunta: '¿Cuál es el número de teléfono?',
        respuesta: 'Puedes contactarnos al +1 787 488 0202 o por email a bookings@fixatrippr.com. También puedes escribirnos aquí mismo y un agente te responderá.',
        categoria: 'contacto'
      },
      {
        pregunta: '¿Tienen tours para grupos?',
        respuesta: 'Sí, organizamos tours y experiencias para grupos de todos los tamaños, incluyendo eventos corporativos, despedidas de soltero/a, y grupos familiares. Para grupos grandes podemos personalizar el itinerario. ¿Cuántas personas serían y qué tipo de experiencia buscan?',
        categoria: 'tours'
      },
      {
        pregunta: '¿Se puede cancelar una reserva?',
        respuesta: 'Sí, manejamos cancelaciones. La política varía según el tour y la anticipación. Te recomendamos comunicarte con nosotros al +1 787 488 0202 o a bookings@fixatrippr.com lo antes posible si necesitas cancelar o reprogramar.',
        categoria: 'cancelaciones'
      }
    ];

    for (const entry of conocimientoFixATrip) {
      // Verificar si ya existe una entrada similar antes de insertar
      const palabrasClave = entry.pregunta.toLowerCase().split(/\s+/).filter(p => p.length > 5).slice(0, 2);
      if (palabrasClave.length > 0) {
        const cond = palabrasClave.map((_, i) => `LOWER(pregunta) LIKE $${i + 1}`).join(' AND ');
        const existe = await cliente.query(
          `SELECT id FROM conocimiento WHERE ${cond} LIMIT 1`,
          palabrasClave.map(p => `%${p}%`)
        );
        if (existe.rows.length > 0) continue;
      }
      await cliente.query(
        'INSERT INTO conocimiento (pregunta, respuesta, categoria) VALUES ($1, $2, $3)',
        [entry.pregunta, entry.respuesta, entry.categoria]
      );
    }
    console.log('[DB] Conocimiento base de Fix A Trip verificado/sembrado');

    console.log('Base de datos inicializada correctamente');
  } finally {
    cliente.release();
  }

  // Crear tabla de usuarios y admin por defecto
  const { inicializarUsuarios } = require('../../controllers/authController');
  await inicializarUsuarios();
}

module.exports = { pool, inicializarDB };
