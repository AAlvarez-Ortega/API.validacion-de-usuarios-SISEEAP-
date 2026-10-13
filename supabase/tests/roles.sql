-- Fixtures ficticios para los cuatro roles; toda la prueba termina con ROLLBACK.
CREATE TEMP TABLE role_checks(nombre text,passed boolean NOT NULL) ON COMMIT DROP;
GRANT SELECT,INSERT ON pg_temp.role_checks TO anon,authenticated;
DO $$
DECLARE v_cct text; v_otra text; v_director uuid;
BEGIN
  IF (SELECT array_agg(id_tipousuario ORDER BY id_tipousuario) FROM public.sic_tusuario)
      IS DISTINCT FROM ARRAY[1,2,3,4] THEN RAISE EXCEPTION 'FAIL catalogo'; END IF;
  BEGIN INSERT INTO public.sic_tusuario VALUES(5,'Otro'); RAISE EXCEPTION 'FAIL quinto rol';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT r.id,trim(r.escuela_cct) INTO STRICT v_director,v_cct
    FROM sisaep_registro.administradores r WHERE r.rol='director' ORDER BY r.id LIMIT 1;
  SELECT trim(cct) INTO STRICT v_otra FROM public.sic_escuela WHERE trim(cct)<>v_cct LIMIT 1;
  PERFORM set_config('sisaep_test.director',v_director::text,true);
  INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
  VALUES
    ('77120000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.roles.admin@example.com',now(),'{}','{}'),
    ('77120000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.roles.maestro@example.com',now(),'{}','{}'),
    ('77120000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.roles.sinconfirmar@example.com',NULL,'{}','{}'),
    ('77120000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa.roles.alumno@example.com',now(),'{"id_tipo_usuario":4,"rol":"administrador_aplicacion"}','{}');
  INSERT INTO public.sic_usuarios(id_usuario,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct,id_tipo_usuario)
  VALUES
    ('77120000-0000-4000-8000-000000000001','PRUEBA','ADMIN','ROLES','99121201','qa.roles.admin@example.com','TEST001212HDFXXX01',v_cct,4),
    ('77120000-0000-4000-8000-000000000002','PRUEBA','MAESTRO','ROLES','99121202','qa.roles.maestro@example.com','TEST001212HDFXXX02',v_cct,NULL),
    ('77120000-0000-4000-8000-000000000003','PRUEBA','SINCONFIRMAR','ROLES','99121203','qa.roles.sinconfirmar@example.com','TEST001212HDFXXX03',v_cct,4),
    ('77120000-0000-4000-8000-000000000004','PRUEBA','ALUMNO','ROLES','9912120004','qa.roles.alumno@example.com','TEST001212HDFXXX04',v_cct,NULL);
  INSERT INTO public.personal_administrativo(id,rol_administrativo) VALUES
    ('77120000-0000-4000-8000-000000000001','administrador_aplicacion'),
    ('77120000-0000-4000-8000-000000000003','administrador_aplicacion');
  INSERT INTO sisaep_registro.administradores(id,escuela_cct,rol) VALUES
    ('77120000-0000-4000-8000-000000000001',NULL,'administrador_aplicacion'),
    ('77120000-0000-4000-8000-000000000003',NULL,'administrador_aplicacion');
  BEGIN
    UPDATE sisaep_registro.administradores SET escuela_cct=v_cct
      WHERE id='77120000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL alcance incoherente';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.sic_usuarios SET nombre='PRUEBA ACTUALIZADA'
    WHERE id_usuario IN(v_director,'77120000-0000-4000-8000-000000000001');
  IF NOT EXISTS(SELECT 1 FROM public.sic_usuarios WHERE id_usuario=v_director AND id_tipo_usuario=3)
    OR NOT EXISTS(SELECT 1 FROM public.sic_usuarios WHERE id_usuario='77120000-0000-4000-8000-000000000001' AND id_tipo_usuario=4)
    OR NOT EXISTS(SELECT 1 FROM public.sic_usuarios WHERE id_usuario='77120000-0000-4000-8000-000000000002' AND id_tipo_usuario=2)
    OR NOT EXISTS(SELECT 1 FROM public.sic_usuarios WHERE id_usuario='77120000-0000-4000-8000-000000000004' AND id_tipo_usuario=1)
  THEN RAISE EXCEPTION 'FAIL identificacion'; END IF;
  INSERT INTO sisaep_registro.solicitudes(id,token_hash,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
  VALUES
    ('77120000-0000-4000-8000-000000000101',sha256(convert_to(repeat('a',64),'UTF8')),'PRUEBA','ESCUELA','ROLES','9912120101','qa.roles.solicitud1@example.com','TEST001212HDFXXX05',v_cct),
    ('77120000-0000-4000-8000-000000000102',sha256(convert_to(repeat('b',64),'UTF8')),'PRUEBA','OTRA','ROLES','9912120102','qa.roles.solicitud2@example.com','TEST001212HDFXXX06',v_otra);
  INSERT INTO pg_temp.role_checks VALUES('exactamente_cuatro_roles',true),('identificadores_y_actualizacion_perfil',true),('alcance_administrativo_coherente',true);
END;
$$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.sisaep_admin_sesion(); RAISE EXCEPTION 'FAIL anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO pg_temp.role_checks VALUES('anonimo_bloqueado',true);
END; $$;
RESET ROLE;
DO $$ DECLARE v_id text; BEGIN
  FOREACH v_id IN ARRAY ARRAY['77120000-0000-4000-8000-000000000002','77120000-0000-4000-8000-000000000003','77120000-0000-4000-8000-000000000004'] LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_id,'role','authenticated','user_metadata',jsonb_build_object('rol','administrador_aplicacion','id_tipo_usuario',4))::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN PERFORM public.sisaep_admin_sesion(); RAISE EXCEPTION 'FAIL sesion no autorizada';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM public.sisaep_admin_solicitudes(); RAISE EXCEPTION 'FAIL listado no autorizado';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN UPDATE public.sic_usuarios SET id_tipo_usuario=4; RAISE EXCEPTION 'FAIL autoascenso perfil';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO sisaep_registro.administradores(id,rol) VALUES(v_id::uuid,'administrador_aplicacion'); RAISE EXCEPTION 'FAIL autoascenso registro';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE 'RESET ROLE';
  END LOOP;
  INSERT INTO pg_temp.role_checks VALUES('maestro_alumno_y_sinconfirmar_bloqueados',true),('metadatos_no_conceden_roles',true),('autoascenso_bloqueado',true);
END; $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sisaep_test.director'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_session jsonb; v_list jsonb; BEGIN
  v_session:=public.sisaep_admin_sesion();
  IF v_session->>'id_tipo_usuario'<>'3' OR v_session->>'rol'<>'director' OR v_session->>'alcance'<>'escuela' THEN RAISE EXCEPTION 'FAIL director sesion'; END IF;
  v_list:=public.sisaep_admin_solicitudes(NULL,'99121201',0,50);
  IF (v_list->>'total')::int<>1 OR jsonb_array_length(v_list->'solicitudes')<>1 THEN RAISE EXCEPTION 'FAIL director aislamiento'; END IF;
  BEGIN PERFORM public.sisaep_admin_revisar('77120000-0000-4000-8000-000000000102','Rechazado'); RAISE EXCEPTION 'FAIL director otra escuela';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO pg_temp.role_checks VALUES('director_solo_su_escuela',true);
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"77120000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_session jsonb; v_list jsonb; BEGIN
  v_session:=public.sisaep_admin_sesion();
  IF v_session->>'id_tipo_usuario'<>'4' OR v_session->>'rol'<>'administrador_aplicacion' OR v_session->>'alcance'<>'aplicacion' OR v_session->'escuela'<>'null'::jsonb THEN RAISE EXCEPTION 'FAIL admin sesion'; END IF;
  v_list:=public.sisaep_admin_solicitudes(NULL,'99121201',0,50);
  IF (v_list->>'total')::int<>2 OR jsonb_array_length(v_list->'solicitudes')<>2 THEN RAISE EXCEPTION 'FAIL admin alcance global'; END IF;
  IF jsonb_array_length(public.sisaep_admin_solicitudes(NULL,'99121201',1,50)->'solicitudes')<>1 THEN RAISE EXCEPTION 'FAIL paginacion global'; END IF;
  PERFORM public.sisaep_admin_revisar('77120000-0000-4000-8000-000000000102','Rechazado');
  BEGIN PERFORM public.sisaep_admin_revisar('77120000-0000-4000-8000-000000000102','Aceptado'); RAISE EXCEPTION 'FAIL doble revision';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  IF public.sisaep_admin_revisar('77120000-0000-4000-8000-000000000101','Aceptado')->>'estado'<>'Aceptado' THEN RAISE EXCEPTION 'FAIL alta sin cuenta'; END IF;
  BEGIN UPDATE public.personal_administrativo SET rol_administrativo='administrador_aplicacion'; RAISE EXCEPTION 'FAIL admin concede roles';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO pg_temp.role_checks VALUES('administrador_aplicacion_todas_escuelas',true),('administrador_paginacion_y_revision',true),('alta_sin_cuenta_y_concurrencia',true),('roles_solo_servidor',true);
END; $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM sisaep_registro.revisiones WHERE solicitud_id='77120000-0000-4000-8000-000000000102' AND administrador_id='77120000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'FAIL auditoria global'; END IF;
  UPDATE public.sic_usuarios SET id_tipo_usuario=2 WHERE id_usuario='77120000-0000-4000-8000-000000000001';
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.sisaep_admin_sesion(); RAISE EXCEPTION 'FAIL rol revocado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  INSERT INTO pg_temp.role_checks VALUES('auditoria_global',true),('revocacion_efectiva',true);
END; $$;
SELECT jsonb_build_object('resultado','PASS','total',count(*),'pruebas',jsonb_agg(nombre ORDER BY nombre),'fixtures','ROLLBACK') AS validacion_roles FROM pg_temp.role_checks;
ROLLBACK;
