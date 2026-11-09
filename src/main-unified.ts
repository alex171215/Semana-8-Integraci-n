import { NestFactory } from '@nestjs/core';
import { ProductosAppModule } from './productos-api/productos.module';
import { BffModule } from './bff-api/bff.module';
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

// Contador en memoria para simular/verificar Rate Limiting localmente
interface RateLimitBucket {
  count: number;
  resetTime: number;
}
const rateLimits: Map<string, RateLimitBucket> = new Map();

function checkRateLimit(ip: string, limit: number = 5, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = rateLimits.get(ip);
  if (!bucket || now > bucket.resetTime) {
    bucket = { count: 0, resetTime: now + windowMs };
    rateLimits.set(ip, bucket);
  }
  bucket.count++;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: limit - bucket.count };
}

async function startUnified() {
  console.log('================================================================');
  console.log('🚀 INICIANDO ECOSISTEMA SEMANA 8 (KONG GATEWAY + MICROSERVICIOS)');
  console.log('================================================================');

  // 1. Iniciar Microservicio Productos REST en puerto 3000
  try {
    const productosApp = await NestFactory.create(ProductosAppModule, { logger: ['warn', 'error', 'log'] });
    productosApp.enableCors();
    await productosApp.listen(3000);
    console.log('✅ [Microservicio REST] nestjs-productos-api escuchando en http://localhost:3000');
  } catch (err: any) {
    console.log('⚠️ [Microservicio REST] Puerto 3000 ya ocupado o delegado:', err.message);
  }

  // 2. Iniciar Microservicio BFF Aggregator en puerto 3001
  try {
    const bffApp = await NestFactory.create(BffModule, { logger: ['warn', 'error', 'log'] });
    bffApp.enableCors();
    await bffApp.listen(3001);
    console.log('✅ [Microservicio BFF]  nestjs-bff-productos escuchando en http://localhost:3001');
  } catch (err: any) {
    console.log('⚠️ [Microservicio BFF] Puerto 3001 ya ocupado o delegado:', err.message);
  }

  // 3. Iniciar Gateway / Servidor de Demostración y Render en PORT (default 8000)
  const gatewayApp = express();
  gatewayApp.use(express.json());

  // Servir frontend interactivo
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    gatewayApp.use(express.static(publicDir));
  }

  // Servir la guia oficial del taller
  const workshopPath = path.join(process.cwd(), 'web-practica-Semana 8.html');
  gatewayApp.get('/workshop', (req, res) => {
    if (fs.existsSync(workshopPath)) {
      res.sendFile(workshopPath);
    } else {
      res.status(404).send('Guia del taller no encontrada');
    }
  });

  // Healthcheck para Render / CI-CD
  gatewayApp.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      servicio: 'Semana 8: Kong Gateway & Aggregator Suite',
      timestamp: new Date().toISOString(),
      entorno: process.env.NODE_ENV || 'development',
      serviciosInternos: {
        productosRest: 'http://localhost:3000',
        bffAggregator: 'http://localhost:3001',
      },
    });
  });

  // Admin API status emulado (compatible con Kong Paso 1)
  gatewayApp.get('/status', (req, res) => {
    res.json({
      server: {
        total_requests: 124,
        connections_active: 3,
        connections_reading: 0,
        connections_writing: 1,
        connections_waiting: 2,
      },
      database: { reachable: true, mode: 'off (DB-less)' },
      declarative_config: 'loaded from /kong/kong.yml',
      plugins_active: ['rate-limiting', 'request-transformer'],
    });
  });

  // Proxy / Gateway Route 1: /productos (con Rate Limiting 5 req/min y X-Correlation-Id)
  gatewayApp.all('/productos*', async (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const rateCheck = checkRateLimit(clientIp, 5, 60000);

    // Encabezados estandar de Rate Limiting
    res.setHeader('X-RateLimit-Limit-Minute', '5');
    res.setHeader('X-RateLimit-Remaining-Minute', String(rateCheck.remaining));

    if (!rateCheck.allowed) {
      console.log(`[Kong Gateway :8000] ⚠️ Rate limit excedido para IP ${clientIp}. Respondiendo HTTP 429 Too Many Requests`);
      return res.status(429).json({
        message: 'API rate limit exceeded',
        error: 'Too Many Requests',
        statusCode: 429,
        politica: 'rate-limiting plugin (5 peticiones por minuto)',
        sugerencia: 'Espere a que se reinicie la ventana de 1 minuto',
      });
    }

    // Inyeccion de trazabilidad (Paso 5)
    const correlationId = 'kong-generado-' + Math.random().toString(36).substring(2, 9);
    res.setHeader('X-Correlation-Id', correlationId);

    try {
      const targetUrl = `http://localhost:3000${req.url}`;
      console.log(`[Kong Gateway :8000] Proxy hacia ${targetUrl} | Inyectando X-Correlation-Id: ${correlationId}`);
      
      const upstreamRes = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          host: 'localhost:3000',
          'x-correlation-id': correlationId,
        },
        timeout: 4000,
      });

      return res.status(upstreamRes.status).json(upstreamRes.data);
    } catch (err: any) {
      if (err.response) {
        return res.status(err.response.status).json(err.response.data);
      }
      return res.status(502).json({
        message: 'Bad Gateway: Upstream productos-service no alcanzable',
        error: err.message,
      });
    }
  });

  // Proxy / Gateway Route 2: /productos-completos (BFF Aggregator REST + GraphQL)
  gatewayApp.all('/productos-completos*', async (req, res) => {
    const correlationId = 'kong-bff-' + Math.random().toString(36).substring(2, 9);
    res.setHeader('X-Correlation-Id', correlationId);

    try {
      const targetUrl = `http://localhost:3001${req.url}`;
      console.log(`[Kong Gateway :8000] Proxy Aggregator hacia ${targetUrl} | CID: ${correlationId}`);

      const upstreamRes = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          host: 'localhost:3001',
          'x-correlation-id': correlationId,
        },
        timeout: 4000,
      });

      return res.status(upstreamRes.status).json(upstreamRes.data);
    } catch (err: any) {
      if (err.response) {
        return res.status(err.response.status).json(err.response.data);
      }
      return res.status(502).json({
        message: 'Bad Gateway: Upstream bff-productos-service no alcanzable',
        error: err.message,
      });
    }
  });

  const gatewayPort = process.env.PORT || 8000;
  gatewayApp.listen(gatewayPort, () => {
    console.log('================================================================');
    console.log(`🌐 [Kong Gateway & Web Console] Listo en http://localhost:${gatewayPort}`);
    console.log(`📖 [Guia Taller Oficial]       http://localhost:${gatewayPort}/workshop`);
    console.log(`🛡️  [Proxy Productos con RL]    http://localhost:${gatewayPort}/productos`);
    console.log(`🧩 [Proxy Aggregator BFF]      http://localhost:${gatewayPort}/productos-completos/1`);
    console.log(`📊 [Admin API Status]          http://localhost:${gatewayPort}/status`);
    console.log(`❤️  [Healthcheck]               http://localhost:${gatewayPort}/api/health`);
    console.log('================================================================\n');
  });
}

startUnified();
