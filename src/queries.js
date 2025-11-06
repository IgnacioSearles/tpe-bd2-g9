import mongoConnection from "./config/mongodb.js";
import neo4jConnection from "./config/neo4j.js";

export async function query1() {
    const mongo = mongoConnection.getDb();

    const clientes = await mongo.collection("clientes").find({ activo: true }, {projection: {
        _id: 0,
        id_cliente: 1,
        nombre: 1,
        apellido: 1,
        polizas: 1 
    }}).toArray();

    return clientes;
}

export async function query2() {
    const neo4j = neo4jConnection.getSession();

    const siniestros = await neo4j.run(
        "MATCH (a:Accident)<-[:HAS_ACCIDENT]-(p:Policy)<-[:HAS_POLICY]-(u:User) " +
        "WHERE a.estado = 'Abierto' " +
        "RETURN a, u"
    );

    neo4j.close();

    return siniestros.records.map(record => {
        const accident = record.get('a').properties;
        const user = record.get('u').properties
        return {
            id_siniestro: accident.id_siniestro,
            monto_estimado: accident.monto_estimado,
            tipo: accident.tipo,
            cliente: {
                id_cliente: user.id_cliente,
                nombre: user.nombre,
                apellido: user.apellido,
            }
        };
    });
}

export async function query3() {
    const mongo = mongoConnection.getDb();

    const vehiculos = await mongo.collection("clientes").aggregate([
        { $unwind: "$vehiculos" },
        { $match: { "vehiculos.asegurado": true } },
        { $unwind: "$polizas" },
        { $match: { "polizas.tipo": "Auto" } },
        { 
            $project: {
                _id: 0,
                id_vehiculo: "$vehiculos.id_vehiculo",
                marca: "$vehiculos.marca",
                modelo: "$vehiculos.modelo",
                anio: "$vehiculos.anio",
                nro_chasis: "$vehiculos.nro_chasis",

                cliente: {
                    id_cliente: "$id_cliente",
                    nombre: "$nombre",
                    apellido: "$apellido"
                },

                poliza: {
                    nro_poliza: "$polizas.nro_poliza",
                    fecha_inicio: "$polizas.fecha_inicio",
                    fecha_fin: "$polizas.fecha_fin",
                    estado: "$polizas.estado",
                    prima: "$polizas.prima_mensual",
                    cobertura_total: "$polizas.cobertura_total" 
                }
            }
        }
    ]).toArray();

    return vehiculos;
}