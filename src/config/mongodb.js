import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_PORT = process.env.MONGO_PORT || '27017';
const MONGO_USER = process.env.MONGO_USER || 'admin';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'admin123';
const MONGO_DATABASE = process.env.MONGO_DATABASE || 'testdb';

const MONGO_URL = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}`;

let client;
let db;

export async function connectMongoDB() {
  try {
    client = new MongoClient(MONGO_URL);
    await client.connect();
    db = client.db(MONGO_DATABASE);
    console.log('✅ Conectado a MongoDB');
    return db;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
}

export function getMongoClient() {
  return client;
}

export function getMongoDB() {
  return db;
}

export async function closeMongoDB() {
  if (client) {
    await client.close();
    console.log('🔌 Desconectado de MongoDB');
  }
}
