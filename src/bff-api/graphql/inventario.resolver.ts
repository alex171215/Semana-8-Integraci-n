import { Resolver, Query, Args, ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class InventarioProducto {
  @Field()
  id: string;

  @Field(() => Int)
  stock: number;

  @Field()
  almacen: string;

  @Field()
  proveedor: string;

  @Field(() => Int)
  garantiaMeses: number;

  @Field()
  estadoInventario: string;
}

const inventarioMock: Record<string, InventarioProducto> = {
  '1': { id: '1', stock: 45, almacen: 'Quito-Norte', proveedor: 'TechDistribuidora Internacional', garantiaMeses: 24, estadoInventario: 'EN_STOCK' },
  '2': { id: '2', stock: 12, almacen: 'Guayaquil-Sur', proveedor: 'ErgoComfort Latam', garantiaMeses: 36, estadoInventario: 'STOCK_LIMITADO' },
  '3': { id: '3', stock: 150, almacen: 'Cuenca-Centro', proveedor: 'SmartHome Global', garantiaMeses: 12, estadoInventario: 'EN_STOCK' },
};

@Resolver(() => InventarioProducto)
export class InventarioResolver {
  @Query(() => InventarioProducto, { name: 'inventario' })
  obtenerInventario(@Args('id', { type: () => String }) id: string): InventarioProducto {
    return (
      inventarioMock[id] || {
        id,
        stock: 5,
        almacen: 'Bodega-Central',
        proveedor: 'Distribuidor Estandar',
        garantiaMeses: 12,
        estadoInventario: 'DISPONIBLE_PEDIDO',
      }
    );
  }

  @Query(() => [InventarioProducto], { name: 'todosInventarios' })
  obtenerTodos(): InventarioProducto[] {
    return Object.values(inventarioMock);
  }
}
