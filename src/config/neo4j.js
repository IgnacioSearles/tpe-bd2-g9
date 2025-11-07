import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

import ora from "ora";

dotenv.config();

class Neo4jConnector {
    constructor() {
        const NEO4J_HOST = process.env.NEO4J_HOST;
        const NEO4J_BOLT_PORT = process.env.NEO4J_BOLT_PORT;
        const NEO4J_USER = process.env.NEO4J_USER;
        const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

        this.NEO4J_URL = `bolt://${NEO4J_HOST}:${NEO4J_BOLT_PORT}`;
        this.auth = neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD);
        this.driver = null;
    }

    async connect() {
        if (this.driver) {
            return this.driver;
        }

        const spinner = ora(' Conectando a Neo4j...').start();

        try {
            this.driver = neo4j.driver(this.NEO4J_URL, this.auth);
            await this.driver.verifyConnectivity();
            spinner.succeed(' Conectado a Neo4j');
            return this.driver;
        } catch (error) {
            spinner.fail('Error conectando a Neo4j');
            console.error('❌ Error conectando a Neo4j:', error);
            throw error;
        }
    }

    getDriver() {
        if (!this.driver) {
            throw new Error('Driver de Neo4j no conectado. Llama a connect() primero.');
        }

        return this.driver;
    }
    
    getSession() {
        return this.getDriver().session();
    }

    async close() {
        if (this.driver) {
            await this.driver.close();
            this.driver = null;
            console.log('🔌 Desconectado de Neo4j');
        }
    }
}

const neo4jConnection = new Neo4jConnector();
export default neo4jConnection;
