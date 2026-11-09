import { Controller, Get, Post, Body, Param, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductosService, Producto } from './productos.service';
import { Request } from 'express';

@ApiTags('Productos REST (Puerto 3000)')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener catalogo de productos REST (Paso 0 y 3)' })
  @ApiResponse({ status: 200, description: 'Listado completo de productos' })
  obtenerTodos(@Req() req: Request, @Headers('x-correlation-id') correlationId: string) {
    // Paso 5: Registro explicito del header de trazabilidad propagado por Kong
    const cid = String(correlationId || req.headers['x-correlation-id'] || 'no-gateway-direct');
    console.log(`[nestjs-productos-api :3000] [TRACE] GET /productos | X-Correlation-Id: ${cid}`);
    
    return {
      trazabilidad: {
        xCorrelationId: cid,
        origen: cid.startsWith('kong') ? 'Via Kong Gateway' : 'Acceso Directo Sin Gateway',
        timestamp: new Date().toISOString(),
      },
      data: this.productosService.obtenerTodos(),
    };
  }

  @Get('trace/headers')
  @ApiOperation({ summary: 'Verificar cabeceras recibidas para auditoria de trazabilidad' })
  verificarHeaders(@Req() req: Request) {
    return {
      headersRecibidos: req.headers,
      correlationIdKong: req.headers['x-correlation-id'] || null,
      hostRecibido: req.headers['host'],
      userAgent: req.headers['user-agent'],
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto individual por ID' })
  obtenerPorId(@Param('id') id: string, @Headers('x-correlation-id') correlationId: string) {
    const cid = String(correlationId || 'no-gateway-direct');
    console.log(`[nestjs-productos-api :3000] [TRACE] GET /productos/${id} | X-Correlation-Id: ${cid}`);
    const prod = this.productosService.obtenerPorId(id);
    return {
      ...prod,
      xCorrelationId: cid,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Crear producto nuevo en el catalogo REST' })
  crear(@Body() body: { nombre: string; precio: number; categoria?: string }) {
    return this.productosService.crear(body);
  }
}
