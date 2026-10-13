-- Identidades ficticias, sin correos ni cambios persistentes.
CREATE TEMP TABLE approval_checks(nombre text) ON COMMIT DROP;
GRANT SELECT,INSERT ON pg_temp.approval_checks TO authenticated;
DO $$ DECLARE v_cct text; v_director uuid; v_otra text; BEGIN
 SELECT id,trim(escuela_cct) INTO STRICT v_director,v_cct FROM sisaep_registro.administradores WHERE rol='director' LIMIT 1;
 SELECT trim(cct) INTO STRICT v_otra FROM public.sic_escuela WHERE trim(cct)<>v_cct LIMIT 1;
 PERFORM set_config('sisaep_test.director',v_director::text,true);
 INSERT INTO sisaep_registro.solicitudes(id,token_hash,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 SELECT ('88130000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,sha256(convert_to(repeat('d',64),'UTF8')),
  'PRUEBA','ALTA','DIRECTOR','991300000'||n,'qa.aprobacion'||n||'@example.com','TEST001313HDFXXX0'||n,
  CASE WHEN n=5 THEN v_otra ELSE v_cct END FROM generate_series(1,5) n;
 INSERT INTO public."App_Solicitudes"(nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 VALUES('OTRA PERSONA','ALTA','DIRECTOR','9913000002','qa.aprobacion2@example.com','TEST001313HDFXXX02',v_cct);
 INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 VALUES('88130000-0000-4000-8000-000000000103','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.aprobacion3@example.com',now(),'{}','{}'),
  ('88130000-0000-4000-8000-000000000104','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.otro.aprobacion@example.com',now(),'{}','{}');
 INSERT INTO public.sic_usuarios(id_usuario,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
 VALUES('88130000-0000-4000-8000-000000000104','OTRA PERSONA','ALTA','DIRECTOR','9913000004','qa.otro.aprobacion@example.com','TEST001313HDFXXX04',v_cct);
 BEGIN UPDATE sisaep_registro.solicitudes SET estado='Aceptado' WHERE id='88130000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL aprobación sin revisión'; EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO pg_temp.approval_checks VALUES('actualizacion_directa_sin_revision_bloqueada');
END; $$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sisaep_test.director'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE d jsonb; BEGIN
 d:=public.sisaep_admin_solicitudes('Pendiente','9913000001',0,50)->'solicitudes'->0;
 IF d->'validacion_padron'->>'estado'<>'faltante' OR d->'validacion_cuenta'->>'estado'<>'faltante'
  OR NOT (d->>'puede_aceptar')::boolean THEN RAISE EXCEPTION 'FAIL elegibilidad'; END IF;
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Aceptado',2);
  RAISE EXCEPTION 'FAIL version'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 d:=public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Aceptado',1);
 IF d->>'estado'<>'Aceptado' OR d->>'version'<>'2' OR NOT (d->>'coincide_padron')::boolean OR (d->>'cuenta_confirmada_coincide')::boolean THEN RAISE EXCEPTION 'FAIL alta sin cuenta'; END IF;
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000001','Aceptado',1);
  RAISE EXCEPTION 'FAIL segunda aprobación'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.sisaep_corregir_solicitud('88130000-0000-4000-8000-000000000001',repeat('d',64),2,
  public.sisaep_solicitud_propia('88130000-0000-4000-8000-000000000001',repeat('d',64))->'datos');
  RAISE EXCEPTION 'FAIL corrección aceptada'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000002','Aceptado',1);
  RAISE EXCEPTION 'FAIL conflicto padrón'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000004','Aceptado',1);
  RAISE EXCEPTION 'FAIL conflicto perfil por boleta'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000005','Aceptado',1);
  RAISE EXCEPTION 'FAIL otra escuela'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 d:=public.sisaep_admin_revisar_version('88130000-0000-4000-8000-000000000003','Aceptado',1);
 IF NOT (d->>'cuenta_confirmada_coincide')::boolean THEN RAISE EXCEPTION 'FAIL reparar perfil ausente'; END IF;
 INSERT INTO pg_temp.approval_checks VALUES('alta_sin_auth_con_padron'),('version_y_doble_revision_bloqueadas'),('aceptada_no_editable'),
  ('conflicto_padron_bloqueado'),('conflicto_perfil_por_boleta_bloqueado'),('director_otra_escuela_bloqueado'),('cuenta_confirmada_sin_perfil_reparada');
END; $$;
RESET ROLE;
DO $$ DECLARE v_cct text; BEGIN
 IF (SELECT count(*) FROM sisaep_registro.revisiones WHERE solicitud_id='88130000-0000-4000-8000-000000000001')<>1
  OR (SELECT count(*) FROM public."App_Solicitudes" WHERE correo='qa.aprobacion1@example.com')<>1
  OR EXISTS(SELECT 1 FROM auth.users WHERE email='qa.aprobacion1@example.com') THEN RAISE EXCEPTION 'FAIL alta/auditoria'; END IF;
 IF EXISTS(SELECT 1 FROM sisaep_registro.revisiones WHERE solicitud_id IN('88130000-0000-4000-8000-000000000002','88130000-0000-4000-8000-000000000004'))
  OR EXISTS(SELECT 1 FROM public."App_Solicitudes" WHERE correo='qa.aprobacion4@example.com') THEN RAISE EXCEPTION 'FAIL cambios parciales'; END IF;
 SELECT trim(escuela_cct) INTO v_cct FROM sisaep_registro.solicitudes WHERE id='88130000-0000-4000-8000-000000000001';
 INSERT INTO auth.users(id,instance_id,aud,role,email,raw_user_meta_data,raw_app_meta_data)
 VALUES('88130000-0000-4000-8000-000000000101','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.aprobacion1@example.com',
  jsonb_build_object('nombre','PRUEBA','apellido_paterno','ALTA','apellido_materno','DIRECTOR','boleta_o_empleado','9913000001','curp','TEST001313HDFXXX01','escuela_cct',v_cct,'id_tipo_usuario',4,'rol','director'),'{}');
 UPDATE auth.users SET email_confirmed_at=now() WHERE id='88130000-0000-4000-8000-000000000101';
 IF NOT EXISTS(SELECT 1 FROM public.sic_usuarios WHERE id_usuario='88130000-0000-4000-8000-000000000101' AND id_tipo_usuario=1)
  OR EXISTS(SELECT 1 FROM sisaep_registro.administradores WHERE id='88130000-0000-4000-8000-000000000101') THEN RAISE EXCEPTION 'FAIL activacion/rol'; END IF;
 INSERT INTO pg_temp.approval_checks VALUES('alta_auditoria_atomicas'),('conflictos_sin_cambios_parciales'),('confirmacion_crea_alumno_sin_autoascenso');
END; $$;
SELECT jsonb_build_object('resultado','PASS','total',count(*),'pruebas',jsonb_agg(nombre),'fixtures','ROLLBACK') AS validacion_aprobacion FROM pg_temp.approval_checks;
ROLLBACK;
