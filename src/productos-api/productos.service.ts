import { Injectable, NotFoundException } from '@nestjs/common';

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  categoria?: string;
  fechaCreacion?: string;
}

@Injectable()
export class ProductosService {
  private productos: Map<string, Producto> = new Map([
    ['1', { id: '1', nombre: 'Laptop UltraSlim Pro', precio: 899.99, categoria: 'electronica', fechaCreacion: new Date().toISOString() }],
    ['2', { id: '2', nombre: 'Silla Ergonomica Gamer', precio: 199.50, categoria: 'oficina', fechaCreacion: new Date().toISOString() }],
    ['3', { id: '3', nombre: 'Lampara LED Smart', precio: 34.00, categoria: 'hogar', fechaCreacion: new Date().toISOString() }],
  ]);

  obtenerTodos(): Producto[] {
    return Array.from(this.productos.values());
  }

  obtenerPorId(id: string): Producto {
    const prod = this.productos.get(id);
    if (!prod) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en el catalogo REST`);
    }
    return prod;
  }

  crear(datos: { nombre: string; precio: number; categoria?: string }): Producto {
    const nuevoId = String(this.productos.size + 1);
    const nuevo: Producto = {
      id: nuevoId,
      nombre: datos.nombre,
      precio: Number(datos.precio),
      categoria: datos.categoria || 'general',
      fechaCreacion: new Date().toISOString(),
    };
    this.productos.set(nuevoId, nuevo);
    return nuevo;
  }
}
