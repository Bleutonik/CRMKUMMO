# CRM AI Bot — Asistente IA para Kommo

Bot inteligente que responde automáticamente mensajes de leads en Kommo CRM usando Claude AI.

## Arquitectura

```
crm-ai-bot/
├── backend/                    # Node.js + Express → Railway
│   ├── controllers/
│   │   ├── webhookController.js    # Procesa eventos de Kommo
│   │   └── conversationController.js # API del dashboard
│   ├── routes/
│   │   ├── webhook.js          # POST /webhook
│   │   └── api.js              # GET /api/...
│   ├── services/
│   │   ├── ai/claudeService.js     # Integración Claude API
│   │   ├── kommo/kommoService.js   # Integración Kommo API
│   │   └── database/db.js          # PostgreSQL + migraciones
│   ├── index.js
│   └── package.json
│
├── frontend/                   # Next.js → Vercel
│   ├── pages/
│   │   ├── dashboard.js        # Estadísticas generales
│   │   ├── conversations.js    # Historial de conversaciones
│   │   ├── leads.js            # Leads manejados por IA
│   │   └── settings.js         # Configuración del prompt
│   ├── components/
│   │   ├── Layout.js           # Sidebar + header
│   │   └── StatCard.js         # Tarjeta de métrica
│   └── lib/api.js              # Cliente HTTP del frontend
│
├── .env.example                # Variables necesarias
├── .gitignore
└── README.md
```

## Flujo del Bot

```
Kommo (nota en lead)
  → POST /webhook (Railway)
    → Extrae texto + lead_id
    → Obtiene historial de PostgreSQL
    → Llama a Claude API
    → Guarda respuesta en PostgreSQL
    → Agrega nota en Kommo via API
```

## Instalación local

```bash
# Clonar
git clone https://github.com/tuusuario/crm-ai-bot.git
cd crm-ai-bot

# Copiar variables de entorno
cp .env.example backend/.env
# Editar backend/.env con tus credenciales reales

# Instalar dependencias del backend
cd backend
npm install

# Iniciar backend (requiere PostgreSQL corriendo)
npm run dev
```

```bash
# Frontend (nueva terminal)
cd frontend
npm install
# Crear frontend/.env.local con NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
```

## Deploy en Producción

### Backend → Railway

1. Crear cuenta en [railway.app](https://railway.app)
2. Nuevo proyecto → Deploy from GitHub repo
3. Seleccionar carpeta `backend/` como directorio raíz
4. Agregar servicio PostgreSQL (Railway lo crea automáticamente)
5. Configurar variables de entorno:
   - `KOMMO_TOKEN`
   - `KOMMO_BASE_URL`
   - `CLAUDE_API_KEY`
   - `DATABASE_URL` (Railway la agrega sola)
   - `FRONTEND_URL` (URL de Vercel)
6. La URL del backend será algo como `https://xxx.railway.app`

### Frontend → Vercel

1. Importar repositorio en [vercel.com](https://vercel.com)
2. Seleccionar carpeta `frontend/` como directorio raíz
3. Configurar variable de entorno:
   - `NEXT_PUBLIC_API_URL=https://tu-backend.railway.app`
4. Deploy automático en cada push

### Configurar Webhook en Kommo

1. Kommo → Configuración → Webhooks
2. URL: `https://tu-backend.railway.app/webhook`
3. Eventos: **Nota añadida** (lead note added)
4. Guardar

## Variables de Entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `KOMMO_TOKEN` | Backend | Token OAuth de Kommo |
| `KOMMO_BASE_URL` | Backend | `https://tudominio.kommo.com` |
| `CLAUDE_API_KEY` | Backend | API key de Anthropic |
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `FRONTEND_URL` | Backend | URL de Vercel (para CORS) |
| `NEXT_PUBLIC_API_URL` | Frontend | URL del backend en Railway |

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/webhook` | Recibe eventos de Kommo |
| GET | `/api/stats` | Estadísticas generales |
| GET | `/api/conversaciones` | Lista de conversaciones |
| GET | `/api/conversaciones/:id` | Detalle con mensajes |
| GET | `/api/leads` | Lista de leads |
| GET | `/api/configuracion` | Configuración del bot |
| POST | `/api/prompts` | Actualizar prompt del sistema |
