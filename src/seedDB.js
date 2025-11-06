import mongoConnection from "./config/mongodb.js";
import neo4jConnection from "./config/neo4j.js";
import fs, { appendFile } from "fs";
import csv from "csv-parser";

const BATCH_SIZE = 1000;

async function processCSVBatched(fileName, onBatch) {
    const filePath = `./dataset/${fileName}.csv`;
    return new Promise((resolve, reject) => {
        let batch = [];
        const stream = fs.createReadStream(filePath).pipe(csv());

        stream.on("data", async (data) => {
            batch.push(data);
            if (batch.length >= BATCH_SIZE) {
                stream.pause();
                await onBatch(batch);
                batch = [];
                stream.resume();
            }
        });

        stream.on("end", async () => {
            if (batch.length > 0) {
                await onBatch(batch);
            }
            resolve();
        });

        stream.on("error", (error) => reject(error));
    });
}

async function loadUsers(mongo, neo4j) {
    await mongo.collection("clientes").deleteMany({});

    await processCSVBatched("clientes", async (batch) => {
        if (batch.length === 0) return;

        await mongo.collection("clientes").insertMany(batch.map(cliente => ({
            ...cliente,
            activo: cliente.activo === 'True',
            vehiculos: [],
            polizas: []
        })));

        const neo4jBatch = batch.map(cliente => ({
            id_cliente: cliente.id_cliente,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            activo: cliente.activo === 'True'
        }));

        await neo4j.run(
            "UNWIND $batch AS u " +
            "CREATE (n:User {id_cliente: u.id_cliente, nombre: u.nombre, apellido: u.apellido, activo: u.activo})",
            { batch: neo4jBatch }
        );
    });
}

async function loadVehicles(mongo) {
    await processCSVBatched("vehiculos", async (batch) => {
        if (batch.length === 0) return;

        batch = batch.map((vehiculo) => ({
            ...vehiculo,
            anio: Number(vehiculo.anio),
            asegurado: vehiculo.asegurado === 'True'
        }));

        const operations = batch.map(vehiculo => {
            const { id_cliente, ...vehicle } = vehiculo;
            return {
                updateOne: {
                    filter: { id_cliente: id_cliente },
                    update: { $push: { vehiculos: vehicle } }
                }
            };
        });
        await mongo.collection("clientes").bulkWrite(operations);
    });
}

async function loadPolicies(mongo, neo4j) {
    await processCSVBatched("polizas", async (batch) => {
        if (batch.length === 0) return;

        batch = batch.map((poliza) => ({
            ...poliza,
            cobertura_total: Number(poliza.cobertura_total),
            prima_mensual: Number(poliza.prima_mensual),
        }));

        const mongoOps = batch.map(poliza => {
            const { id_cliente, ...policy } = poliza;

            return {
                updateOne: {
                    filter: { id_cliente: id_cliente },
                    update: { $push: { polizas: policy } }
                }
            };
        });
        await mongo.collection("clientes").bulkWrite(mongoOps);

        const neo4jBatch = batch.map(poliza => {
            const { id_cliente, ...policy } = poliza;
            return {
                id_cliente: id_cliente,
                ...policy
            };
        });

        await neo4j.run(
            "UNWIND $batch AS p " +
            "MATCH (u:User {id_cliente: p.id_cliente}) " +
            "CREATE (policy:Policy {nro_poliza: p.nro_poliza, tipo: p.tipo, cobertura_total: p.cobertura_total, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin, prima_mensual: p.prima_mensual, estado: p.estado}) " +
            "CREATE (u)-[:HAS_POLICY]->(policy)",
            { batch: neo4jBatch }
        );
    });
}

async function loadAgents(neo4j) {
    await processCSVBatched("agentes", async (batch) => {
        if (batch.length === 0) return;

        const neo4jBatch = batch.map(agente => ({
            ...agente,
            activo: agente.activo === 'True'
        }));

        await neo4j.run(
            "UNWIND $batch AS a " +
            "CREATE (n:Agent {id_agente: a.id_agente, nombre: a.nombre, apellido: a.apellido, matricula: a.matricula, telefono: a.telefono, email: a.email, zona: a.zona, activo: a.activo})",
            { batch: neo4jBatch }
        );
    });
}

async function loadAccidents(neo4j) {
    await processCSVBatched("siniestros", async (batch) => {
        if (batch.length === 0) return;

        const neo4jBatch = batch.map(siniestro => ({
            ...siniestro,
            monto_estimado: Number(siniestro.monto_estimado),
        }));
        
        await neo4j.run(
            "UNWIND $batch AS s " +
            "MATCH (p:Policy {nro_poliza: s.nro_poliza}) " +
            "CREATE (acc:Accident {id_siniestro: s.id_siniestro, fecha: s.fecha, descripcion: s.descripcion, monto_estimado: s.monto_estimado, estado: s.estado, tipo: s.tipo}) " +
            "CREATE (p)-[:HAS_ACCIDENT]->(acc)",
            { batch: neo4jBatch }
        );
    });
}

async function seedDatabases() {
    let neo4j;
    try {
        await mongoConnection.connect();    
        await neo4jConnection.connect();

        const mongo = mongoConnection.getDb();
        neo4j = neo4jConnection.getSession();

        console.log("Connected to both MongoDB and Neo4j databases.");

        await neo4j.run("MATCH (n) DETACH DELETE n");

        console.log("Seeding databases...");

        console.log("Loading users...");
        await loadUsers(mongo, neo4j);

        console.log("Loading vehicles...");
        await loadVehicles(mongo);

        console.log("Loading policies...");
        await loadPolicies(mongo, neo4j);

        console.log("Loading agents...");
        await loadAgents(neo4j);

        console.log("Loading accidents...");
        await loadAccidents(neo4j);
    } catch (error) {
        console.error("Error seeding databases:", error);
    } finally {
        if (neo4j) {
            await neo4j.close();
        }

        await mongoConnection.close();
        await neo4jConnection.close();
        console.log("Database connections closed.");
    }
}

seedDatabases();