import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const NEO4J_HOST = process.env.NEO4J_HOST || 'localhost';
const NEO4J_BOLT_PORT = process.env.NEO4J_BOLT_PORT || '7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'admin123';

const NEO4J_URL = `bolt://${NEO4J_HOST}:${NEO4J_BOLT_PORT}`;

let driver;

export async function connectNeo4j() {
  try {
    driver = neo4j.driver(
      NEO4J_URL,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
    );
    console.log('✅ Conectado a Neo4j');
    return driver;
  } catch (error) {
    console.error('❌ Error conectando a Neo4j:', error);
    throw error;
  }
}

export function getNeo4jDriver() {
  return driver;
}

export async function closeNeo4j() {
  if (driver) {
    await driver.close();
    console.log('🔌 Desconectado de Neo4j');
  }
}
