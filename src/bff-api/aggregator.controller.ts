import { Controller, Get, Param, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AggregatorService } from './aggregator.service';
import { Request } from 'express';

@ApiTags('BFF Aggregator (Puerto 3001)')
@Controller('productos-completos')
export class AggregatorController {
  constructor(private readonly aggregatorService: AggregatorService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos agregados (REST + GraphQL)' })
  obtenerTodos(@Headers('x-correlation-id') correlationId: string, @Req() req: Request) {
    const cid = correlationId || req.headers['x-correlation-id'] || 'no-trace';
    return this.aggregatorService.obtenerCatalogoCompleto(String(cid));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Paso 7: Endpoint Aggregator que combina REST y GraphQL' })
  @ApiResponse({ status: 200, description: 'Respuesta enriquecida combinando catalogo e inventario' })
  obtenerCompleto(@Param('id') id: string, @Headers('x-correlation-id') correlationId: string, @Req() req: Request) {
    const cid = correlationId || req.headers['x-correlation-id'] || 'no-trace';
    return this.aggregatorService.obtenerProductoCompleto(id, String(cid));
  }
}
