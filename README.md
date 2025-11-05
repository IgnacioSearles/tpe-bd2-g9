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

5. **Esperar a que las bases de datos estén completamente inicializadas**:
```bash
npm run docker:logs
```

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

Para verificar el estado de los contenedores:
```bash
npm run docker:status
npm run docker:logs
```
