# Proyecto MongoDB + Neo4j con Docker

Proyecto de JavaScript para trabajar con MongoDB y Neo4j en contenedores Docker.

## Requisitos

- Docker y Docker Compose instalados
- Node.js v18 o superior

## Instalación

1. Copiar el archivo de configuración:
```bash
cp .env.example .env
```

2. Editar `.env` con tus credenciales si es necesario.

3. Instalar dependencias:
```bash
npm install
```

4. Levantar los contenedores:
```bash
npm run docker:up
```

5. **Esperar a que las bases de datos estén completamente inicializadas** (puede tomar 10-30 segundos):
```bash
npm run docker:logs
```
Espera a ver los mensajes:
- MongoDB: `Waiting for connections`
- Neo4j: `Started.`

## Configuración

Todas las configuraciones se encuentran en el archivo `.env`:

- `MONGO_HOST`, `MONGO_PORT`: Host y puerto de MongoDB
- `MONGO_USER`, `MONGO_PASSWORD`: Credenciales de MongoDB
- `MONGO_DATABASE`: Nombre de la base de datos
- `NEO4J_HOST`, `NEO4J_BOLT_PORT`, `NEO4J_HTTP_PORT`: Configuración de Neo4j
- `NEO4J_USER`, `NEO4J_PASSWORD`: Credenciales de Neo4j

## Uso

Ejecutar el ejemplo:
```bash
npm start
```

**Nota**: La aplicación verificará automáticamente que las bases de datos estén listas antes de ejecutar los ejemplos.

## Acceso a las interfaces

- **MongoDB**: Usar MongoDB Compass o mongo shell en `mongodb://admin:admin123@localhost:27017`
- **Neo4j Browser**: Abrir en navegador `http://localhost:7474` (usuario: neo4j, password: admin123)

**Nota**: Las URLs y credenciales dependen de tu configuración en `.env`.

Para abrir Neo4j Browser automáticamente:
```bash
npm run neo4j:browser
```

## Scripts disponibles

### Docker
- `npm run docker:up` - Levantar contenedores en segundo plano
- `npm run docker:down` - Detener y eliminar contenedores
- `npm run docker:restart` - Reiniciar contenedores
- `npm run docker:logs` - Ver logs de los contenedores
- `npm run docker:status` - Ver estado de los contenedores
- `npm run docker:clean` - Detener contenedores y limpiar volúmenes

### Aplicación
- `npm start` - Ejecutar el ejemplo principal
- `npm run dev` - Ejecutar en modo desarrollo (con watch)

### Utilidades
- `npm run neo4j:browser` - Abrir Neo4j Browser en el navegador
- `npm run mongo:shell` - Conectar a MongoDB shell
- `npm run neo4j:shell` - Conectar a Neo4j Cypher shell

## Estructura del proyecto

```
src/
  ├── config/
  │   ├── mongodb.js    # Configuración MongoDB
  │   └── neo4j.js      # Configuración Neo4j
  └── index.js          # Ejemplo de uso
.env                    # Configuración (no incluido en git)
.env.example            # Plantilla de configuración
docker-compose.yml      # Configuración de contenedores
```

## Troubleshooting

### Error: Connection was closed by server (Neo4j)
Si obtienes este error, significa que Neo4j aún no ha terminado de inicializarse. Espera unos segundos más y vuelve a ejecutar `npm start`.

Para verificar el estado de los contenedores:
```bash
npm run docker:status
npm run docker:logs
```

## Seguridad

⚠️ **IMPORTANTE**: Nunca subas el archivo `.env` a tu repositorio. Usa `.env.example` como plantilla.