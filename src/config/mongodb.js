import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class MongoConnector {
    constructor() {
        const MONGO_HOST = process.env.MONGO_HOST;
        const MONGO_PORT = process.env.MONGO_PORT;
        const MONGO_USER = process.env.MONGO_USER;
        const MONGO_PASSWORD = process.env.MONGO_PASSWORD;

        this.MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}`;
        this.DB_NAME = process.env.MONGO_DATABASE;
        this.client = null;
    }

    async connect() {
        if (this.client) {
            return this.client;
        }

        try {
            this.client = new MongoClient(this.MONGO_URI);
            await this.client.connect();
            console.log('✅ Conectado a MongoDB');
            return this.client;
        } catch (error) {
            console.error('❌ Error conectando a MongoDB:', error);
            throw error;
        }
    }

    getClient() {
        if (!this.client) {
            throw new Error('Cliente de MongoDB no conectado. Llama a connect() primero.');
        }
        return this.client;
    }
    
    getDb() {
        return this.getClient().db(this.DB_NAME);
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null; // Resetea el cliente
            console.log('🔌 Desconectado de MongoDB');
        }
    }
}

const mongoConnection = new MongoConnector();
export default mongoConnection;
