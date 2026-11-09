import { Module } from '@nestjs/common';
import { ProductosModule } from './productos.module';

@Module({
  imports: [ProductosModule],
})
export class ProductosAppModule {}
