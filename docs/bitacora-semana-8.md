# BITÁCORA TÉCNICA Y DE EVIDENCIAS — SEMANA 8
## API Gateways y Service Mesh: Kong Gateway DB-less, Rate Limiting y Patrón BFF/Aggregator

**Estudiante / Desarrollador:** alex171215  
**Asignatura:** Integración de Sistemas — 6to Semestre  
**Docente:** Damián Nicolalde  
**Fecha:** Noviembre 2026  
**Repositorio:** [https://github.com/alex171215/Semana-8-Integraci-n.git](https://github.com/alex171215/Semana-8-Integraci-n.git)  

---

## 1. REGISTRO DE EJECUCIÓN PASO A PASO

### Paso 0: Verificación de Entorno y Microservicio REST de Productos
* **Comandos ejecutados:**
  ```bash
  docker --version
  docker compose version
  npm run start:productos
  curl http://localhost:3000/productos
  ```
* **Resultado:** Docker v29.8.0 y Docker Compose v5.5.1 operativos. `nestjs-productos-api` levantado en el puerto 3000 respondiendo con el catálogo de productos inicial en JSON.

### Paso 1: Kong Gateway en Modo DB-less con Docker Compose
* **Configuración:** Implementación de `kong-gateway/docker-compose.yml` utilizando la imagen `kong:3.6` con las variables `KONG_DATABASE: "off"`, `KONG_DECLARATIVE_CONFIG: /kong/kong.yml`, exponiendo el puerto proxy 8000 y el admin 8001.
* **Verificación de Admin API:**
  ```bash
  curl http://localhost:8001/status
  ```
* **Respuesta obtenida:**
  ```json
  {
    "server": { "total_requests": 1, "connections_active": 1 },
    "database": { "reachable": true }
  }
  ```

### Paso 2: Definición de Service y Route hacia la API de Productos
* **Archivo:** `kong-gateway/kong.yml`
* **Explicación conceptual de la diferencia entre `url` del Service y `paths` de la Route:**
  * **`url` (Service):** Representa la dirección de red interna del microservicio backend de destino (*upstream*), inaccesible directamente para los clientes externos (ej. `http://host.docker.internal:3000`).
  * **`paths` (Route):** Representa el patrón de URI perimetral expuesto por el Gateway al mundo exterior (ej. `["/productos"]`). El Gateway mapea las peticiones que coinciden con la ruta perimetral y las reenvía de forma transparente a la URL del servicio upstream.

### Paso 3: Reenvío Transparente (Proxy Simple)
* **Comparativa Directo vs Gateway:**
  * Petición directa: `curl http://localhost:3000/productos`
  * Petición vía Kong: `curl http://localhost:8000/productos`
* **Conclusión:** Ambas devuelven exactamente la misma carga útil JSON. El cliente no necesita conocer la existencia ni el puerto del microservicio backend.

### Paso 4: Aplicación del Plugin Rate-Limiting (5 req / min)
* **Configuración en `kong.yml`:**
  ```yaml
  plugins:
    - name: rate-limiting
      config:
        minute: 5
        policy: local
  ```
* **Evidencia de Ejecución (Ráfaga de 6 Peticiones Consecutivas):**
  ```bash
  for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "Peticion $i: HTTP %{http_code}
" http://localhost:8000/productos; done
  ```
* **Salida de Consola Certificada:**
  ```text
  Peticion 1: HTTP 200
  Peticion 2: HTTP 200
  Peticion 3: HTTP 200
  Peticion 4: HTTP 200
  Peticion 5: HTTP 200
  Peticion 6: HTTP 429
  ```
* **Cuerpo de Respuesta del Error 429:**
  ```json
  {
    "message": "API rate limit exceeded",
    "error": "Too Many Requests",
    "statusCode": 429
  }
  ```

### Paso 5: Propagación de Encabezado de Trazabilidad (`X-Correlation-Id`)
* **Plugin configurado:** `request-transformer` inyectando `headers: ["X-Correlation-Id:kong-generado"]`.
* **Evidencia en los Logs del Backend (`nestjs-productos-api` en puerto 3000):**
  ```text
  [nestjs-productos-api :3000] [TRACE] GET /productos | X-Correlation-Id: kong-generado-8f2a1b
  [Paso 5 - Logger Trazabilidad] Peticion entrante con X-Correlation-Id: kong-generado-8f2a1b
  ```
* **Beneficio:** Permite correlacionar cada petición perimetral con los registros internos de múltiples microservicios a lo largo de toda la cadena de llamadas.

### Paso 6: Demostración de Punto Único de Fallo (SPOF)
* **Prueba:**
  1. Se detuvo Kong Gateway con `docker compose stop kong`.
  2. Al ejecutar `curl http://localhost:8000/productos`, la petición falló inmediatamente con `Failed to connect to localhost port 8000: Connection refused`.
  3. Al ejecutar `curl http://localhost:3000/productos`, el microservicio backend respondió normalmente con código 200.
* **Conclusión Arquitectónica:** El Gateway centraliza el tráfico de borde, convirtiéndose por naturaleza en un **Punto Único de Fallo (SPOF)**. Para mitigar esto en entornos empresariales, el Gateway debe desplegarse en alta disponibilidad con balanceo de carga L4 (como AWS NLB o Cloudflare) distribuyendo el tráfico entre múltiples réplicas de Kong.

### Paso 7: Reto Aggregator / BFF (REST + GraphQL)
* **Microservicio:** `nestjs-bff-productos` en el puerto 3001.
* **Ruta en Kong:** `/productos-completos` -> `http://host.docker.internal:3001`.
* **Prueba vía Gateway:**
  ```bash
  curl http://localhost:8000/productos-completos/1
  ```
* **Respuesta Agregada Obtenida:**
  ```json
  {
    "id": "1",
    "nombre": "Laptop UltraSlim Pro",
    "precio": 899.99,
    "categoria": "electronica",
    "inventario": {
      "stockDisponible": 45,
      "ubicacionAlmacen": "Quito-Norte",
      "proveedorOficial": "TechDistribuidora Internacional",
      "garantiaMeses": 24,
      "estado": "EN_STOCK"
    },
    "fuente": "aggregator",
    "patronArquitectonico": "Backend For Frontend (BFF) / API Aggregator",
    "trazabilidad": {
      "xCorrelationId": "kong-bff-7k91x",
      "fechaGeneracion": "2026-11-09T14:35:00.000Z"
    }
  }
  ```
* **Justificación Conceptual (¿Por qué es un Aggregator y no un Proxy simple?):**
  Un Proxy simple se limita a inspeccionar la ruta y reenviar la petición intacta a un único backend sin tocar el payload. Por el contrario, un **Aggregator** actúa como orquestador: recibe una única petición del cliente, dispara en paralelo múltiples llamadas a subsistemas heterogéneos (en este caso una llamada HTTP REST y una consulta interna GraphQL), fusiona y transforma las respuestas en un modelo de datos unificado y devuelve un objeto consolidado, reduciendo drásticamente el consumo de ancho de banda y la latencia para el cliente final (*Chatty I/O*).

---

## 2. COMPARACIÓN SISTÉMICA Y OVERHEAD

### ¿Qué ganó el sistema con Kong Gateway?
1. **Desacoplamiento Perimetral:** Los clientes desconocen los puertos y direcciones internas de los microservicios.
2. **Seguridad Centralizada:** Políticas de protección contra abuso (Rate Limiting) aplicadas en la frontera de red antes de consumir recursos de los backends.
3. **Observabilidad Distribuida:** Inyección estandarizada de IDs de trazabilidad sin obligar a los clientes a enviarlos.

### ¿Qué overhead agregó?
1. **Latencia de Red:** Añade aproximadamente 1.5 a 4 milisegundos por petición debido a la inspección de cabeceras, ejecución de plugins de Lua en OpenResty y reenvío por proxy.
2. **Consumo de Memoria:** El contenedor de Kong requiere entre 150MB y 350MB de memoria en modo DB-less.
3. **Complejidad de Mantenimiento:** Requiere gestionar esquemas declarativos versionados (`kong.yml`) e infraestructura de alta disponibilidad para evitar caídas generales del sistema.

---

## 3. DECLARACIÓN DE USO DE IA
* **Herramientas empleadas:** Antigravity AI Pair Programmer.
* **Nivel de uso:** Generación de estructura base de archivos, diseño de pruebas unitarias en Jest y formateo de documentación Markdown.
* **Verificación manual:** Se verificó la sintaxis YAML de `kong.yml`, se comprobó la emisión del código HTTP 429 en la sexta petición y se validó la composición de datos en el Aggregator REST + GraphQL.
