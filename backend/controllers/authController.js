const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const SECRET = process.env.JWT_SECRET || 'crm-ai-bot-secret-change-in-production';

// Crear tabla y admin por defecto si no existe
async function inicializarUsuarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(20) DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
      activo BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT NOW()
    )
  `);

  // Crear admin por defecto si no hay ningún usuario
  const { rows } = await pool.query('SELECT id FROM usuarios LIMIT 1');
  if (rows.length === 0) {
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query(`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES ('Administrador', $1, $2, 'admin')
    `, [process.env.ADMIN_EMAIL || 'admin@fixatrip.com', hash]);
    console.log('[AUTH] Admin creado. Email:', process.env.ADMIN_EMAIL || 'admin@fixatrip.com');
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email.toLowerCase().trim()]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = rows[0];
    const valido = await bcrypt.compare(password, usuario.password_hash);
    if (!valido) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AUTH] Login: ${usuario.email} (${usuario.rol})`);
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (err) {
    console.error('[AUTH] login:', err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ usuario: req.usuario });
}

// GET /api/auth/usuarios (admin)
async function listarUsuarios(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY creado_en ASC'
    );
    res.json({ usuarios: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
}

// POST /api/auth/usuarios (admin)
async function crearUsuario(req, res) {
  try {
    const { nombre, email, password, rol = 'empleado' } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'nombre, email y password requeridos' });
    if (!['admin', 'empleado'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol, creado_en',
      [nombre.trim(), email.toLowerCase().trim(), hash, rol]
    );
    console.log(`[AUTH] Usuario creado: ${email} (${rol}) por admin ${req.usuario.email}`);
    res.json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese email ya existe' });
    res.status(500).json({ error: 'Error creando usuario' });
  }
}

// DELETE /api/auth/usuarios/:id (admin)
async function eliminarUsuario(req, res) {
  try {
    const { id } = req.params;
    if (Number(id) === req.usuario.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
}

// PATCH /api/auth/usuarios/:id/password (admin o el mismo usuario)
async function cambiarPassword(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
    if (req.usuario.rol !== 'admin' && req.usuario.id !== Number(id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error cambiando contraseña' });
  }
}

module.exports = { inicializarUsuarios, login, me, listarUsuarios, crearUsuario, eliminarUsuario, cambiarPassword };
