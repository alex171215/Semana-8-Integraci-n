import { Test, TestingModule } from '@nestjs/testing';
import { ProductosService } from '../src/productos-api/productos.service';
import { ProductosController } from '../src/productos-api/productos.controller';

describe('Microservicio Productos REST (Paso 0 y 3)', () => {
  let controller: ProductosController;
  let service: ProductosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductosController],
      providers: [ProductosService],
    }).compile();

    controller = module.get<ProductosController>(ProductosController);
    service = module.get<ProductosService>(ProductosService);
  });

  it('debe listar todos los productos con trazabilidad', () => {
    const res = controller.obtenerTodos({ headers: {} } as any, 'test-trace-id');
    expect(res.data.length).toBeGreaterThanOrEqual(3);
    expect(res.trazabilidad.xCorrelationId).toBe('test-trace-id');
  });

  it('debe obtener un producto especifico por ID', () => {
    const prod = controller.obtenerPorId('1', 'trace-123');
    expect(prod.id).toBe('1');
    expect(prod.nombre).toBe('Laptop UltraSlim Pro');
    expect(prod.xCorrelationId).toBe('trace-123');
  });

  it('debe registrar un producto nuevo', () => {
    const nuevo = service.crear({ nombre: 'Teclado Mecanico RGB', precio: 85.0, categoria: 'oficina' });
    expect(nuevo.id).toBeDefined();
    expect(nuevo.nombre).toBe('Teclado Mecanico RGB');
  });
});
