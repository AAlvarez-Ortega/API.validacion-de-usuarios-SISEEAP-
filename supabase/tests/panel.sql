-- Ejecutar dentro de una transacción; todas las filas de prueba se revierten.
CREATE TEMP TABLE panel_checks(check_name text, passed boolean NOT NULL) ON COMMIT DROP;
GRANT SELECT,INSERT ON TABLE pg_temp.panel_checks TO anon,authenticated;
DO $$
DECLARE v_admin uuid; v_cct text; v_otra text; v_qa uuid;
BEGIN
  SELECT id,trim(escuela_cct) INTO STRICT v_admin,v_cct FROM sisaep_registro.administradores LIMIT 1;
  SELECT trim(cct) INTO STRICT v_otra FROM public.sic_escuela WHERE trim(cct)<>v_cct LIMIT 1;
  SELECT id INTO STRICT v_qa FROM auth.users WHERE email='qa.sisaep.20261003@example.com';
  PERFORM set_config('sisaep_test.admin_uid',v_admin::text,true);
  PERFORM set_config('sisaep_test.qa_uid',v_qa::text,true);
  INSERT INTO sisaep_registro.solicitudes(id,token_hash,nombre,apellido_paterno,apellido_materno,
    boleta_o_empleado,correo,curp,escuela_cct)
  VALUES('11110000-0000-4000-8000-000000000001',sha256(convert_to(repeat('1',64),'UTF8')),
    'PRUEBA','PANEL','LOCAL','9900600001','qa.panel1@example.com','PRUE000101HDFXXX11',v_cct),
    ('11110000-0000-4000-8000-000000000002',sha256(convert_to(repeat('2',64),'UTF8')),
    'PRUEBA','OTRA','SEDE','9900600002','qa.panel2@example.com','PRUE000101HDFXXX12',v_otra);
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
END;
$$;
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF has_function_privilege('anon','public.sisaep_admin_sesion()','EXECUTE')
    OR has_function_privilege('anon','public.sisaep_admin_solicitudes(text,text,integer,integer)','EXECUTE')
    OR has_function_privilege('anon','public.sisaep_admin_revisar(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL anon execute';
  END IF;
  BEGIN PERFORM public.sisaep_admin_sesion(); RAISE EXCEPTION 'FAIL anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO pg_temp.panel_checks VALUES('anon_sin_acceso',true);
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sisaep_test.qa_uid'),
  'role','authenticated','user_metadata',jsonb_build_object('rol','director','admin',true))::text,true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN PERFORM public.sisaep_admin_solicitudes(); RAISE EXCEPTION 'FAIL alumno listado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.sisaep_admin_revisar('11110000-0000-4000-8000-000000000001','Rechazado');
    RAISE EXCEPTION 'FAIL alumno revision';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM sisaep_registro.solicitudes; RAISE EXCEPTION 'FAIL tabla directa';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE sisaep_registro.administradores SET rol='director'; RAISE EXCEPTION 'FAIL autoascenso';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO pg_temp.panel_checks VALUES('alumno_y_metadatos_falsos_bloqueados',true),
    ('tablas_privadas_y_autoascenso_bloqueados',true);
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sisaep_test.admin_uid'),
  'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_sesion jsonb; v_listado jsonb; v_revisada jsonb;
BEGIN
  v_sesion:=public.sisaep_admin_sesion();
  IF v_sesion->>'rol'<>'director' OR v_sesion->'escuela'->>'cct' IS NULL THEN
    RAISE EXCEPTION 'FAIL sesion'; END IF;
  v_listado:=public.sisaep_admin_solicitudes(NULL,'990060',0,50);
  IF jsonb_array_length(v_listado->'solicitudes')<>1
    OR v_listado->'solicitudes'->0->>'id'<>'11110000-0000-4000-8000-000000000001'
    OR v_listado->'solicitudes'->0 ? 'token_hash' THEN RAISE EXCEPTION 'FAIL aislamiento'; END IF;
  IF jsonb_array_length(public.sisaep_admin_solicitudes(NULL,'990060',1,50)->'solicitudes')<>0 THEN
    RAISE EXCEPTION 'FAIL paginacion'; END IF;
  BEGIN PERFORM public.sisaep_admin_solicitudes('Otro'); RAISE EXCEPTION 'FAIL filtro';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.sisaep_admin_revisar('11110000-0000-4000-8000-000000000002','Rechazado');
    RAISE EXCEPTION 'FAIL otra escuela';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF NOT (v_listado->'solicitudes'->0->>'puede_aceptar')::boolean THEN RAISE EXCEPTION 'FAIL elegibilidad sin cuenta'; END IF;
  v_revisada:=public.sisaep_admin_revisar('11110000-0000-4000-8000-000000000001','Rechazado');
  IF v_revisada->>'estado'<>'Rechazado' THEN RAISE EXCEPTION 'FAIL revision'; END IF;
  BEGIN PERFORM public.sisaep_admin_revisar('11110000-0000-4000-8000-000000000001','Aceptado');
    RAISE EXCEPTION 'FAIL doble revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  INSERT INTO pg_temp.panel_checks VALUES('director_sesion_y_filtros',true),
    ('aislamiento_escuela_sin_secretos',true),('paginacion_y_filtro_invalido',true),
    ('revision_otra_escuela_bloqueada',true),('solicitud_sin_cuenta_elegible',true),
    ('revision_manual_y_concurrencia',true);
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM sisaep_registro.revisiones
    WHERE solicitud_id='11110000-0000-4000-8000-000000000001')<>1 THEN
    RAISE EXCEPTION 'FAIL auditoria'; END IF;
  INSERT INTO pg_temp.panel_checks VALUES('auditoria_una_revision',true);
END;
$$;
SELECT jsonb_build_object('resultado','PASS','pruebas',jsonb_agg(check_name ORDER BY check_name),
  'total',count(*),'filas_de_prueba','ROLLBACK') AS validacion_panel FROM pg_temp.panel_checks;
ROLLBACK;
