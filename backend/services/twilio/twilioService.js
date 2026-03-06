const axios = require('axios');

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

async function enviarSmsTwilio(telefono, texto) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    throw new Error('Faltan variables de Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER');
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
