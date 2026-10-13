-- Correcciones con comprobante privado; rechazo no reserva la identidad para siempre.
BEGIN;
ALTER TABLE sisaep_registro.solicitudes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE sisaep_registro.revisiones ADD COLUMN IF NOT EXISTS version_solicitud integer NOT NULL DEFAULT 1;
ALTER TABLE sisaep_registro.solicitudes DROP CONSTRAINT IF EXISTS solicitudes_boleta_o_empleado_key;
ALTER TABLE sisaep_registro.solicitudes DROP CONSTRAINT IF EXISTS solicitudes_correo_key;
ALTER TABLE sisaep_registro.solicitudes DROP CONSTRAINT IF EXISTS solicitudes_curp_key;
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_boleta_activa ON sisaep_registro.solicitudes(boleta_o_empleado) WHERE estado<>'Rechazado';
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_correo_activo ON sisaep_registro.solicitudes(correo) WHERE estado<>'Rechazado';
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_curp_activa ON sisaep_registro.solicitudes(curp) WHERE estado<>'Rechazado';
CREATE TABLE IF NOT EXISTS sisaep_registro.correcciones (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitud_id uuid NOT NULL REFERENCES sisaep_registro.solicitudes(id),
 version_anterior integer NOT NULL,
 datos_anteriores jsonb NOT NULL,
 corregido_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(solicitud_id,version_anterior)
);
ALTER TABLE sisaep_registro.correcciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sisaep_registro.correcciones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE sisaep_registro.correcciones_id_seq FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION sisaep_registro.datos_solicitud(p jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE v jsonb:=jsonb_build_object('nombre',upper(trim(p->>'nombre')),
 'apellido_paterno',upper(trim(p->>'apellido_paterno')),'apellido_materno',upper(trim(p->>'apellido_materno')),
 'boleta_o_empleado',trim(p->>'boleta_o_empleado'),'correo',lower(trim(p->>'correo')),
 'curp',upper(trim(p->>'curp')),'escuela_id',trim(p->>'escuela_id'));
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object'
  OR coalesce(length(v->>'nombre'),0) NOT BETWEEN 1 AND 80
  OR coalesce(length(v->>'apellido_paterno'),0) NOT BETWEEN 1 AND 80
  OR coalesce(length(v->>'apellido_materno'),0) NOT BETWEEN 1 AND 80
  OR coalesce(v->>'boleta_o_empleado','') !~ '^[0-9]{8,10}$'
  OR coalesce(length(v->>'correo'),255)>254
  OR coalesce(v->>'correo','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  OR coalesce(v->>'curp','') !~ '^[A-Z0-9]{18}$'
  OR NOT EXISTS(SELECT 1 FROM public.sic_escuela e WHERE e.cct=v->>'escuela_id') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='SOLICITUD_INVALIDA';
 END IF;
 RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION sisaep_registro.campos_distintos(p jsonb,s jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(k ORDER BY k),'[]'::jsonb)
 FROM unnest(ARRAY['nombre','apellido_paterno','apellido_materno','boleta_o_empleado','correo','curp','escuela_id']) k
 WHERE p->>k IS DISTINCT FROM s->>k;
$$;

CREATE OR REPLACE FUNCTION sisaep_registro.validar_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.estado='Aceptado' AND NOT EXISTS (
  SELECT 1 FROM public.sic_usuarios u JOIN auth.users a ON a.id=u.id_usuario
  WHERE lower(u.correo)=NEW.correo AND lower(a.email)=NEW.correo AND a.email_confirmed_at IS NOT NULL
   AND upper(trim(u.nombre))=NEW.nombre AND upper(trim(u.apellido_paterno))=NEW.apellido_paterno
   AND upper(trim(u.apellido_materno))=NEW.apellido_materno AND trim(u.boleta_o_empleado)=NEW.boleta_o_empleado
   AND upper(trim(u.curp))=NEW.curp AND u.escuela_cct=NEW.escuela_cct
 ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='CUENTA_CONFIRMADA_REQUERIDA'; END IF;
 IF ROW(NEW.nombre,NEW.apellido_paterno,NEW.apellido_materno,NEW.boleta_o_empleado,NEW.correo,NEW.curp,NEW.escuela_cct,NEW.estado)
  IS DISTINCT FROM ROW(OLD.nombre,OLD.apellido_paterno,OLD.apellido_materno,OLD.boleta_o_empleado,OLD.correo,OLD.curp,OLD.escuela_cct,OLD.estado)
 THEN NEW.version:=OLD.version+1;
 ELSE NEW.version:=OLD.version; END IF;
 IF NEW.estado='Pendiente' THEN NEW.revisado_en:=NULL;
 ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN NEW.revisado_en:=now(); END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisaep_solicitud_propia(p_id uuid,p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',s.id,'version',s.version,'estado',s.estado,
  'datos',jsonb_build_object('nombre',s.nombre,'apellido_paterno',s.apellido_paterno,
    'apellido_materno',s.apellido_materno,'boleta_o_empleado',s.boleta_o_empleado,
    'correo',s.correo,'curp',s.curp,'escuela_id',trim(s.escuela_cct)))
 FROM sisaep_registro.solicitudes s WHERE s.id=p_id AND p_token ~ '^[a-f0-9]{64}$'
 AND s.token_hash=sha256(convert_to(p_token,'UTF8'));
$$;

CREATE OR REPLACE FUNCTION public.sisaep_corregir_solicitud(p_id uuid,p_token text,p_version integer,p_solicitud jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s sisaep_registro.solicitudes%ROWTYPE; v jsonb; anterior jsonb;
BEGIN
 SELECT q.* INTO s FROM sisaep_registro.solicitudes q WHERE q.id=p_id
  AND p_token ~ '^[a-f0-9]{64}$' AND q.token_hash=sha256(convert_to(p_token,'UTF8')) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='COMPROBANTE_INVALIDO'; END IF;
 v:=sisaep_registro.datos_solicitud(p_solicitud);
 anterior:=jsonb_build_object('nombre',s.nombre,'apellido_paterno',s.apellido_paterno,
  'apellido_materno',s.apellido_materno,'boleta_o_empleado',s.boleta_o_empleado,
  'correo',s.correo,'curp',s.curp,'escuela_id',trim(s.escuela_cct));
 IF p_version IS NULL OR s.estado='Aceptado' THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_NO_EDITABLE';
 END IF;
 IF s.version<>p_version THEN
  -- Recupera una respuesta perdida sin volver a escribir ni duplicar el historial.
  IF s.version=p_version+1 AND s.estado='Pendiente' AND anterior=v
   AND EXISTS(SELECT 1 FROM sisaep_registro.correcciones c WHERE c.solicitud_id=s.id AND c.version_anterior=p_version)
  THEN RETURN public.sisaep_solicitud_propia(p_id,p_token); END IF;
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_CAMBIO';
 END IF;
 IF anterior=v AND s.estado='Pendiente' THEN RETURN public.sisaep_solicitud_propia(p_id,p_token); END IF;
 INSERT INTO sisaep_registro.correcciones(solicitud_id,version_anterior,datos_anteriores)
 VALUES(s.id,s.version,to_jsonb(s)-'token_hash');
 UPDATE sisaep_registro.solicitudes SET nombre=v->>'nombre',apellido_paterno=v->>'apellido_paterno',
  apellido_materno=v->>'apellido_materno',boleta_o_empleado=v->>'boleta_o_empleado',correo=v->>'correo',
  curp=v->>'curp',escuela_cct=v->>'escuela_id',estado='Pendiente' WHERE id=p_id;
 RETURN public.sisaep_solicitud_propia(p_id,p_token);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='SOLICITUD_DUPLICADA';
END;
$$;

CREATE OR REPLACE FUNCTION sisaep_registro.detalle_solicitud(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s sisaep_registro.solicitudes%ROWTYPE; d jsonb; e jsonb; pad jsonb;
 n integer; iguales integer; diferencias jsonb; cuenta jsonb; perfil jsonb; confirmado boolean;
BEGIN
 SELECT * INTO s FROM sisaep_registro.solicitudes WHERE id=p_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=jsonb_build_object('nombre',s.nombre,'apellido_paterno',s.apellido_paterno,
 'apellido_materno',s.apellido_materno,'boleta_o_empleado',s.boleta_o_empleado,'correo',s.correo,
 'curp',s.curp,'escuela_id',trim(s.escuela_cct));
 SELECT jsonb_build_object('id',trim(cct),'cct',trim(cct),'nombre',nombre,'siglas',siglas) INTO e FROM public.sic_escuela WHERE cct=s.escuela_cct;
 SELECT count(*),count(*) FILTER(WHERE diff='[]'::jsonb),coalesce(jsonb_agg(diff)->0,'[]'::jsonb)
 INTO n,iguales,diferencias FROM (
  SELECT sisaep_registro.campos_distintos(jsonb_build_object('nombre',upper(trim(p.nombre)),
   'apellido_paterno',upper(trim(p.apellido_paterno)),'apellido_materno',upper(trim(p.apellido_materno)),
   'boleta_o_empleado',trim(p.boleta_o_empleado),'correo',lower(trim(p.correo)),
   'curp',upper(trim(p.curp)),'escuela_id',trim(p.escuela_cct)),d) diff
  FROM public."App_Solicitudes" p WHERE trim(p.boleta_o_empleado)=s.boleta_o_empleado
   OR lower(trim(p.correo))=s.correo OR upper(trim(p.curp))=s.curp
 ) candidatos;
 pad:=jsonb_build_object('estado',CASE WHEN iguales>0 THEN 'coincidente' WHEN n=0 THEN 'faltante' WHEN n>1 THEN 'ambiguo' ELSE 'diferente' END,
  'campos_diferentes',CASE WHEN iguales=0 AND n=1 THEN diferencias ELSE '[]'::jsonb END);
 SELECT a.email_confirmed_at IS NOT NULL INTO confirmado FROM auth.users a WHERE lower(a.email)=s.correo;
 IF NOT FOUND THEN cuenta:=jsonb_build_object('estado','faltante','campos_diferentes','[]'::jsonb);
 ELSIF NOT confirmado THEN cuenta:=jsonb_build_object('estado','sin_confirmar','campos_diferentes','[]'::jsonb);
 ELSE
  SELECT jsonb_build_object('nombre',upper(trim(u.nombre)),'apellido_paterno',upper(trim(u.apellido_paterno)),
   'apellido_materno',upper(trim(u.apellido_materno)),'boleta_o_empleado',trim(u.boleta_o_empleado),
   'correo',lower(trim(u.correo)),'curp',upper(trim(u.curp)),'escuela_id',trim(u.escuela_cct)) INTO perfil
  FROM public.sic_usuarios u JOIN auth.users a ON a.id=u.id_usuario WHERE lower(a.email)=s.correo;
  IF NOT FOUND THEN cuenta:=jsonb_build_object('estado','sin_perfil','campos_diferentes','[]'::jsonb);
  ELSE diferencias:=sisaep_registro.campos_distintos(perfil,d);
   cuenta:=jsonb_build_object('estado',CASE WHEN diferencias='[]'::jsonb THEN 'coincidente' ELSE 'diferente' END,'campos_diferentes',diferencias);
  END IF;
 END IF;
 RETURN d || jsonb_build_object('id',s.id,'version',s.version,'estado',s.estado,'creado_en',s.creado_en,
  'revisado_en',s.revisado_en,'escuelas',e,'validacion_padron',pad,'validacion_cuenta',cuenta,
  'coincide_padron',pad->>'estado'='coincidente','cuenta_confirmada_coincide',cuenta->>'estado'='coincidente');
END;
$$;

CREATE OR REPLACE FUNCTION public.sisaep_admin_revisar_version(p_id uuid,p_estado text,p_version integer,p_estado_esperado text DEFAULT 'Pendiente')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cct text:=sisaep_registro.escuela_administrador(); s sisaep_registro.solicitudes%ROWTYPE;
BEGIN
 IF p_id IS NULL OR p_estado IS NULL OR p_estado NOT IN('Aceptado','Rechazado') OR p_estado_esperado IS DISTINCT FROM 'Pendiente' OR p_version IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='REVISION_INVALIDA'; END IF;
 SELECT q.* INTO s FROM sisaep_registro.solicitudes q WHERE q.id=p_id AND (v_cct IS NULL OR trim(q.escuela_cct)=v_cct) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SOLICITUD_NO_DISPONIBLE'; END IF;
 IF s.estado<>p_estado_esperado OR s.version<>p_version THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_CAMBIO'; END IF;
 IF p_estado='Aceptado' AND NOT (sisaep_registro.detalle_solicitud(p_id)->>'cuenta_confirmada_coincide')::boolean THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='CUENTA_CONFIRMADA_REQUERIDA'; END IF;
 INSERT INTO sisaep_registro.revisiones(solicitud_id,administrador_id,estado_anterior,estado_nuevo,version_solicitud)
 VALUES(p_id,auth.uid(),s.estado,p_estado,s.version);
 UPDATE sisaep_registro.solicitudes SET estado=p_estado WHERE id=p_id;
 RETURN sisaep_registro.detalle_solicitud(p_id);
END;
$$;
-- Clientes antiguos solo pueden revisar la primera version que leyeron.
CREATE OR REPLACE FUNCTION public.sisaep_admin_revisar(p_id uuid,p_estado text,p_estado_esperado text DEFAULT 'Pendiente')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.sisaep_admin_revisar_version(p_id,p_estado,1,p_estado_esperado); END;
$$;
REVOKE ALL ON FUNCTION sisaep_registro.datos_solicitud(jsonb),sisaep_registro.campos_distintos(jsonb,jsonb),sisaep_registro.detalle_solicitud(uuid),sisaep_registro.validar_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sisaep_solicitud_propia(uuid,text),public.sisaep_corregir_solicitud(uuid,text,integer,jsonb),public.sisaep_admin_revisar_version(uuid,text,integer,text),public.sisaep_admin_revisar(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sisaep_solicitud_propia(uuid,text),public.sisaep_corregir_solicitud(uuid,text,integer,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sisaep_admin_revisar_version(uuid,text,integer,text),public.sisaep_admin_revisar(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'PASS: correcciones instaladas sin cambiar cuentas ni solicitudes existentes' AS resultado;
