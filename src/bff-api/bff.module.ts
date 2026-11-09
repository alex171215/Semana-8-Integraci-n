import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AggregatorController } from './aggregator.controller';
import { AggregatorService } from './aggregator.service';
import { InventarioResolver } from './graphql/inventario.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: false,
      introspection: true,
    }),
  ],
  controllers: [AggregatorController],
  providers: [AggregatorService, InventarioResolver],
  exports: [AggregatorService],
})
export class BffModule {}
