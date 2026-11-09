import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BffModule } from './bff.module';

async function bootstrap() {
  const app = await NestFactory.create(BffModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('nestjs-bff-productos (API Aggregator)')
    .setDescription('Microservicio BFF que combina API REST de Productos y GraphQL de Inventario')
    .setVersion('1.0.0')
    .addTag('BFF Aggregator (Puerto 3001)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('bff/docs', app, document);

  const port = process.env.PORT || process.env.BFF_PORT || 3001;
  await app.listen(port);
  console.log(`[nestjs-bff-productos] Corriendo en http://localhost:${port}`);
  console.log(`[nestjs-bff-productos] Swagger: http://localhost:${port}/bff/docs`);
  console.log(`[nestjs-bff-productos] GraphQL endpoint: http://localhost:${port}/graphql`);
}

if (require.main === module) {
  bootstrap();
}
export { bootstrap };
