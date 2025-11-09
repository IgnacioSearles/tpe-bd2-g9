import neo4jConnection from "../config/neo4j.js";
import { validateAccident } from "../utils/validation.js";

export class AccidentService {

    async emitAccident(siniestro) {
        const neo4j = neo4jConnection.getSession();

        try {
            validateAccident(siniestro);

            const resultado = await neo4j.executeWrite(async tx => {
                const result = await tx.run(
                    `
                    MATCH (p:Policy {nro_poliza: $nro_poliza})
                    
                    
                    OPTIONAL MATCH (acc:Accident)
                    WITH p, acc ORDER BY toInteger(acc.id_siniestro) DESC LIMIT 1
                    WITH p, COALESCE(toInteger(acc.id_siniestro),0) as ultimo_id
                    WITH p, toString(ultimo_id + 1) as nuevo_id
                    
                    
                    CREATE (new_acc:Accident {
                        id_siniestro: nuevo_id,
                        fecha: $fecha,
                        descripcion: $descripcion,
                        monto_estimado: $monto_estimado,
                        estado: $estado,
                        tipo: $tipo,
                        fecha_creacion: datetime()
                    })
                    
                    
                    CREATE (p)-[:HAS_ACCIDENT]->(new_acc)
                    
                    
                    RETURN new_acc.id_siniestro as id_siniestro`,
                    {
                        nro_poliza: siniestro.nro_poliza,
                        fecha: siniestro.fecha,
                        descripcion: siniestro.descripcion || '',
                        monto_estimado: Number(siniestro.monto_estimado),
                        estado: siniestro.estado || 'Abierto',
                        tipo: siniestro.tipo
                    }
                );

                if (result.records.length === 0) {
                    throw new Error(`Póliza ${siniestro.nro_poliza} no encontrada`);
                }

                return {
                    id_siniestro: result.records[0].get('id_siniestro'),
                };
            });

            return {
                success: true,
                id_siniestro: resultado.id_siniestro
            };

        } catch (error) {
            throw new Error(`Error al emitir siniestro: ${error.message}`);
        } finally {
            await neo4j.close();
        }
    }
}

export default new AccidentService();