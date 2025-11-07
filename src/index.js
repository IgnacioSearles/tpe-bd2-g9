import { query1, query2, query3, query4, query5 } from "./queries.js";

import mongoConnection from "./config/mongodb.js";
import neo4jConnection from "./config/neo4j.js";
import fs from "fs";

import figlet from "figlet";

import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";

const queries = {
    "Query 1: Clientes activos con sus pólizas vigentes.": query1,
    "Query 2: Siniestros abiertos con tipo, monto y cliente afectado.": query2,
    "Query 3: Vehículos asegurados con su cliente y póliza.": query3,
    "Query 4: Clientes sin pólizas activas.": query4,
    "Query 5: Agentes activos con cantidad de pólizas asignadas.": query5
}

const queryResultFile = "./queryResult.json";

async function main() {
    console.log(chalk.green(await figlet.text("ASEGURADORA S.A.", {font: "Big"})));

    await mongoConnection.connect();
    await neo4jConnection.connect();

    const answer = await inquirer.prompt({
        type: "list",
        name: "selectedQuery",
        message: " Seleccionar query a ejecutar: ",
        choices: Object.keys(queries)
    });

    const spinner = ora(` Ejecutando query: ${answer.selectedQuery}`).start();

    try {
        const queryResult = await queries[answer.selectedQuery]();
        spinner.succeed(chalk.green(` Query ejecutada con éxito`));

        const fileSpinner = ora(` Guardando resultado en ${queryResultFile}`).start();
        await fs.writeFileSync(queryResultFile, JSON.stringify(queryResult, null, 2));
        fileSpinner.succeed(chalk.green(` Resultado guardado en ${queryResultFile}`));
    } catch (error) {
        spinner.fail(chalk.red(` Error al ejecutar la query`));
    }

    await mongoConnection.close();
    await neo4jConnection.close();
}

main();