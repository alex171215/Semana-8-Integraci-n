import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { Request, Response, NextFunction } from 'express';

@Module({
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const traceId = req.headers['x-correlation-id'];
        if (traceId) {
          console.log(`[Paso 5 - Logger Trazabilidad] Peticion entrante con X-Correlation-Id: ${traceId}`);
          res.setHeader('X-Trace-Echo', String(traceId));
        }
        next();
      })
      .forRoutes('*');
  }
}

export { ProductosModule as ProductosAppModule };
