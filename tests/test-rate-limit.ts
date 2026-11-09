import axios from 'axios';

async function runRateLimitCheck() {
  console.log('🧪 Iniciando Verificacion Automatizada del Plugin Rate-Limiting (Paso 4)...');
  const targetUrl = process.env.GATEWAY_URL || 'http://localhost:8000/productos';
  console.log(`🎯 Destino de prueba: ${targetUrl} (Limite: 5 req/min)\n`);

  let exitCode = 0;
  for (let i = 1; i <= 6; i++) {
    try {
      const resp = await axios.get(targetUrl, { timeout: 2000 });
      console.log(`[Peticion #${i}] Status: ${resp.status} OK | Remaining: ${resp.headers['x-ratelimit-remaining-minute'] || 'N/A'}`);
      if (i === 6) {
        console.error('❌ ERROR: La 6ta peticion deberia haber sido rechazada con 429 Too Many Requests.');
        exitCode = 1;
      }
    } catch (err: any) {
      if (err.response && err.response.status === 429) {
        console.log(`[Peticion #${i}] Status: 429 Too Many Requests ✅ BLOQUEO DE RATE LIMIT EXITOSO`);
        console.log(`   Detalle: ${JSON.stringify(err.response.data)}`);
      } else {
        console.log(`[Peticion #${i}] Fallo de conexion: ${err.message}`);
      }
    }
  }

  process.exit(exitCode);
}

runRateLimitCheck();
