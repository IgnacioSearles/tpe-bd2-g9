import mongoConnection from "../config/mongodb.js";
import neo4jConnection from "../config/neo4j.js";
import { validatePolicy } from "../utils/validation.js";

export class PolicyService {

    async emitPolicy(policyData) {
        const mongo = mongoConnection.getDb();
        const session = neo4jConnection.getSession();
        let policyCreatedInNeo4j = false;
        let nro_poliza = null;

        try {
            validatePolicy(policyData);

            const neo4jResult = await session.executeWrite(async tx => {
                const result = await tx.run(
                    `// Validar agente activo
                    MATCH (a:Agent {id_agente: $id_agente})
                    WHERE a.activo = true
                    
                    // Validar cliente activo
                    MATCH (u:User {id_cliente: $id_cliente})
                    WHERE u.activo = true
                    
                    // Verificar pólizas del mismo tipo y sus estados
                    OPTIONAL MATCH (u)-[:HAS_POLICY]->(existing:Policy)
                    WHERE existing.tipo = $tipo AND existing.estado IN ['Activa', 'Suspendida']
                    
                    WITH a, u WHERE existing IS NULL
                    
                    // Obtener último ID y generar nuevo
                    OPTIONAL MATCH (p:Policy)
                    WHERE p.nro_poliza STARTS WITH 'POL'
                    WITH a, u, p ORDER BY toInteger(substring(p.nro_poliza, 3)) DESC LIMIT 1
                    WITH a, u, COALESCE(toInteger(substring(p.nro_poliza, 3)), 1000) as ultimo_id
                    WITH a, u, toString(ultimo_id + 1) as nuevo_id, "POL" + toString(ultimo_id + 1) as nro_poliza
                    
                    // Crear póliza
                    CREATE (new_policy:Policy {
                        nro_poliza: nro_poliza,
                        tipo: $tipo,
                        cobertura_total: $cobertura_total,
                        fecha_inicio: $fecha_inicio,
                        fecha_fin: $fecha_fin,
                        prima_mensual: $prima_mensual,
                        estado: $estado
                    })
                    
                    // Crear relaciones
                    CREATE (u)-[:HAS_POLICY]->(new_policy)
                    CREATE (a)-[:ASSIGNED_TO]->(new_policy)
                    
                    RETURN nro_poliza as id_poliza`,
                    {
                        id_cliente: policyData.id_cliente,
                        id_agente: policyData.id_agente,
                        tipo: policyData.tipo,
                        cobertura_total: Number(policyData.cobertura_total),
                        fecha_inicio: policyData.fecha_inicio,
                        fecha_fin: policyData.fecha_fin,
                        prima_mensual: Number(policyData.prima_mensual),
                        estado: policyData.estado || 'Activa'
                    }
                );

                if (result.records.length === 0) {
                    await this.#verifySpecificErrors(tx, policyData.id_cliente, policyData.id_agente, policyData.tipo);
                }

                return result.records[0].get('id_poliza');
            });

            nro_poliza = neo4jResult;
            policyCreatedInNeo4j = true;

            const completePolicy = {
                nro_poliza: nro_poliza,
                tipo: policyData.tipo,
                fecha_inicio: policyData.fecha_inicio,
                fecha_fin: policyData.fecha_fin,
                prima_mensual: Number(policyData.prima_mensual),
                cobertura_total: Number(policyData.cobertura_total),
                id_agente: policyData.id_agente,
                estado: policyData.estado || 'Activa'
            };

            let updateQuery;

            if (policyData.tipo === 'Auto') {
                updateQuery = {
                    $push: { polizas: completePolicy },
                    $set: { "vehiculos.$[].asegurado": true }
                };
            } else {
                updateQuery = {
                    $push: { polizas: completePolicy }
                };
            }

            const mongoResult = await mongo.collection("clientes").updateOne(
                { id_cliente: policyData.id_cliente },
                updateQuery
            );

            if (mongoResult.modifiedCount === 0) {
                throw new Error(`Cliente ${policyData.id_cliente} no encontrado en MongoDB`);
            }

            return {
                success: true,
                nro_poliza: nro_poliza
            };

        } catch (error) {
            if (policyCreatedInNeo4j && nro_poliza) {
                await this.#rollbackNeo4j(session, nro_poliza);
            }
            throw new Error(`Error al emitir póliza: ${error.message}`);    
        } finally {
            await session.close();
        }
    }

    async #verifySpecificErrors(tx, id_cliente, id_agente, tipo) {
        const diagnosis = await tx.run(
            `
            OPTIONAL MATCH (a:Agent {id_agente: $id_agente})
            OPTIONAL MATCH (u:User {id_cliente: $id_cliente})
            OPTIONAL MATCH (u)-[:HAS_POLICY]->(existing:Policy)
            WHERE existing.tipo = $tipo AND existing.estado IN ['Activa', 'Suspendida']
            
            RETURN 
                a IS NULL as agente_no_existe,
                a.activo = false as agente_inactivo,
                u IS NULL as cliente_no_existe,
                u.activo = false as cliente_inactivo,
                existing.estado as estado_poliza_existente,
                existing.nro_poliza as nro_poliza_existente`,
            { id_cliente, id_agente, tipo }
        );

        if (diagnosis.records.length > 0) {
            const record = diagnosis.records[0];

            if (record.get('agente_no_existe')) {
                throw new Error(`Agente ${id_agente} no encontrado`);
            }

            if (record.get('agente_inactivo')) {
                throw new Error(`Agente ${id_agente} no está activo`);
            }

            if (record.get('cliente_no_existe')) {
                throw new Error(`Cliente ${id_cliente} no encontrado`);
            }

            if (record.get('cliente_inactivo')) {
                throw new Error(`Cliente ${id_cliente} no está activo`);
            }

            const existingState = record.get('estado_poliza_existente');
            const existingPolicyNumber = record.get('nro_poliza_existente');

            if (existingState === 'Activa') {
                throw new Error(`El cliente ${id_cliente} ya tiene una póliza de tipo '${tipo}' activa (${existingPolicyNumber}). No se puede crear otra póliza del mismo tipo.`);
            }

            if (existingState === 'Suspendida') {
                throw new Error(`El cliente ${id_cliente} tiene una póliza de tipo '${tipo}' suspendida (${existingPolicyNumber}). Debe reactivar la póliza previa o esperar a que se venza antes de crear una nueva.`);
            }
        }
        throw new Error(`Error desconocido`);
    }

    async #rollbackNeo4j(session, nro_poliza) {
        try {
            console.log(`🔄 Ejecutando rollback: eliminando póliza ${nro_poliza} de Neo4j...`);

            await session.executeWrite(async tx => {
                await tx.run(
                    `MATCH (p:Policy {nro_poliza: $nro_poliza})
                     DETACH DELETE p`,
                    { nro_poliza: nro_poliza }
                );
            });

            console.log(`✅ Rollback Neo4j completado`);
        } catch (error) {
            console.error(`❌ Error en rollback Neo4j: ${error.message}`);
        }
    }
}

export default new PolicyService();