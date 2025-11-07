import { query1, query2, query3, query4, query5, query6, query7, query8, query9, query10 } from "./queries.js";

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
    "Query 5: Agentes activos con cantidad de pólizas asignadas.": query5,
    "Query 6: Pólizas vencidas con el nombre del cliente.": query6,
    "Query 7: Top 10 clientes con mayor cobertura total acumulada.": query7,
    "Query 8: Siniestros por accidente del último año.": query8,
    "Query 9: Pólizas activas ordenadas por fecha de inicio.": query9,
    "Query 10: Pólizas suspendidas con estado del cliente.": query10,
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
        choices: [...Object.keys(queries), new inquirer.Separator(), "Salir"],
        pageSize: Object.keys(queries).length + 2,
        loop: false
    });

    if (answer.selectedQuery === "Salir") {
        console.log(chalk.yellow(" Saliendo del programa..."));
        await mongoConnection.close();
        await neo4jConnection.close();
        process.exit(0);
    }

    const spinner = ora(` Ejecutando query: ${answer.selectedQuery}`).start();

    try {
        const queryResult = await queries[answer.selectedQuery]();
        spinner.succeed(chalk.green(` Query ejecutada con éxito`));

        const fileSpinner = ora(` Guardando resultado en ${queryResultFile}`).start();
        await fs.writeFileSync(queryResultFile, JSON.stringify(queryResult, null, 2));
        fileSpinner.succeed(chalk.green(` Resultado guardado en ${queryResultFile}`));
    } catch (error) {
        spinner.fail(chalk.red(` Error al ejecutar la query`));
        console.error(error);
    }

    await mongoConnection.close();
    await neo4jConnection.close();
}

main();