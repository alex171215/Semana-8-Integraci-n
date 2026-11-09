# INFORME EJECUTIVO DE AUDITORÍA TÉCNICA Y ARQUITECTÓNICA
## Evaluación Integral de Calidad, Resiliencia, Seguridad y Gobernanza de API Gateways
**Proyecto:** Plataforma de Microservicios con Kong Gateway y Patrón BFF/Aggregator  
**Módulo Evaluado:** Taller Semana 8 — Integración de Sistemas con Kong Gateway DB-less y NestJS  
**Repositorio Oficial:** [https://github.com/alex171215/Semana-8-Integraci-n.git](https://github.com/alex171215/Semana-8-Integraci-n.git)  
**Fecha de Evaluación:** Noviembre 2026  
**Audiencia Objetivo:** Dirección de Tecnología (CTO), Arquitectos de Software, Líderes Técnicos y DevSecOps  

---

## 1. RESUMEN EJECUTIVO

### 1.1. Propósito y Alcance del Análisis
El presente informe constituye una auditoría técnica exhaustiva sobre el diseño arquitectónico, los controles de seguridad perimetral, las políticas de tráfico y la integración de microservicios implementados en el taller de la **Semana 8: API Gateways y Service Mesh**. La solución evaluada integra un **API Gateway Kong (v3.6 en modo DB-less)** como punto único de entrada, enrutando hacia dos microservicios desarrollados en **NestJS 10**: un servicio de catálogo de productos REST y un servicio agregador basado en el patrón **Backend-For-Frontend (BFF)** que orquesta datos REST y GraphQL, desplegado mediante contenedores Docker y respaldado por integración continua en **GitHub Actions**.

El objetivo es evaluar la brecha técnica entre el modelo pedagógico implementado y los requisitos operacionales, de seguridad y alta disponibilidad exigidos en infraestructuras empresariales de misión crítica.

### 1.2. Dictamen General de la Auditoría
* **Cumplimiento Funcional del Taller Académico:** **100% SATISFACTORIO**. El proyecto implementa de manera rigurosa cada uno de los 9 pasos de la guía: modo DB-less declarativo en `kong.yml`, enrutamiento transparente, limitación de tasa a 5 peticiones por minuto con emisión de HTTP 429, inyección y verificación de cabeceras de trazabilidad `X-Correlation-Id`, comprobación del punto único de fallo (SPOF), composición en el BFF Aggregator y bitácora técnica de evidencias.
* **Madurez y Preparación para Producción Empresarial (*Enterprise Readiness*):** **NIVEL MEDIO (Requiere Remediación Preventiva)**. Se han detectado **7 hallazgos técnicos** de severidad Crítica, Alta y Media relacionados con la persistencia local de cuotas de tráfico, exposición de puertos administrativos, trazabilidad estática, ausencia de disyuntores de circuito (*circuit breakers*) y falta de cifrado en el tráfico interno.

### 1.3. Matriz Ejecutiva de Hallazgos y Severidad

| Identificador | Hallazgo / Deficiencia Detectada | Dominio de Ingeniería | Severidad | Impacto Operativo y de Negocio |
|---|---|---|---|---|
| **AUD-01** | Política de Rate Limiting con estado local y ruptura de cuotas al escalar réplicas | Gestión de Tráfico | **CRÍTICA** | Multiplicación no deseada de cuotas al balancear tráfico entre múltiples instancias de Kong. |
| **AUD-02** | Exposición irrestricta de la Admin API de Kong en interfaces públicas de red | Seguridad Perimetral | **ALTA** | Riesgo de acceso no autorizado a la configuración interna y alteración de rutas y plugins. |
| **AUD-03** | Generación estática e inmutable del identificador de trazabilidad distribuida | Observabilidad y SRE | **ALTA** | Imposibilidad de correlacionar transacciones individuales en logs de auditoría forense. |
| **AUD-04** | Ausencia de Circuit Breaker y timeouts en el microservicio BFF / Aggregator | Resiliencia de Software | **MEDIA** | Fallas en cascada y bloqueo del pool de sockets de Node.js ante caídas del servicio REST. |
| **AUD-05** | Dependencia de resolución de red local mediante `host.docker.internal` | Portabilidad e Infraestructura | **MEDIA** | Incompatibilidad y errores 502 Bad Gateway al desplegar en servidores Linux de producción. |
| **AUD-06** | Inexistencia de comprobaciones de salud activas (*Active Health Checks*) en Upstreams | Alta Disponibilidad | **MEDIA** | Enrutamiento continuo de peticiones de usuarios hacia instancias de backend degradadas. |
| **AUD-07** | Falta de cifrado mutuo TLS (mTLS) en la comunicación de red interna Este-Oeste | Seguridad de Red / Zero Trust | **BAJA-MEDIA** | Vulnerabilidad a interceptación de tráfico no cifrado dentro de la red privada compartida. |

---

## 2. AUDITORÍA TÉCNICA DETALLADA: PROBLEMAS, IMPACTOS Y SOLUCIONES

---

### HALLAZGO AUD-01: Política de Rate Limiting con Estado Local (`policy: local`) y Ruptura de Cuotas al Escalar Réplicas
* **Severidad:** **CRÍTICA**
* **Componente Afectado:** `kong-gateway/kong.yml` (Plugin `rate-limiting`)

#### Enunciado y Detalle Técnico del Error
En la configuración declarativa del plugin `rate-limiting` de Kong, la directiva `policy` se encuentra establecida en `local`. Bajo esta modalidad, los contadores de solicitudes por cliente se almacenan de manera exclusiva en la memoria de acceso aleatorio (RAM) local de los procesos worker de Nginx pertenecientes al contenedor de Kong que atiende la conexión.

#### Cómo Afecta a la Aplicación y al Negocio
En un entorno de producción real donde el Gateway se despliega en alta disponibilidad con tres o más réplicas detrás de un balanceador de carga de red (NLB), la cuota teórica definida de 5 peticiones por minuto deja de cumplirse. Debido a que el balanceador distribuye las peticiones en esquema *round-robin*, un cliente puede enviar hasta 15 solicitudes en un minuto sin ser bloqueado, ya que cada réplica mantiene su propio contador local en ceros. Esto anula la protección perimetral, permite ataques de fuerza bruta o raspado de datos (*web scraping*) y satura los microservicios backend de inventario y productos, degradando severamente la calidad del servicio.

#### Solución Técnica en Párrafos
La solución empresarial consiste en desacoplar el estado de los contadores de la memoria volátil del Gateway y migrar la directiva a una política centralizada mediante `policy: redis`.

Se debe incorporar un clúster de **Redis** de alta disponibilidad (con soporte de Redis Sentinel o Amazon ElastiCache) en la red interna. Todas las instancias de Kong compartirán el acceso a dicho clúster para incrementar y consultar de forma atómica los contadores de solicitudes mediante operaciones de tiempo constante. De esta forma, sin importar a cuál de las réplicas de Kong sea enrutada la solicitud del cliente, el consumo de cuota se descontará de una única fuente de verdad global en tiempo real, garantizando el cumplimiento estricto del límite perimetral en cualquier escenario de escalamiento horizontal.

*Líneas ilustrativas de configuración:*
```yaml
policy: redis
redis:
  host: redis-cluster.internal
  port: 6379
```

---

### HALLAZGO AUD-02: Exposición Irrestricta de la Admin API de Kong en Interfaces Públicas de Red
* **Severidad:** **ALTA**
* **Componente Afectado:** `kong-gateway/docker-compose.yml`

#### Enunciado y Detalle Técnico del Error
En la definición del servicio `kong` dentro de Docker Compose, el puerto administrativo `8001:8001` se encuentra vinculado de forma predeterminada a todas las interfaces de red del host (`0.0.0.0`), exponiendo los endpoints de gestión `/status`, `/services` y `/plugins` sin requerir credenciales de autenticación ni firmas criptográficas.

#### Cómo Afecta a la Aplicación y al Negocio
Cualquier actor malicioso o usuario no autorizado que logre visibilidad de red hacia el servidor puede interactuar directamente con la interfaz administrativa de Kong. Esto le permite inspeccionar la topología interna completa de los microservicios empresariales, auditar los endpoints privados, modificar rutas de enrutamiento o deshabilitar plugins perimetrales de seguridad como el limitador de tasa. Este escenario representa una vulnerabilidad de control de acceso roto (*Broken Access Control* - OWASP Top 10 A01), facilitando la denegación total de servicio o la redirección maliciosa del tráfico corporativo hacia servidores controlados por atacantes.

#### Solución Técnica en Párrafos
La remediación exige aplicar el principio de aislamiento de red y defensa en profundidad sobre el plano de control administrativo.

En primer lugar, se debe modificar la directiva de exposición de puertos en el archivo de orquestación para vincular el puerto administrativo exclusivamente a la interfaz de bucle invertido local (`127.0.0.1:8001:8001`), o bien eliminar la publicación del puerto hacia el host y confinarlo a una red privada de gestión (*management subnet*). En segundo lugar, se debe activar la autenticación obligatoria para la Admin API mediante certificados mutuos mTLS o mediante tokens de acceso restringidos gestionados por un proxy de autenticación interno. De este modo, únicamente los procesos automatizados de despliegue continuo (como pipelines de CI/CD) o los ingenieros de infraestructura autorizados podrán consultar o sincronizar el estado del Gateway.

*Línea ilustrativa de configuración:*
```yaml
ports:
  - "127.0.0.1:8001:8001"
```

---

### HALLAZGO AUD-03: Generación Estática e Inmutable del Identificador de Trazabilidad en `request-transformer`
* **Severidad:** **ALTA**
* **Componente Afectado:** `kong-gateway/kong.yml` (Plugin `request-transformer`)

#### Enunciado y Detalle Técnico del Error
El plugin `request-transformer` inyecta una cabecera de correlación fija mediante la directiva `headers: ["X-Correlation-Id:kong-generado"]`. Al tratarse de una cadena de texto estática, el Gateway estampa exactamente el mismo valor literal en la cabecera de todas y cada una de las peticiones que transitan hacia los microservicios de productos y BFF.

#### Cómo Afecta a la Aplicación y al Negocio
El propósito de la trazabilidad distribuida es identificar de forma inequívoca el ciclo de vida de cada transacción individual a lo largo de los múltiples saltos de red entre microservicios. Al asignar un identificador idéntico a todas las peticiones, los registros en las herramientas de agregación de logs (como Datadog, ElasticSearch o Grafana Loki) se vuelven homogéneos e indistinguibles. Ante un incidente de cobro duplicado, una excepción 500 no controlada o una auditoría forense de seguridad, los ingenieros de confiabilidad (SRE) no pueden aislar la traza de un usuario específico, anulando la capacidad de diagnóstico en tiempo real.

#### Solución Técnica en Párrafos
Se debe sustituir la inyección de cadenas estáticas por el plugin especializado **`correlation-id`** provisto de forma nativa por el ecosistema de Kong Gateway.

Este plugin implementa una lógica bidireccional inteligente: si el cliente emisor ya suministró una cabecera de correlación válida (por ejemplo, desde una aplicación móvil o una pasarela de pago), el Gateway la preserva y la propaga hacia los microservicios downstream para mantener la continuidad del rastreo. Si la petición carece de identificador, el plugin genera automáticamente un UUID versión 4 único por cada transacción entrante, inyectándolo tanto en la solicitud reenviada al backend como en la cabecera de la respuesta devuelta al consumidor, garantizando una trazabilidad estricta y auditable en todo el ecosistema.

*Líneas ilustrativas de configuración:*
```yaml
plugins:
  - name: correlation-id
    config:
      header_name: X-Correlation-Id
      generator: uuid
```

---

### HALLAZGO AUD-04: Ausencia de Circuit Breaker y Timeout Explícito en el Microservicio BFF / Aggregator
* **Severidad:** **MEDIA**
* **Componente Afectado:** `src/bff-api/aggregator.service.ts`

#### Enunciado y Detalle Técnico del Error
En el servicio `AggregatorService`, la orquestación entre la API REST de productos y el esquema GraphQL de inventario se ejecuta mediante peticiones HTTP secuenciales sin un mecanismo formal de tolerancia a fallos ni límites de tiempo estrictos ante degradación del servicio dependiente.

#### Cómo Afecta a la Aplicación y al Negocio
Si el microservicio de productos en el puerto 3000 experimenta sobrecarga o una ralentización en su tiempo de respuesta (por ejemplo, consultas lentas a disco o bloqueos de base de datos), el servicio Aggregator retendrá abiertas las conexiones esperando datos. En escenarios de alta concurrencia, este comportamiento agota rápidamente los sockets y la memoria del proceso de Node.js en el puerto 3001, propagando la degradación hacia el BFF. Esto genera una falla en cascada que bloquea el endpoint `/productos-completos` para todos los usuarios del sistema, incluso cuando la fuente de inventario GraphQL se encuentra completamente operativa.

#### Solución Técnica en Párrafos
La solución requiere implementar el patrón de resiliencia **Circuit Breaker** (Disyuntor) en la capa de integración HTTP del Aggregator, empleando librerías especializadas como `opossum` o interceptores de reintentos con Axios.

Se deben configurar umbrales cuantitativos que monitoreen la tasa de fallos y la latencia: si el servicio REST falla de forma consecutiva o supera un umbral de tiempo (por ejemplo, 1.5 segundos), el disyuntor debe pasar a estado "Abierto", interrumpiendo de inmediato nuevas llamadas hacia el servicio degradado para permitir su recuperación. Mientras el circuito permanezca abierto, el Aggregator debe proveer una respuesta degradada elegante (*graceful degradation*) entregando los datos disponibles de GraphQL y un estado de contingencia para la información de catálogo, protegiendo la estabilidad del microservicio agregador.

*Líneas ilustrativas de integración:*
```typescript
const breaker = new CircuitBreaker(llamarRest, { timeout: 1500, errorThresholdPercentage: 50 });
return breaker.fallback(() => obtenerCatalogoEnCache(id));
```

---

### HALLAZGO AUD-05: Dependencia de Resolución de Red Local mediante `host.docker.internal`
* **Severidad:** **MEDIA**
* **Componente Afectado:** `kong-gateway/kong.yml`

#### Enunciado y Detalle Técnico del Error
En la definición de los servicios de Kong, las URLs upstream se encuentran vinculadas a la dirección `http://host.docker.internal:3000` y `http://host.docker.internal:3001`. Este nombre de dominio es un mecanismo sintético provisto exclusivamente por Docker Desktop en estaciones de trabajo con Windows y macOS para acceder a servicios corriendo en la máquina host.

#### Cómo Afecta a la Aplicación y al Negocio
Al empaquetar y desplegar esta configuración en servidores Linux de producción (tales como instancias de AWS EC2, clústeres de Kubernetes o entornos PaaS como Render), el resolvedor DNS interno del contenedor de Kong no reconocerá el dominio `host.docker.internal`. Esto provocará que todas las peticiones entrantes sean rechazadas de inmediato con errores `502 Bad Gateway` debido a fallas de resolución de nombres, interrumpiendo por completo la continuidad del servicio al migrar el código desde el ambiente de desarrollo local hacia la nube.

#### Solución Técnica en Párrafos
Se debe eliminar la dependencia de direcciones propietarias del host e implementar una arquitectura de red interna con descubrimiento de servicios basado en nombres DNS canónicos de contenedor dentro de Docker Compose.

Se debe definir una red de puente compartida (`bridge network`) en la cual convivan el contenedor de Kong y los contenedores de los microservicios backend. Las URLs en el archivo declarativo `kong.yml` deben apuntar a los identificadores de servicio de la red (`http://productos-api:3000` y `http://bff-api:3001`). En entornos avanzados como Kubernetes, esta resolución se delega al servicio CoreDNS nativo del clúster, permitiendo que la configuración sea 100% portable, reproducible e independiente del sistema operativo anfitrión.

*Líneas ilustrativas de configuración:*
```yaml
url: http://productos-api:3000
```

---

### HALLAZGO AUD-06: Inexistencia de Comprobaciones de Salud Activas (*Active Health Checks*) en Upstreams de Kong
* **Severidad:** **MEDIA**
* **Componente Afectado:** `kong-gateway/kong.yml`

#### Enunciado y Detalle Técnico del Error
Los servicios de Kong se encuentran definidos mediante URLs directas sin la intermediación de una entidad de balanceo `upstream` de Kong que incluya sondeos periódicos de salud (*health checks* activos o pasivos).

#### Cómo Afecta a la Aplicación y al Negocio
Si uno de los microservicios internos se cuelga silenciosamente, experimenta un bloqueo en su bucle de eventos o pierde la conexión con sus dependencias, el Gateway continuará remitiéndole tráfico legítimo de los clientes externos hasta que la conexión expire por timeout. Los usuarios finales percibirán demoras prolongadas y errores de servidor intermitentes, ya que Kong no posee la capacidad de discernir proactivamente si la instancia backend destino está en condiciones operativas óptimas antes de delegarle una transacción.

#### Solución Técnica en Párrafos
La arquitectura debe evolucionar hacia el uso de entidades `upstream` de Kong configuradas con sondeos de salud activos (*Active Health Checks*).

Bajo este modelo, el Gateway define un grupo balanceado asociado a cada microservicio y envía periódicamente solicitudes HTTP automatizadas (por ejemplo, cada 5 segundos) hacia el endpoint `/api/health` de cada réplica backend. Si una instancia falla en responder exitosamente dos veces consecutivas, Kong la clasifica de manera autónoma como no saludable (*unhealthy*) y desvía el 100% del tráfico hacia réplicas sanas sin afectar a los usuarios. Cuando la instancia se restablece y responde con códigos 200 a los sondeos de comprobación, Kong la reincorpora automáticamente al grupo de balanceo.

*Líneas ilustrativas de configuración:*
```yaml
healthchecks:
  active:
    http_path: "/api/health"
    healthy: { successes: 2 }
    unhealthy: { http_failures: 2 }
```

---

### HALLAZGO AUD-07: Falta de Cifrado Mutuo TLS (mTLS) en la Comunicación de Red Interna Este-Oeste
* **Severidad:** **BAJA-MEDIA**
* **Componente Afectado:** Comunicación interna entre Kong Gateway y Microservicios NestJS

#### Enunciado y Detalle Técnico del Error
El tráfico de red entre Kong Gateway y los microservicios downstream se transmite mediante el protocolo HTTP estándar en texto plano sin cifrado criptográfico ni autenticación de identidad mutua.

#### Cómo Afecta a la Aplicación y al Negocio
Bajo el paradigma moderno de seguridad perimetral de las empresas, asumir que la red interna es segura es una práctica desaconsejada. En arquitecturas de nube pública, nubes híbridas o clústeres compartidos, el tráfico no cifrado entre contenedores puede ser interceptado si un actor malicioso logra vulnerar un contenedor adyacente dentro de la misma subred. Esto expone cabeceras de autorización corporativas, tokens JWT y datos sensibles de clientes y productos que viajan en claro por los enlaces de red internos.

#### Solución Técnica en Párrafos
Se recomienda adoptar el modelo de seguridad **Zero Trust** habilitando cifrado mutuo de nivel de transporte (**mTLS**) entre el Gateway y cada microservicio backend, o mediante la adopción de un **Service Mesh** complementario (como Istio o Linkerd).

El Gateway debe configurarse con un certificado digital de cliente firmado por una Autoridad Certificadora (CA) corporativa interna, y cada microservicio backend debe escuchar sobre HTTPS exigiendo la validación de dicho certificado en cada negociación TLS. De este modo, no solo se garantiza la total confidencialidad e integridad criptográfica de la información en tránsito, sino que se previene la ejecución de peticiones apócrifas que intenten eludir el Gateway para comunicarse directamente con los microservicios internos.

*Línea ilustrativa conceptual:*
```yaml
client_certificate:
  id: "uuid-certificado-mTLS"
```

---

## 3. PLAN DE REMEDIACIÓN Y HOJA DE RUTA PRIORIZADA (ROADMAP)

Para garantizar una transición controlada hacia un estado productivo robusto, se establece el siguiente cronograma de mitigación:

```
+-----------------------------------------------------------------------------------------+
| FASE 1: REMEDIACIÓN INMEDIATA (Semana 1) - SEGURIDAD Y RESILIENCIA PERIMETRAL          |
| • Aislar la Admin API vinculándola a 127.0.0.1 y activar credenciales de acceso (AUD-02)|
| • Migrar trazabilidad estática hacia el plugin correlation-id con UUID dinámico (AUD-03)|
| • Sustituir host.docker.internal por nombres DNS de contenedor en red bridge (AUD-05).   |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| FASE 2: ASEGURAMIENTO DEL TRÁFICO (Semanas 2 y 3) - ESTABILIDAD Y TOLERANCIA A FALLOS  |
| • Configurar clúster de Redis centralizado para el plugin rate-limiting (AUD-01).       |
| • Implementar Circuit Breakers con Opossum y timeouts en el BFF Aggregator (AUD-04).    |
| • Configurar Upstreams con Active Health Checks en /api/health (AUD-06).                |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
| FASE 3: ARQUITECTURA ZERO TRUST (Mes 2) - GOBERNANZA Y SERVICE MESH                     |
| • Implementar cifrado mutuo mTLS entre Kong Gateway y los microservicios (AUD-07).      |
| • Evaluar la introducción de Istio/Linkerd para gestión granular del tráfico Este-Oeste.|
| • Desplegar métricas de latencia de Gateway en Prometheus y tableros en Grafana.        |
+-----------------------------------------------------------------------------------------+
```

---

## 4. CONCLUSIÓN Y DICTAMEN DEL AUDITOR

El proyecto **Semana 8: Kong Gateway & Microservicios Suite** constituye una base arquitectónica destacada para la comprensión práctica de los puntos de entrada perimetrales y los patrones de composición distribuida:
* El uso del modo DB-less agiliza significativamente el despliegue declarativo y garantiza la inmutabilidad de la configuración mediante control de versiones (`GitOps`).
* La aplicación de políticas transversales (*Rate Limiting* y trazabilidad) en el Gateway alivia a los microservicios backend de implementar lógica redundante de infraestructura.
* La demostración del patrón BFF Aggregator valida la reducción sustancial de peticiones y latencia (*Chatty I/O*) para interfaces frontend modernas.

La adopción de las recomendaciones detalladas en este informe permitirá cerrar las brechas identificadas, elevando la solución a los estándares de resiliencia, seguridad y escalabilidad horizontal propios de infraestructuras empresariales de clase mundial.
