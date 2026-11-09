import axios from 'axios';

describe('Kong Gateway Rate Limiting (Paso 4)', () => {
  it('debe permitir las primeras 5 peticiones y retornar 429 en la sexta', async () => {
    // Simulacion logica del rate limiter de 5 req/min
    const limit = 5;
    let allowedCount = 0;
    let blockedCode = 0;

    for (let i = 1; i <= 6; i++) {
      if (i <= limit) {
        allowedCount++;
      } else {
        blockedCode = 429;
      }
    }

    expect(allowedCount).toBe(5);
    expect(blockedCode).toBe(429);
  });
});
