import mongoConnection from "../config/mongodb.js";
import neo4jConnection from "../config/neo4j.js";
import { validateClient, validateClientUpdate } from "../utils/validation.js";

export class ClientService {

    static FIELD_CONFIG = {
        updatable_mongodb: ['nombre', 'apellido', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'activo'],
        updatable_neo4j: ['nombre', 'apellido', 'activo'],
        forbidden: ['id_cliente', 'dni', 'polizas', '_id']
    };

    async createClient(clientData) {
        const mongo = mongoConnection.getDb();
        const session = neo4jConnection.getSession();
        let clientCreatedInMongo = false;
        let id_cliente = null;

        try {
            validateClient(clientData);

            const completeClient = await this.#createClientMongoDB(clientData, mongo);

            id_cliente = completeClient.id_cliente;
            clientCreatedInMongo = true;

            await session.executeWrite(async tx => {
                const result = await tx.run(
                    `CREATE (u:User {
                        id_cliente: $id_cliente,
                        nombre: $nombre,
                        apellido: $apellido,
                        activo: $activo
                    })
                    RETURN u.id_cliente as cliente_creado`,
                    {
                        id_cliente: id_cliente,
                        nombre: clientData.nombre,
                        apellido: clientData.apellido,
                        activo: true
                    }
                );

                if (result.records.length === 0) {
                    throw new Error('Error creando cliente en Neo4j');
                }

                return result.records[0].get('cliente_creado');
            });

            return {
                success: true,
                id_cliente: id_cliente
            };

        } catch (error) {
            if (clientCreatedInMongo && id_cliente) {
                await this.#rollbackClientMongo(mongo, id_cliente);
            }
            throw error;
        } finally {
            await session.close();
        }
    }

    async updateClient(id_cliente, updateData) {
        const mongo = mongoConnection.getDb();
        const session = neo4jConnection.getSession();
        let clientUpdatedInMongo = false;
        let originalClientData = null;

        try {
            validateClientUpdate(updateData);

            const updateResult = await this.#updateClientMongo(
                id_cliente,
                updateData,
                mongo
            );

            originalClientData = updateResult.originalData;
            clientUpdatedInMongo = true;

            await this.#updateClientNeo4j(
                id_cliente,
                updateData,
                session
            );

            return {
                success: true,
                id_cliente: id_cliente
            };

        } catch (error) {
            if (clientUpdatedInMongo && originalClientData) {
                await this.#rollbackUpdateMongo(id_cliente, originalClientData, mongo);
            }
            throw error;
        } finally {
            await session.close();
        }
    }

    async eliminarCliente(id_cliente) {
        const mongo = mongoConnection.getDb();
        const session = neo4jConnection.getSession();
        let clientDeletedInMongo = false;
        let mongoBackupData = null;

        try {
            mongoBackupData = await mongo.collection("clientes").findOne(
                { id_cliente: id_cliente }
            );

            if (!mongoBackupData) {
                throw new Error(`Cliente ${id_cliente} no encontrado`);
            }

            await this.#deleteClientMongoDB(id_cliente, mongo);
            clientDeletedInMongo = true;

            await this.#deleteClientNeo4j(id_cliente, session);

            return {
                success: true,
                id_cliente: id_cliente,
            };

        } catch (error) {
            if (clientDeletedInMongo && mongoBackupData) {
                await this.#rollbackDeleteMongo(mongoBackupData, mongo);
            }
            throw error;
        } finally {
            await session.close();
        }
    }

    async #createClientMongoDB(clientData, mongo) {
        const mongoSession = mongo.client.startSession();

        try {
            return await mongoSession.withTransaction(async () => {

                const data = await this.#validateAndGetData(clientData, mongo, mongoSession);

                if (data.dniExists) {
                    throw new Error(`Ya existe un cliente con DNI ${clientData.dni} (ID: ${data.existingDni.id_cliente})`);
                }

                if (data.patentConflicts.length > 0) {
                    const conflicts = data.patentConflicts.map(p => `${p.patente} (Cliente ${p.id_cliente})`);
                    throw new Error(`Patentes ya existentes: ${conflicts.join(', ')}`);
                }

                if (clientData.vehiculos?.length > 0) {
                    const patents = clientData.vehiculos.map(v => v.patente).filter(Boolean);
                    if (new Set(patents).size !== patents.length) {
                        throw new Error('Patentes duplicadas en la misma operación');
                    }
                }

                const newClientId = (parseInt(data.lastClientId) + 1).toString();
                let completeVehicles = [];

                if (clientData.vehiculos?.length > 0) {
                    const baseVehicleId = parseInt(data.lastVehicleId) + 1;
                    completeVehicles = clientData.vehiculos.map((vehiculo, i) => ({
                        id_vehiculo: (baseVehicleId + i).toString(),
                        marca: vehiculo.marca,
                        modelo: vehiculo.modelo,
                        anio: Number(vehiculo.anio),
                        patente: vehiculo.patente,
                        nro_chasis: vehiculo.nro_chasis,
                        asegurado: false
                    }));
                }

                const completeClient = {
                    id_cliente: newClientId,
                    nombre: clientData.nombre,
                    apellido: clientData.apellido,
                    dni: clientData.dni,
                    email: clientData.email,
                    telefono: clientData.telefono,
                    direccion: clientData.direccion,
                    ciudad: clientData.ciudad,
                    provincia: clientData.provincia,
                    activo: true,
                    vehiculos: completeVehicles,
                    polizas: []
                };

                const mongoResult = await mongo.collection("clientes").insertOne(
                    completeClient,
                    { session: mongoSession }
                );

                if (!mongoResult.acknowledged) {
                    throw new Error('Error al crear cliente en MongoDB');
                }
                return completeClient;

            });
        } finally {
            await mongoSession.endSession();
        }
    }

    async #updateClientMongo(id_cliente, updateData, mongo) {
        const mongoSession = mongo.client.startSession();

        try {
            return await mongoSession.withTransaction(async () => {

                const data = await this.#validateAndGetUpdateData(
                    id_cliente,
                    updateData,
                    mongo,
                    mongoSession
                );

                if (!data.originalClient) {
                    throw new Error(`Cliente ${id_cliente} no encontrado`);
                }

                let newVehicles = [];
                if (updateData.vehiculos?.length > 0) {
                    if (data.patentConflicts.length > 0) {
                        const conflicts = data.patentConflicts.map(p => `${p.patente} (Cliente ${p.id_cliente})`);
                        throw new Error(`Patentes ya existentes: ${conflicts.join(', ')}`);
                    }

                    const newPatents = updateData.vehiculos.map(v => v.patente).filter(Boolean);
                    if (new Set(newPatents).size !== newPatents.length) {
                        throw new Error('Patentes duplicadas en la misma operación');
                    }

                    const existingPatents = (data.originalClient.vehiculos || []).map(v => v.patente).filter(Boolean);
                    const clientConflicts = newPatents.filter(p => existingPatents.includes(p));

                    if (clientConflicts.length > 0) {
                        throw new Error(`El cliente ya tiene vehículos con patentes: ${clientConflicts.join(', ')}`);
                    }

                    const baseId = parseInt(data.lastVehicleId) + 1;
                    newVehicles = updateData.vehiculos.map((vehiculo, i) => ({
                        id_vehiculo: (baseId + i).toString(),
                        marca: vehiculo.marca,
                        modelo: vehiculo.modelo,
                        anio: Number(vehiculo.anio),
                        patente: vehiculo.patente,
                        nro_chasis: vehiculo.nro_chasis,
                        asegurado: false
                    }));
                }

                const updateFields = {};
                ClientService.FIELD_CONFIG.updatable_mongodb.forEach(field => {
                    if (updateData[field] !== undefined) {
                        updateFields[field] = updateData[field];
                    }
                });

                let updateQuery = { $set: updateFields };
                if (newVehicles.length > 0) {
                    updateQuery.$push = { vehiculos: { $each: newVehicles } };
                }

                const result = await mongo.collection("clientes").updateOne(
                    { id_cliente },
                    updateQuery,
                    { session: mongoSession }
                );

                if (result.matchedCount === 0) {
                    throw new Error(`Cliente ${id_cliente} no encontrado para actualizar`);
                }

                return { originalData: data.originalClient };
            });

        } finally {
            await mongoSession.endSession();
        }
    }

    async #updateClientNeo4j(id_cliente, updateData, session) {
        await session.executeWrite(async tx => {

            const fieldsToUpdate = {};
            ClientService.FIELD_CONFIG.updatable_neo4j.forEach(field => {
                if (updateData[field] !== undefined) {
                    fieldsToUpdate[field] = updateData[field];
                }
            });

            if (Object.keys(fieldsToUpdate).length === 0) return id_cliente;

            const setClauses = Object.keys(fieldsToUpdate)
                .map(field => `u.${field} = $${field}`)
                .join(', ');

            const result = await tx.run(`
                MATCH (u:User {id_cliente: $id_cliente})
                SET ${setClauses}
                RETURN u.id_cliente as actualizado
            `, {
                id_cliente,
                ...fieldsToUpdate
            });

            if (result.records.length === 0) {
                throw new Error(`Cliente ${id_cliente} no encontrado en Neo4j`);
            }

            return id_cliente;
        });
    }

    async #deleteClientNeo4j(id_cliente, session) {
        return await session.executeWrite(async tx => {
            const result = await tx.run(`
            MATCH (u:User {id_cliente: $id_cliente})
            DETACH DELETE u
            RETURN COUNT(u) as eliminados
        `, { id_cliente });

            const deletedCount = result.records[0]?.get('eliminados')?.toNumber() || 0;

            if (deletedCount === 0) {
                throw new Error(`Cliente ${id_cliente} no encontrado en Neo4j`);
            }
            return deletedCount;
        });
    }

    async #deleteClientMongoDB(id_cliente, mongo) {
        const result = await mongo.collection("clientes").deleteOne(
            { id_cliente: id_cliente }
        );

        if (result.deletedCount === 0) {
            throw new Error(`Cliente ${id_cliente} no encontrado en MongoDB para eliminar`);
        }
        return result.deletedCount;
    }

    async #validateAndGetData(clientData, mongo, mongoSession) {
        const [existingDni, maxIdResult] = await Promise.all([
            mongo.collection("clientes").findOne(
                { dni: clientData.dni },
                { projection: { id_cliente: 1 }, session: mongoSession }
            ),
            mongo.collection("clientes").aggregate([
            {
                $addFields: {
                    id_num: { 
                        $convert: { 
                            input: "$id_cliente", 
                            to: "int", 
                            onError: 0 
                        } 
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    maxId: { $max: "$id_num" }
                }
            }
        ], { session: mongoSession }).toArray()
        ]);

         const currentMaxId = maxIdResult[0]?.maxId || 0;
        let lastVehicleId = "";
        let patentConflicts = [];

        if (clientData.vehiculos?.length > 0) {
            const patents = clientData.vehiculos.map(v => v.patente).filter(Boolean);

            const [vehicleData, patentData] = await Promise.all([
                mongo.collection("clientes").aggregate([
                    { $unwind: "$vehiculos" },
                    { $sort: { "vehiculos.id_vehiculo": -1 } },
                    { $limit: 1 },
                    { $project: { id: "$vehiculos.id_vehiculo" } }
                ], { session: mongoSession }).toArray(),

                mongo.collection("clientes").aggregate([
                    { $unwind: "$vehiculos" },
                    { $match: { "vehiculos.patente": { $in: patents } } },
                    { $project: { patente: "$vehiculos.patente", id_cliente: 1 } }
                ], { session: mongoSession }).toArray()
            ]);

            lastVehicleId = vehicleData[0]?.id || "0";
            patentConflicts = patentData;
        }

        return {
            dniExists: !!existingDni,
            existingDni: existingDni,
             lastClientId: currentMaxId.toString(),
            lastVehicleId: lastVehicleId,
            patentConflicts: patentConflicts
        };
    }

    async #validateAndGetUpdateData(id_cliente, updateData, mongo, mongoSession) {
        const originalClient = await mongo.collection("clientes").findOne(
            { id_cliente: id_cliente },
            { session: mongoSession }
        );

        let lastVehicleId = "";
        let patentConflicts = [];

        if (updateData.vehiculos?.length > 0) {
            const patents = updateData.vehiculos.map(v => v.patente).filter(Boolean);

            const [vehicleData, patentData] = await Promise.all([
                mongo.collection("clientes").aggregate([
                    { $unwind: "$vehiculos" },
                    { $sort: { "vehiculos.id_vehiculo": -1 } },
                    { $limit: 1 },
                    { $project: { id: "$vehiculos.id_vehiculo" } }
                ], { session: mongoSession }).toArray(),

                mongo.collection("clientes").aggregate([
                    { $unwind: "$vehiculos" },
                    { $match: { "vehiculos.patente": { $in: patents } } },
                    { $project: { patente: "$vehiculos.patente", id_cliente: 1 } }
                ], { session: mongoSession }).toArray()
            ]);

            lastVehicleId = vehicleData[0]?.id || "0";
            patentConflicts = patentData;
        }

        return {
            originalClient: originalClient,
            lastVehicleId: lastVehicleId,
            patentConflicts: patentConflicts
        };
    }

    async #rollbackClientMongo(mongo, id_cliente) {
        try {
            console.log(`🔄 Ejecutando rollback: eliminando cliente ${id_cliente} de MongoDB...`);

            const result = await mongo.collection("clientes").deleteOne(
                { id_cliente: id_cliente }
            );

            if (result.deletedCount > 0) {
                console.log(`✅ Rollback MongoDB completado: cliente ${id_cliente} eliminado`);
            }
        } catch (error) {
            console.error(`❌ Error en rollback MongoDB: ${error.message}`);
        }
    }

    async #rollbackUpdateMongo(id_cliente, originalData, mongo) {
        try {
            console.log(`🔄 Ejecutando rollback: restaurando cliente ${id_cliente} en MongoDB...`);

            const result = await mongo.collection("clientes").replaceOne(
                { id_cliente: id_cliente },
                originalData
            );

            if (result.modifiedCount > 0) {
                console.log(`✅ Rollback MongoDB completado: cliente ${id_cliente} restaurado`);
            } else {
                console.warn(`⚠️  No se pudo restaurar completamente el cliente ${id_cliente}`);
            }

        } catch (error) {
            console.error(`❌ Error en rollback MongoDB: ${error.message}`);
        }
    }

    async #rollbackDeleteMongo(backupData, mongo) {
        try {
            console.log(`🔄 Ejecutando rollback: restaurando cliente ${backupData.id_cliente} en MongoDB...`);

            const result = await mongo.collection("clientes").insertOne(backupData);

            if (result.acknowledged) {
                console.log(`✅ Rollback MongoDB completado: cliente ${backupData.id_cliente} restaurado con todos sus datos`);
            } else {
                console.warn(`⚠️  No se pudo restaurar completamente el cliente ${backupData.id_cliente}`);
            }

        } catch (error) {
            console.error(`❌ Error en rollback MongoDB: ${error.message}`);
        }
    }
}

export default new ClientService();