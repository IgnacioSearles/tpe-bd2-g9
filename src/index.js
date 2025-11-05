import { connectMongoDB, getMongoDB, closeMongoDB } from './config/mongodb.js';
import { connectNeo4j, getNeo4jDriver, closeNeo4j } from './config/neo4j.js';

async function ejemploMongoDB() {
  console.log('\n📦 Ejemplo MongoDB:');
  const db = getMongoDB();
  const collection = db.collection('usuarios');

  // Insertar documento
  const resultado = await collection.insertOne({
    nombre: 'Juan',
    edad: 30,
    email: 'juan@example.com'
  });
  console.log('Documento insertado:', resultado.insertedId);

  // Consultar documentos
  const usuarios = await collection.find({}).toArray();
  console.log('Usuarios:', usuarios);
}

async function ejemploNeo4j() {
  console.log('\n🔗 Ejemplo Neo4j:');
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    // Crear nodo
    const resultado = await session.run(
      'CREATE (p:Persona {nombre: $nombre, edad: $edad}) RETURN p',
      { nombre: 'María', edad: 25 }
    );
    console.log('Nodo creado:', resultado.records[0].get('p').properties);

    // Consultar nodos
    const consulta = await session.run('MATCH (p:Persona) RETURN p');
    console.log('Personas:', consulta.records.map(r => r.get('p').properties));
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    // Conectar a las bases de datos
    await connectMongoDB();
    await connectNeo4j();

    console.log('\n🚀 Ejecutando ejemplos...');

    // Ejecutar ejemplos
    await ejemploMongoDB();
    await ejemploNeo4j();

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Cerrar conexiones
    await closeMongoDB();
    await closeNeo4j();
  }
}

main();
