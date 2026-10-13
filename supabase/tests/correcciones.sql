BEGIN;
CREATE TEMP TABLE correccion_checks(nombre text,passed boolean) ON COMMIT DROP;
GRANT SELECT,INSERT ON pg_temp.correccion_checks TO anon,authenticated;
DO $$
DECLARE admin uuid; cct text;
BEGIN
 SELECT id,trim(escuela_cct) INTO STRICT admin,cct FROM sisaep_registro.administradores WHERE rol='director' LIMIT 1;
 PERFORM set_config('qa.correc.admin',admin::text,true);
 PERFORM set_config('qa.correc.cct',cct,true);
END;
$$;
SET LOCAL ROLE anon;
DO $$
DECLARE id uuid:='88130000-0000-4000-8000-000000000001'; token text:=repeat('e',64); r jsonb;
 payload jsonb:=jsonb_build_object('nombre','PRUEBA','apellido_paterno','CORRECCION','apellido_materno','LOCAL',
  'boleta_o_empleado','9913000001','correo','qa.corregir.20261013@example.com','curp','CORR000101HDFXXX01','escuela_id',current_setting('qa.correc.cct'));
BEGIN
 PERFORM public.sisaep_crear_solicitud(id,token,payload);
 r:=public.sisaep_solicitud_propia(id,token);
 IF r->>'version'<>'1' OR r->'datos'->>'nombre'<>'PRUEBA' THEN RAISE EXCEPTION 'FAIL carga propia'; END IF;
 IF public.sisaep_solicitud_propia(id,repeat('f',64)) IS NOT NULL THEN RAISE EXCEPTION 'FAIL lectura con token incorrecto'; END IF;
 BEGIN PERFORM public.sisaep_corregir_solicitud(id,repeat('f',64),1,payload); RAISE EXCEPTION 'FAIL token incorrecto';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM sisaep_registro.correcciones; RAISE EXCEPTION 'FAIL historial publico';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.sisaep_corregir_solicitud(id,token,1,payload||'{"nombre":"CORREGIDA","estado":"Aceptado"}');
 IF r->>'version'<>'2' OR r->>'estado'<>'Pendiente' OR r->'datos'->>'nombre'<>'CORREGIDA' THEN RAISE EXCEPTION 'FAIL corregir'; END IF;
 r:=public.sisaep_corregir_solicitud(id,token,1,payload||'{"nombre":"CORREGIDA"}');
 IF r->>'version'<>'2' THEN RAISE EXCEPTION 'FAIL reintento idempotente'; END IF;
 BEGIN PERFORM public.sisaep_corregir_solicitud(id,token,1,payload||'{"nombre":"DESACTUALIZADA"}'); RAISE EXCEPTION 'FAIL version obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.sisaep_corregir_solicitud(id,token,2,payload||'{"correo":"INVALIDO"}'); RAISE EXCEPTION 'FAIL datos invalidos';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 INSERT INTO pg_temp.correccion_checks VALUES('lectura_y_edicion_solo_comprobante',true),('historial_privado',true),
  ('edicion_pendiente_y_estado_no_forjable',true),('respuesta_perdida_idempotente',true),('version_obsoleta_bloqueada',true),('validacion_datos',true);
END;
$$;
RESET ROLE;
DO $$
DECLARE d jsonb;
BEGIN
 IF (SELECT count(*) FROM sisaep_registro.correcciones WHERE solicitud_id='88130000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'FAIL historial idempotente'; END IF;
 d:=sisaep_registro.detalle_solicitud('88130000-0000-4000-8000-000000000001');
 IF d->'validacion_padron'->>'estado'<>'faltante' OR d->'validacion_cuenta'->>'estado'<>'faltante' THEN RAISE EXCEPTION 'FAIL faltante'; END IF;
 INSERT INTO public."App_Solicitudes"(nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 SELECT 'DIFERENTE',apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct FROM sisaep_registro.solicitudes WHERE id='88130000-0000-4000-8000-000000000001';
 d:=sisaep_registro.detalle_solicitud('88130000-0000-4000-8000-000000000001');
 IF d->'validacion_padron'->>'estado'<>'diferente' OR d->'validacion_padron'->'campos_diferentes'<>'["nombre"]'::jsonb THEN RAISE EXCEPTION 'FAIL campo distinto'; END IF;
 INSERT INTO public."App_Solicitudes"(nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 SELECT nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct FROM sisaep_registro.solicitudes WHERE id='88130000-0000-4000-8000-000000000001';
 d:=sisaep_registro.detalle_solicitud('88130000-0000-4000-8000-000000000001');
 IF d->'validacion_padron'->>'estado'<>'coincidente' THEN RAISE EXCEPTION 'FAIL coincidencia'; END IF;
 INSERT INTO pg_temp.correccion_checks VALUES('faltante_diferente_y_coincidente_distintos',true);
END;
$$;
SELECT set_config('request.jwt.claim.sub',current_setting('qa.correc.admin'),true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Rechazado',1); RAISE EXCEPTION 'FAIL revision obsoleta';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.sisaep_admin_revisar('88130000-0000-4000-8000-000000000001','Rechazado'); RAISE EXCEPTION 'FAIL cliente viejo';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Rechazado',2);
 INSERT INTO pg_temp.correccion_checks VALUES('revision_actual_y_cliente_antiguo_protegidos',true);
END;
$$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE r jsonb; p jsonb;
BEGIN
 r:=public.sisaep_solicitud_propia('88130000-0000-4000-8000-000000000001',repeat('e',64));
 r:=public.sisaep_corregir_solicitud('88130000-0000-4000-8000-000000000001',repeat('e',64),(r->>'version')::int,r->'datos');
 IF r->>'estado'<>'Pendiente' OR r->>'version'<>'4' THEN RAISE EXCEPTION 'FAIL reenvio rechazo'; END IF;
 p:=r->'datos';
 BEGIN PERFORM public.sisaep_crear_solicitud('88130000-0000-4000-8000-000000000002',repeat('f',64),p); RAISE EXCEPTION 'FAIL dup activo';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO pg_temp.correccion_checks VALUES('rechazo_reenviado_pendiente',true),('duplicado_activo_bloqueado',true);
END;
$$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM sisaep_registro.revisiones WHERE solicitud_id='88130000-0000-4000-8000-000000000001')<>1
 OR (SELECT count(*) FROM sisaep_registro.correcciones WHERE solicitud_id='88130000-0000-4000-8000-000000000001')<>2
 OR EXISTS(SELECT 1 FROM sisaep_registro.correcciones WHERE datos_anteriores ? 'token_hash')
 OR (SELECT revisado_en FROM sisaep_registro.solicitudes WHERE id='88130000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'FAIL historial y fechas'; END IF;
 INSERT INTO pg_temp.correccion_checks VALUES('historial_de_rechazo_conservado_sin_secreto',true);
END;
$$;
SET LOCAL ROLE authenticated;
SELECT public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Rechazado',4);
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE p jsonb;
BEGIN
 p:=public.sisaep_solicitud_propia('88130000-0000-4000-8000-000000000001',repeat('e',64))->'datos';
 PERFORM public.sisaep_crear_solicitud('88130000-0000-4000-8000-000000000002',repeat('f',64),p);
 BEGIN PERFORM public.sisaep_corregir_solicitud('88130000-0000-4000-8000-000000000001',repeat('e',64),5,p); RAISE EXCEPTION 'FAIL choque identidad activa';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO pg_temp.correccion_checks VALUES('nuevo_intento_sin_comprobante_tras_rechazo',true),('conflicto_reenvio_atomico',true);
END;
$$;
RESET ROLE;
DO $$
DECLARE u public.sic_usuarios%ROWTYPE; r jsonb;
BEGIN
 SELECT * INTO STRICT u FROM public.sic_usuarios WHERE correo='qa.sisaep.20261003@example.com';
 u.id_usuario:='88130000-0000-4000-8000-000000000099';
 u.boleta_o_empleado:='9913000003'; u.correo:='qa.correc.aceptada.20261013@example.com'; u.curp:='CORR000101HDFXXX03';
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(u.id_usuario,u.correo,now());
 INSERT INTO public.sic_usuarios(id_usuario,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 VALUES(u.id_usuario,u.nombre,u.apellido_paterno,u.apellido_materno,u.boleta_o_empleado,u.correo,u.curp,u.escuela_cct);
 PERFORM public.sisaep_crear_solicitud('88130000-0000-4000-8000-000000000003',repeat('a',64),
  jsonb_build_object('nombre',u.nombre,'apellido_paterno',u.apellido_paterno,'apellido_materno',u.apellido_materno,
  'boleta_o_empleado',u.boleta_o_empleado,'correo',u.correo,'curp',u.curp,'escuela_id',trim(u.escuela_cct)));
 UPDATE sisaep_registro.solicitudes SET estado='Aceptado' WHERE id='88130000-0000-4000-8000-000000000003';
 SET LOCAL ROLE anon;
 r:=public.sisaep_solicitud_propia('88130000-0000-4000-8000-000000000003',repeat('a',64));
 BEGIN PERFORM public.sisaep_corregir_solicitud('88130000-0000-4000-8000-000000000003',repeat('a',64),2,r->'datos'||'{"nombre":"OTRO"}'); RAISE EXCEPTION 'FAIL aceptada editable';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 INSERT INTO pg_temp.correccion_checks VALUES('solicitud_aceptada_inmutable',true);
 RESET ROLE;
END;
$$;
SELECT jsonb_build_object('resultado','PASS','casos',count(*),'checks',jsonb_agg(nombre ORDER BY nombre)) AS validacion_correcciones FROM pg_temp.correccion_checks;
ROLLBACK;
