const campos = {nombre: "nombre", apellido_paterno: "apellido paterno", apellido_materno: "apellido materno",
  boleta_o_empleado: "boleta o empleado", correo: "correo", curp: "CURP", escuela_id: "escuela"};
export function mensajeValidacion(validacion, tipo) {
  const fuente = tipo === "padron" ? "padrón" : "cuenta";
  switch (validacion?.estado) {
    case "coincidente": return tipo === "padron" ? "Los datos coinciden con el padrón." : "Cuenta confirmada con datos coincidentes.";
    case "faltante": return tipo === "padron" ? "No hay un registro previo en el padrón relacionado con esta boleta, correo o CURP. Al aceptar, se dará de alta con los datos que validaste." : "No existe una cuenta de acceso con el correo de la solicitud. Esto no impide aprobarla: después de la aprobación, la persona activará su cuenta desde la app.";
    case "sin_confirmar": return "La cuenta existe, pero su correo aún no está confirmado.";
    case "sin_perfil": return "El correo está confirmado, pero falta el perfil de la aplicación.";
    case "ambiguo": return "Hay varios registros relacionados en el padrón. El responsable debe comprobar cuál corresponde a esta persona.";
    case "diferente": {
      const distintos = (validacion.campos_diferentes || []).map(c => campos[c]).filter(Boolean);
      return distintos.length ? `Hay un registro en el ${fuente}, pero difieren estos datos: ${distintos.join(", ")}.` : `Hay un registro en el ${fuente} que requiere revisión.`;
    }
    default: return "No se pudo obtener el detalle de la validación. Actualiza la lista antes de revisar.";
  }
}

// La elegibilidad viene del servidor; sin ese dato no se habilita la aceptación.
export function puedeAceptar(solicitud, revisada, ocupado = false) {
  return !ocupado && revisada && solicitud?.estado === "Pendiente" && solicitud?.puede_aceptar === true;
}
