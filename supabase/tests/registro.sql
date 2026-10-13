BEGIN;
DO $tests$
DECLARE
  v_id uuid := '11111111-1111-4111-8111-111111111111';
  v_token text := repeat('a',64);
  v_payload jsonb := jsonb_build_object('nombre','PRUEBA','apellido_paterno','SISAEP',
    'apellido_materno','ROLLBACK','boleta_o_empleado','9999000101',
    'correo','qa.rollback.20261005@example.com','curp','PRUB000101HDFXXX01',
    'escuela_id','09DPN0003C','estado','Aceptado');
  v_result uuid;
  v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT id INTO v_result FROM public.sisaep_crear_solicitud(v_id,v_token,v_payload);
  IF v_result<>v_id THEN RAISE EXCEPTION 'Fallo: comprobante'; END IF;
  SELECT id INTO v_result FROM public.sisaep_crear_solicitud(v_id,v_token,v_payload);
  IF v_result<>v_id THEN RAISE EXCEPTION 'Fallo: reintento'; END IF;
  IF (SELECT estado FROM public.sisaep_estado_solicitud(v_id,v_token))<>'Pendiente'
    THEN RAISE EXCEPTION 'Fallo: estado forjado'; END IF;
  IF EXISTS (SELECT 1 FROM public.sisaep_estado_solicitud(v_id,repeat('b',64)))
    THEN RAISE EXCEPTION 'Fallo: secreto incorrecto'; END IF;
  BEGIN
    EXECUTE 'SELECT count(*) FROM sisaep_registro.solicitudes';
    RAISE EXCEPTION 'Fallo: lectura anonima';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    EXECUTE 'UPDATE sisaep_registro.solicitudes SET estado=''Aceptado''';
    RAISE EXCEPTION 'Fallo: escritura anonima';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.sisaep_crear_solicitud('22222222-2222-4222-8222-222222222222',repeat('c',64),v_payload);
    RAISE EXCEPTION 'Fallo: duplicado permitido';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM<>'SOLICITUD_DUPLICADA' THEN RAISE EXCEPTION 'Fallo: error expone datos'; END IF;
  END;
  BEGIN
    PERFORM public.sisaep_crear_solicitud(v_id,v_token,v_payload || '{"nombre":"OTRO"}'::jsonb);
    RAISE EXCEPTION 'Fallo: reutilizacion de comprobante';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.sisaep_crear_solicitud('33333333-3333-4333-8333-333333333333',repeat('d',64),v_payload || '{"escuela_id":"INEXISTENT"}'::jsonb);
    RAISE EXCEPTION 'Fallo: escuela inexistente';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  RESET ROLE;
  SELECT count(*) INTO v_count FROM sisaep_registro.solicitudes WHERE id=v_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Fallo: idempotencia'; END IF;
  BEGIN
    UPDATE sisaep_registro.solicitudes SET estado='Aceptado' WHERE id=v_id;
    RAISE EXCEPTION 'Fallo: cuenta sin confirmar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM<>'REVISION_AUTORIZADA_REQUERIDA' THEN RAISE; END IF;
  END;
END;
$tests$;
ROLLBACK;
SELECT 'PASS: registro anonimo acotado, idempotencia, duplicados, validacion, secreto de seguimiento, lectura/escritura privada bloqueadas y aceptacion sin revision bloqueada; datos de prueba revertidos' AS resultado;
