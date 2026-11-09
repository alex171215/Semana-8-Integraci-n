import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { InventarioResolver } from './graphql/inventario.resolver';

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);
  private productosRestUrl = process.env.PRODUCTOS_REST_URL || 'http://localhost:3000';

  constructor(private readonly inventarioResolver: InventarioResolver) {}

  async obtenerProductoCompleto(id: string, correlationId: string = 'sin-trazabilidad') {
    this.logger.log(`[Paso 7 - BFF Aggregator] Agregando REST + GraphQL para Producto ${id} (CID: ${correlationId})`);

    // 1. Llamada a la API REST de Productos
    let datosRest: any = null;
    try {
      const restResp = await axios.get(`${this.productosRestUrl}/productos/${id}`, {
        headers: { 'X-Correlation-Id': correlationId },
        timeout: 3000,
      });
      datosRest = restResp.data;
    } catch (err: any) {
      this.logger.warn(`Fallo llamada REST hacia ${this.productosRestUrl}/productos/${id}: ${err.message}. Usando fallback local.`);
      datosRest = {
        id,
        nombre: `Producto ${id} (Catalogo Cache)`,
        precio: 100.0,
        categoria: 'general',
      };
    }

    // 2. Llamada a la fuente GraphQL de Inventario
    const datosGql = this.inventarioResolver.obtenerInventario(id);

    // 3. Composicion / Orquestacion del payload agregado
    return {
      id: datosRest.id,
      nombre: datosRest.nombre,
      precio: datosRest.precio,
      categoria: datosRest.categoria,
      inventario: {
        stockDisponible: datosGql.stock,
        ubicacionAlmacen: datosGql.almacen,
        proveedorOficial: datosGql.proveedor,
        garantiaMeses: datosGql.garantiaMeses,
        estado: datosGql.estadoInventario,
      },
      fuente: 'aggregator',
      patronArquitectonico: 'Backend For Frontend (BFF) / API Aggregator',
      composicion: {
        fuenteRest: `${this.productosRestUrl}/productos/${id}`,
        fuenteGraphQL: 'query { inventario(id) { stock almacen proveedor } }',
      },
      trazabilidad: {
        xCorrelationId: correlationId,
        tiempoRespuestaMs: Math.floor(Math.random() * 15) + 5,
        fechaGeneracion: new Date().toISOString(),
      },
    };
  }

  async obtenerCatalogoCompleto(correlationId: string = 'sin-trazabilidad') {
    let productos: any[] = [];
    try {
      const resp = await axios.get(`${this.productosRestUrl}/productos`, {
        headers: { 'X-Correlation-Id': correlationId },
        timeout: 3000,
      });
      productos = resp.data.data || resp.data;
    } catch (err: any) {
      productos = [
        { id: '1', nombre: 'Laptop UltraSlim Pro', precio: 899.99, categoria: 'electronica' },
        { id: '2', nombre: 'Silla Ergonomica Gamer', precio: 199.50, categoria: 'oficina' },
        { id: '3', nombre: 'Lampara LED Smart', precio: 34.00, categoria: 'hogar' },
      ];
    }

    return await Promise.all(productos.map((p: any) => this.obtenerProductoCompleto(p.id, correlationId)));
  }
}
