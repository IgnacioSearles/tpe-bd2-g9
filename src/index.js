import { query1, query2, query3 } from "./queries.js";
import mongoConnection from "./config/mongodb.js";
import neo4jConnection from "./config/neo4j.js";

async function main() {
    await mongoConnection.connect();
    await neo4jConnection.connect();

    /*
    console.log("Running Query 1:");
    const clientes = await query1();
    console.log(JSON.stringify(clientes, null, 2));

    console.log("Running Query 2:");
    const siniestros = await query2();
    console.log(JSON.stringify(siniestros, null, 2));
    */
    console.log("Running Query 3:");
    const vehiculos = await query3();
    console.log(JSON.stringify(vehiculos, null, 2));

    await mongoConnection.close();
    await neo4jConnection.close();
}

main();
