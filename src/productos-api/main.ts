import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProductosAppModule } from './productos.module';

async function bootstrap() {
  const app = await NestFactory.create(ProductosAppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('nestjs-productos-api (Catalogo REST)')
    .setDescription('Microservicio REST de productos evaluado en la Semana 8 tras Kong Gateway')
    .setVersion('1.0.0')
    .addTag('Productos REST (Puerto 3000)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.PRODUCTOS_PORT || 3000;
  await app.listen(port);
  console.log(`[nestjs-productos-api] Corriendo en http://localhost:${port}`);
  console.log(`[nestjs-productos-api] Swagger: http://localhost:${port}/api/docs`);
}

if (require.main === module) {
  bootstrap();
}
export { bootstrap };
