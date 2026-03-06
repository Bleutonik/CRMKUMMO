const axios = require('axios');

async function enviarSmsTwilio(telefono, texto) {
  // Leer en el momento de la llamada (no al inicio del módulo) para capturar los valores actuales
  const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
  const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  // Log para diagnosticar cuál falta
  console.log('[TWILIO] Variables disponibles:', {
    TWILIO_ACCOUNT_SID: ACCOUNT_SID ? `${ACCOUNT_SID.slice(0,6)}...` : 'FALTA',
    TWILIO_AUTH_TOKEN:  AUTH_TOKEN  ? '***'                          : 'FALTA',
    TWILIO_FROM_NUMBER: FROM_NUMBER || 'FALTA',
  });

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    const faltan = [
      !ACCOUNT_SID && 'TWILIO_ACCOUNT_SID',
      !AUTH_TOKEN  && 'TWILIO_AUTH_TOKEN',
      !FROM_NUMBER && 'TWILIO_FROM_NUMBER',
    ].filter(Boolean).join(', ');
    throw new Error(`Faltan variables de Twilio en Railway: ${faltan}`);
  }
  if (!telefono) {
    throw new Error('Número de teléfono del cliente no disponible');
  }

  const params = new URLSearchParams({
    From: FROM_NUMBER,
    To:   telefono,
    Body: texto,
  });

  const resp = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    params.toString(),
    {
      auth:    { username: ACCOUNT_SID, password: AUTH_TOKEN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );

  console.log(`[TWILIO] SMS enviado a ${telefono} — SID: ${resp.data.sid}`);
  return resp.data;
}

module.exports = { enviarSmsTwilio };
