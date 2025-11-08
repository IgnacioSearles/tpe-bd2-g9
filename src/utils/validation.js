export function validateClient(client) {
    const errors = [];
    
    if (!client.nombre?.trim()) errors.push("nombre es requerido");
    if (!client.apellido?.trim()) errors.push("apellido es requerido");
    if (!client.dni) errors.push("dni es requerido");
    if (!client.email) errors.push("email es requerido");
    
    if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
        errors.push("email tiene formato inválido");
    }

    if (client.dni && !/^\d+$/.test(client.dni.toString())) {
        errors.push("dni debe tener solo dígitos");
    }

    if (client.telefono && !/^\+?\d+$/.test(client.telefono.toString())) {
        errors.push("teléfono debe contener solo dígitos (opcionalmente con + para código de país)");
    }

    if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
    
    return true;
}

export function validateClientUpdate(data) {
    const errors = [];
    
    const forbiddenFields = ['id_cliente', 'dni', 'polizas', '_id'];
    const invalidFields = Object.keys(data).filter(field => 
        forbiddenFields.includes(field)
    );

    if (invalidFields.length > 0) {
        errors.push(`No se pueden actualizar los campos: ${invalidFields.join(', ')}`);
    }
    
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push("email tiene formato inválido");
    }

    if (data.telefono && !/^\+?\d+$/.test(data.telefono.toString())) {
        errors.push("teléfono debe contener solo dígitos (opcionalmente con + para código de país)");
    }
    
    if (data.nombre && !data.nombre.trim()) {
        errors.push("nombre no puede estar vacío");
    }

    if (data.apellido && !data.apellido.trim()) {
        errors.push("apellido no puede estar vacío");
    }

    if (data.activo !== undefined && typeof data.activo !== 'boolean') {
        errors.push("el campo activo debe ser true o false");
    }

    if (data.vehiculos) {
        if (!Array.isArray(data.vehiculos)) {
            errors.push("los vehículos deben ser un array");
        } else {
            data.vehiculos.forEach((vehicle, index) => {
                if (!vehicle.marca || !vehicle.modelo || !vehicle.patente) {
                    errors.push(`Vehículo ${index + 1}: marca, modelo y patente son obligatorios`);
                }
            });
        }
    }

    if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }
    
    return true;
}

export function validateAccident(accident) {
    const errores = [];
    
    if (!accident.nro_poliza) errores.push("nro_poliza es requerido");
    if (!accident.fecha) errores.push("fecha es requerida");
    if (!accident.tipo) errores.push("tipo de siniestro es requerido");
    if (accident.monto_estimado === undefined || accident.monto_estimado === null) {
        errores.push("monto_estimado es requerido");
    }
    
    const tiposPermitidos = ['Accidente', 'Robo', 'Incendio', 'Danio', 'Vandalismo'];
    if (accident.tipo && !tiposPermitidos.includes(accident.tipo)) {
        errores.push(`tipo de siniestro debe ser uno de: ${tiposPermitidos.join(', ')}`);
    }

    if (accident.estado) {
        const estadosPermitidos = ['Abierto', 'En evaluacion', 'Cerrado'];
        if (!estadosPermitidos.includes(accident.estado)) {
            errores.push(`estado debe ser uno de: ${estadosPermitidos.join(', ')}`);
        }
    }

    if (accident.monto_estimado && (isNaN(accident.monto_estimado) || Number(accident.monto_estimado) < 0)) {
        errores.push("monto_estimado debe ser un número positivo");
    }

    if (accident.fecha) {
        const fecha = new Date(accident.fecha);
        const hoy = new Date();
        
        if (isNaN(fecha.getTime())) {
            errores.push("fecha debe tener un formato válido");
        } else if (fecha > hoy) {
            errores.push("fecha no puede ser futura");
        }
    }
        
    if (errores.length > 0) {
        throw new Error(`Errores de validación del siniestro: ${errores.join(', ')}`);
    }
    
    return true;
}

export function validatePolicy(policy) {
    const errores = [];
    
    if (!policy.tipo) errores.push("tipo de póliza es requerido");
    if (!policy.id_cliente) errores.push("id_cliente es requerido");
    if (!policy.id_agente) errores.push("agente es requerido");
    if (!policy.fecha_inicio) errores.push("fecha de inicio es requerida");
    if (!policy.fecha_fin) errores.push("fecha de fin es requerida");
    if (policy.prima_mensual === undefined || policy.prima_mensual === null) {
        errores.push("prima mensual es requerida");
    }
    if (policy.cobertura_total === undefined || policy.cobertura_total === null) {
        errores.push("cobertura total es requerida");
    }

    if (policy.nro_poliza !== undefined && policy.nro_poliza && !/^POL\d+$/.test(policy.nro_poliza)) {
        errores.push("número de póliza debe tener formato POLxxxx (ej: POL1001)");
    }
    
    const tiposPermitidos = ['Auto', 'Vida', 'Hogar', 'Salud'];
    if (policy.tipo && !tiposPermitidos.includes(policy.tipo)) {
        errores.push(`tipo de póliza debe ser uno de: ${tiposPermitidos.join(', ')}`);
    }

    if (policy.estado) {
        const estadosPermitidos = ['Activa', 'Suspendida', 'Vencida'];
        if (!estadosPermitidos.includes(policy.estado)) {
            errores.push(`estado debe ser uno de: ${estadosPermitidos.join(', ')}`);
        }
    }

    if (policy.prima_mensual && (isNaN(policy.prima_mensual) || Number(policy.prima_mensual) <= 0)) {
        errores.push("prima mensual debe ser un número positivo");
    }

    if (policy.cobertura_total && (isNaN(policy.cobertura_total) || Number(policy.cobertura_total) <= 0)) {
        errores.push("cobertura total debe ser un número positivo");
    }

    if (policy.fecha_inicio && policy.fecha_fin) {
        const start = new Date(policy.fecha_inicio);
        const end = new Date(policy.fecha_fin);

        if (isNaN(start.getTime())) {
            errores.push("fecha de inicio debe tener un formato válido");
        }

        if (isNaN(end.getTime())) {
            errores.push("fecha de fin debe tener un formato válido");
        }

        if (start.getTime() && end.getTime() && end <= start) {
            errores.push("fecha de fin debe ser posterior a fecha de inicio");
        }
    }
    
    if (errores.length > 0) {
        throw new Error(`Errores de validación de la póliza: ${errores.join(', ')}`);
    }
    
    return true;
}