import { Test, TestingModule } from '@nestjs/testing';
import { AggregatorService } from '../src/bff-api/aggregator.service';
import { InventarioResolver } from '../src/bff-api/graphql/inventario.resolver';

describe('Microservicio BFF Aggregator (Paso 7)', () => {
  let service: AggregatorService;
  let resolver: InventarioResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AggregatorService, InventarioResolver],
    }).compile();

    service = module.get<AggregatorService>(AggregatorService);
    resolver = module.get<InventarioResolver>(InventarioResolver);
  });

  it('el resolver de GraphQL debe proveer datos de inventario', () => {
    const inv = resolver.obtenerInventario('1');
    expect(inv.id).toBe('1');
    expect(inv.stock).toBe(45);
    expect(inv.almacen).toBe('Quito-Norte');
  });

  it('debe orquestar REST + GraphQL combinados en un producto completo', async () => {
    const completo = await service.obtenerProductoCompleto('1', 'trace-bff-test');
    expect(completo.id).toBe('1');
    expect(completo.fuente).toBe('aggregator');
    expect(completo.patronArquitectonico).toContain('BFF');
    expect(completo.inventario).toBeDefined();
    expect(completo.inventario.stockDisponible).toBe(45);
    expect(completo.trazabilidad.xCorrelationId).toBe('trace-bff-test');
  });
});
