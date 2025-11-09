import { query1, query2, query3, query4, query5, query6, query7, query8, query9, query10,query11,query12 } from "./queries.js";
import { validateDateFormat, validateDateRange, formatDate } from './utils/validation.js';

import ClientService from "./services/clientService.js";
import PolicyService from "./services/policyService.js";
import AccidentService from "./services/accidentService.js";

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
    "Query 11: Clientes con más de un auto asegurado.": query11,
    "Query 12: Agentes y cantidad de siniestros asociados.": query12
}

async function main() {
    console.log(chalk.green(await figlet.text("ASEGURADORA S.A.", {font: "Big"})));

    await mongoConnection.connect();
    await neo4jConnection.connect();

    while (true) {
        console.log("\n" + "=".repeat(60));
        
        const mainChoice = await inquirer.prompt([{
            type: "list",
            name: "action",
            message: "🏠 MENÚ PRINCIPAL - Seleccionar sección:",
            choices: [
                "📊 Consultas",
                "🛠️  Gestión",
                new inquirer.Separator(),
                "🚪 Salir"
            ],
            pageSize: 5
        }]);

        if (mainChoice.action === "🚪 Salir") {
            break;
        } else if (mainChoice.action === "📊 Consultas") {
            await handleQueriesMenu();
        } else if (mainChoice.action === "🛠️  Gestión") {
            await handleServicesMenu();
        }
    }

    console.log(chalk.yellow("\n🔄 Cerrando conexiones..."));
    await mongoConnection.close();
    await neo4jConnection.close();
    console.log(chalk.green("✅ ¡Hasta luego!"));
    process.exit(0);
}

async function handleQueriesMenu() {
    while (true) {
        console.log("\n" + "=".repeat(60));
        
        const choices = [
            ...Object.keys(queries),
            new inquirer.Separator(),
            "← Volver al menú principal"
        ];

        const queryChoice = await inquirer.prompt([{
            type: "list",
            name: "selectedQuery",
            message: "📊 CONSULTAS - Seleccionar query a ejecutar:",
            choices: choices,
            pageSize: choices.length,
            loop: false
        }]);

        if (queryChoice.selectedQuery === "← Volver al menú principal") {
            break;
        }

        await executeQuery(queryChoice.selectedQuery);
    }
}

async function handleServicesMenu() {
    while (true) {
        console.log("\n" + "=".repeat(60));
        
        const serviceChoice = await inquirer.prompt([{
            type: "list",
            name: "selectedService",
            message: "🛠️  GESTIÓN - Seleccionar operación:",
            choices: [
                new inquirer.Separator("--- CLIENTES ---"),
                "👤 Crear Cliente",
                "✏️  Modificar Cliente", 
                "🗑️  Eliminar Cliente",
                new inquirer.Separator("\n--- PÓLIZAS ---"),
                "📋 Emitir Póliza",
                new inquirer.Separator("\n--- SINIESTROS ---"),
                "🚨 Emitir Siniestro",
                new inquirer.Separator(),
                "← Volver al menú principal"
            ],
            pageSize: 15,
            loop: false
        }]);

        if (serviceChoice.selectedService === "← Volver al menú principal") {
            break;
        }

        await executeService(serviceChoice.selectedService);
    }
}

async function executeQuery(selectedQuery) {
    const outputChoice = await inquirer.prompt([{
        type: "input",
        name: "outputFile",
        message: "📄 Nombre del archivo de salida (sin extensión):",
        default: "queryResult",
        validate: (input) => {
            if (input.trim() === "") return "El nombre del archivo no puede estar vacío";
            if (/[<>:"/\\|?*]/.test(input)) return "El nombre contiene caracteres inválidos";
            return true;
        }
    }]);

    const spinner = ora(`🔄 Ejecutando query: ${selectedQuery}`).start();

    try {
        const queryResult = await queries[selectedQuery]();
        spinner.succeed(chalk.green(`✅ Query ejecutada con éxito`));

        const outputPath = `./${outputChoice.outputFile}.json`;
        const fileSpinner = ora(`💾 Guardando resultado en ${outputPath}`).start();
        await fs.writeFileSync(outputPath, JSON.stringify(queryResult, null, 2));
        fileSpinner.succeed(chalk.green(`✅ Resultado guardado en ${outputPath}`));
    } catch (error) {
        spinner.fail(chalk.red(`❌ Error al ejecutar la query`));
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

async function executeService(selectedService) {
    try {
        switch (selectedService) {
            case "👤 Crear Cliente":
                await createClientFlow();
                break;
            case "✏️  Modificar Cliente":
                await updateClientFlow();
                break;
            case "🗑️  Eliminar Cliente":
                await deleteClientFlow();
                break;
            case "📋 Emitir Póliza":
                await createPolicyFlow();
                break;
            case "🚨 Emitir Siniestro":
                await createAccidentFlow();
                break;
        }
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
    }
}

async function createClientFlow() {
    console.log(chalk.blue("\n👤 CREAR NUEVO CLIENTE"));
    
    const clientData = await inquirer.prompt([
        {
            type: "input",
            name: "nombre",
            message: "Nombre:",
            validate: (input) => input.trim() ? true : "Nombre es requerido"
        },
        {
            type: "input", 
            name: "apellido",
            message: "Apellido:",
            validate: (input) => input.trim() ? true : "Apellido es requerido"
        },
        {
            type: "input",
            name: "dni",
            message: "DNI:",
            validate: (input) => /^\d+$/.test(input) ? true : "DNI debe contener solo números"
        },
        {
            type: "input",
            name: "email",
            message: "Email:",
            validate: (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? true : "Email inválido"
        },
        {
            type: "input",
            name: "telefono", 
            message: "Teléfono:",
            validate: (input) => /^\d+$/.test(input) ? true : "Teléfono debe contener solo números"
        },
        {
            type: "input",
            name: "direccion",
            message: "Dirección:"
        },
        {
            type: "input",
            name: "ciudad",
            message: "Ciudad:"
        },
        {
            type: "input",
            name: "provincia",
            message: "Provincia:"
        },
        {
            type: "confirm",
            name: "addVehicles",
            message: "¿Desea agregar vehículos?",
            default: false
        }
    ]);

    if (clientData.addVehicles) {
        clientData.vehiculos = await addVehicles();
    }

    const spinner = ora("🔄 Creando cliente...").start();

    try {
        const result = await ClientService.createClient(clientData);
        spinner.succeed(chalk.green(`✅ Cliente creado exitosamente con ID: ${result.id_cliente}`));
    } catch (error) {
        spinner.fail(chalk.red(`❌ Error creando cliente: ${error.message}`));
        throw error;
    }
}

async function updateClientFlow() {
    console.log(chalk.blue("\n✏️  MODIFICAR CLIENTE"));
    
    const { id_cliente } = await inquirer.prompt([{
        type: "input",
        name: "id_cliente",
        message: "ID del cliente a modificar:",
        validate: (input) => input.trim() ? true : "ID es requerido"
    }]);

    const fieldsToUpdate = await inquirer.prompt([
        {
            type: "checkbox",
            name: "fields",
            message: "Seleccionar campos a modificar (use espacio para seleccionar):",
            choices: [
                { name: "Nombre", value: "nombre" },
                { name: "Apellido", value: "apellido" },
                { name: "Email", value: "email" },
                { name: "Teléfono", value: "telefono" },
                { name: "Dirección", value: "direccion" },
                { name: "Ciudad", value: "ciudad" },
                { name: "Provincia", value: "provincia" },
                { name: "Estado activo", value: "activo" },
                { name: "Agregar vehículos", value: "vehiculos" }
            ],
            loop: false
        }
    ]);

    if (fieldsToUpdate.fields.length === 0) {
        console.log(chalk.yellow("⚠️  No se seleccionaron campos para modificar"));
        return;
    }

    const updateData = {};

    for (const field of fieldsToUpdate.fields) {
        if (field === "activo") {
            const { activo } = await inquirer.prompt([{
                type: "confirm",
                name: "activo",
                message: "¿Cliente activo?",
                default: true
            }]);
            updateData.activo = activo;
        } else if (field === "vehiculos") {
            updateData.vehiculos = await addVehicles();
        } else {
            const { value } = await inquirer.prompt([{
                type: "input",
                name: "value",
                message: `Nuevo ${field}:`
            }]);
            if (value.trim()) updateData[field] = value;
        }
    }

    const spinner = ora("🔄 Actualizando cliente...").start();

    try {
        const result = await ClientService.updateClient(id_cliente, updateData);
        spinner.succeed(chalk.green(`✅ Cliente ${id_cliente} actualizado exitosamente`));
    } catch (error) {
        spinner.fail(chalk.red("❌ Error actualizando cliente"));
        throw error;
    }
}

async function deleteClientFlow() {
    console.log(chalk.red("\n🗑️  ELIMINAR CLIENTE"));
    
    const { id_cliente } = await inquirer.prompt([{
        type: "input",
        name: "id_cliente",
        message: "ID del cliente a eliminar:",
        validate: (input) => input.trim() ? true : "ID es requerido"
    }]);

    const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: `⚠️  ¿Está seguro de eliminar el cliente ${id_cliente}? Esta acción no se puede deshacer.`,
        default: false
    }]);

    if (!confirm) {
        console.log(chalk.yellow("🚫 Operación cancelada"));
        return;
    }

    const spinner = ora("🔄 Eliminando cliente...").start();

    try {
        await ClientService.eliminarCliente(id_cliente);
        spinner.succeed(chalk.green(`✅ Cliente ${id_cliente} eliminado exitosamente`));
    } catch (error) {
        spinner.fail(chalk.red("❌ Error eliminando cliente"));
        throw error;
    }
}

async function createPolicyFlow() {
    console.log(chalk.blue("\n📋 EMITIR NUEVA PÓLIZA"));
    
    const policyData = await inquirer.prompt([
        {
            type: "input",
            name: "id_cliente",
            message: "ID del cliente:",
            validate: (input) => input.trim() ? true : "ID del cliente es requerido"
        },
        {
            type: "input",
            name: "id_agente", 
            message: "ID del agente:",
            validate: (input) => input.trim() ? true : "ID del agente es requerido"
        },
        {
            type: "list",
            name: "tipo",
            message: "Tipo de póliza:",
            choices: ["Auto", "Vida", "Hogar", "Salud"]
        },
        {
            type: "input",
            name: "cobertura_total",
            message: "Cobertura total ($):",
            validate: (input) => !isNaN(input) && Number(input) > 0 ? true : "Debe ser un número positivo"
        },
        {
            type: "input",
            name: "prima_mensual",
            message: "Prima mensual ($):",
            validate: (input) => !isNaN(input) && Number(input) > 0 ? true : "Debe ser un número positivo"
        },
        {
            type: "input",
            name: "fecha_inicio",
            message: "Fecha de inicio (DD/MM/YYYY):",
            default: () => formatDate(new Date()), 
            validate: (input) => validateDateFormat(input) ? true : "Formato debe ser DD/MM/YYYY (ej: 15/01/2025)"
        }
    ]);
     const policyEndDate = await inquirer.prompt([
        {
            type: "input",
            name: "fecha_fin",
            message: "Fecha de fin (DD/MM/YYYY):",
            validate: (input) => {
                if (!validateDateFormat(input)) {
                    return "Formato debe ser DD/MM/YYYY (ej: 15/01/2026)";
                }               
                if (!validateDateRange(policyData.fecha_inicio, input)) {
                    return "Fecha de fin debe ser posterior a fecha de inicio";
                }
                
                return true;
            }
        }
    ]);
    policyData.fecha_fin = policyEndDate.fecha_fin;
    const spinner = ora("🔄 Emitiendo póliza...").start();

    try {
        const result = await PolicyService.emitPolicy(policyData);
        spinner.succeed(chalk.green(`✅ Póliza ${result.nro_poliza} emitida exitosamente`));
    } catch (error) {
        spinner.fail(chalk.red("❌ Error emitiendo póliza"));
        throw error;
    }
}

async function createAccidentFlow() {
    console.log(chalk.red("\n🚨 EMITIR NUEVO SINIESTRO"));
    
    const accidentData = await inquirer.prompt([
        {
            type: "input",
            name: "nro_poliza",
            message: "Número de póliza:",
            validate: (input) => /^POL\d+$/.test(input) ? true : "Número de póliza debe ser en formato POL + dígitos"
        },
        {
            type: "list",
            name: "tipo",
            message: "Tipo de siniestro:",
            choices: ["Accidente", "Robo", "Incendio", "Danio", "Vandalismo"]
        },
        {
            type: "input",
            name: "fecha",
            message: "Fecha del siniestro (DD/MM/YYYY):",
            default: () => formatDate(new Date()),
            validate: function(input) { 
                if (!validateDateFormat(input)) {
                    return "Formato debe ser DD/MM/YYYY (ej: 15/01/2025)";
                }
                const todayStr = formatDate(new Date());
                if (validateDateRange(todayStr, input)) {
                    return "La fecha del siniestro no puede ser futura";
                }
                return true;
            }
        },
        {
            type: "input",
            name: "monto_estimado",
            message: "Monto estimado ($):",
            validate: (input) => !isNaN(input) && Number(input) > 0 ? true : "Debe ser un número positivo"
        },
        {
            type: "input",
            name: "descripcion",
            message: "Descripción del siniestro:",
        },
        {
            type: "list",
            name: "estado",
            message: "Estado inicial:",
            choices: ["Abierto", "En evaluacion"],
            default: "Abierto"
        }
    ]);

    const spinner = ora("🔄 Emitiendo siniestro...").start();

    try {
        const result = await AccidentService.emitAccident(accidentData);
        spinner.succeed(chalk.green(`✅ Siniestro ${result.id_siniestro} emitido exitosamente`));
    } catch (error) {
        spinner.fail(chalk.red("❌ Error emitiendo siniestro"));
        throw error;
    }
}

async function addVehicles() {
    const vehicles = [];
    let addMore = true;

    while (addMore) {
        console.log(chalk.cyan(`\n🚗 Vehículo ${vehicles.length + 1}:`));
        
        const vehicle = await inquirer.prompt([
            {
                type: "input",
                name: "marca",
                message: "Marca:",
                validate: (input) => input.trim() ? true : "Marca es requerida"
            },
            {
                type: "input",
                name: "modelo", 
                message: "Modelo:",
                validate: (input) => input.trim() ? true : "Modelo es requerido"
            },
            {
                type: "input",
                name: "anio",
                message: "Año:",
                validate: (input) => /^\d{4,}$/.test(input) ? true : "Año debe tener 4 o más dígitos"
            },
            {
                type: "input",
                name: "patente",
                message: "Patente:",
                validate: (input) => input.trim() ? true : "Patente es requerida"
            },
            {
                type: "input",
                name: "nro_chasis",
                message: "Número de chasis:",
                validate: (input) => input.trim() ? true : "Número de chasis es requerido"
            }
        ]);

        vehicles.push(vehicle);

        const { continueAdding } = await inquirer.prompt([{
            type: "confirm",
            name: "continueAdding",
            message: "¿Desea agregar otro vehículo?",
            default: false
        }]);

        addMore = continueAdding;
    }

    return vehicles;
}

main().catch(console.error);