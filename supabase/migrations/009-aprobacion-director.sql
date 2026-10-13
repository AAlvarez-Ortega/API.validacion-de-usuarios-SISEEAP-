-- El director valida la identidad; la cuenta se activa después de la aprobación.
BEGIN;
CREATE OR REPLACE FUNCTION sisaep_registro.conflicto_alta(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM sisaep_registro.solicitudes s WHERE s.id=p_id AND (
   EXISTS(SELECT 1 FROM public."App_Solicitudes" p
    WHERE (trim(p.boleta_o_empleado)=s.boleta_o_empleado OR lower(trim(p.correo))=s.correo OR upper(trim(p.curp))=s.curp)
    AND ROW(upper(trim(p.nombre)),upper(trim(p.apellido_paterno)),upper(trim(p.apellido_materno)),trim(p.boleta_o_empleado),lower(trim(p.correo)),upper(trim(p.curp)),trim(p.escuela_cct))
     IS DISTINCT FROM ROW(s.nombre,s.apellido_paterno,s.apellido_materno,s.boleta_o_empleado,s.correo,s.curp,trim(s.escuela_cct)))
   OR (SELECT count(*) FROM public."App_Solicitudes" p
    WHERE trim(p.boleta_o_empleado)=s.boleta_o_empleado OR lower(trim(p.correo))=s.correo OR upper(trim(p.curp))=s.curp)>1
   OR EXISTS(SELECT 1 FROM public.sic_usuarios u LEFT JOIN auth.users a ON a.id=u.id_usuario
    WHERE (trim(u.boleta_o_empleado)=s.boleta_o_empleado OR lower(trim(u.correo))=s.correo OR upper(trim(u.curp))=s.curp OR lower(a.email)=s.correo)
    AND (lower(a.email) IS DISTINCT FROM s.correo OR
     ROW(upper(trim(u.nombre)),upper(trim(u.apellido_paterno)),upper(trim(u.apellido_materno)),trim(u.boleta_o_empleado),lower(trim(u.correo)),upper(trim(u.curp)),trim(u.escuela_cct))
      IS DISTINCT FROM ROW(s.nombre,s.apellido_paterno,s.apellido_materno,s.boleta_o_empleado,s.correo,s.curp,trim(s.escuela_cct))))
   OR (SELECT count(*) FROM public.sic_usuarios u WHERE trim(u.boleta_o_empleado)=s.boleta_o_empleado OR lower(trim(u.correo))=s.correo OR upper(trim(u.curp))=s.curp)>1
  ));
$$;

CREATE OR REPLACE FUNCTION sisaep_registro.validar_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.estado='Aceptado' AND ROW(NEW.nombre,NEW.apellido_paterno,NEW.apellido_materno,NEW.boleta_o_empleado,NEW.correo,NEW.curp,NEW.escuela_cct,NEW.estado)
  IS DISTINCT FROM ROW(OLD.nombre,OLD.apellido_paterno,OLD.apellido_materno,OLD.boleta_o_empleado,OLD.correo,OLD.curp,OLD.escuela_cct,OLD.estado) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_NO_EDITABLE';
 END IF;
 IF NEW.estado='Aceptado' AND OLD.estado IS DISTINCT FROM 'Aceptado' AND NOT (
  -- Compatibilidad con el flujo anterior, que ya exigía una cuenta confirmada.
  EXISTS(SELECT 1 FROM public.sic_usuarios u JOIN auth.users a ON a.id=u.id_usuario
   WHERE lower(u.correo)=NEW.correo AND lower(a.email)=NEW.correo AND a.email_confirmed_at IS NOT NULL
    AND upper(trim(u.nombre))=NEW.nombre AND upper(trim(u.apellido_paterno))=NEW.apellido_paterno
    AND upper(trim(u.apellido_materno))=NEW.apellido_materno AND trim(u.boleta_o_empleado)=NEW.boleta_o_empleado
    AND upper(trim(u.curp))=NEW.curp AND u.escuela_cct=NEW.escuela_cct)
  OR (EXISTS(SELECT 1 FROM sisaep_registro.revisiones r
    WHERE r.solicitud_id=OLD.id AND r.version_solicitud=OLD.version AND r.estado_anterior='Pendiente'
     AND r.estado_nuevo='Aceptado' AND r.administrador_id=auth.uid())
   AND (sisaep_registro.escuela_administrador() IS NULL OR trim(NEW.escuela_cct)=sisaep_registro.escuela_administrador())
   AND EXISTS(SELECT 1 FROM public."App_Solicitudes" p
    WHERE ROW(upper(trim(p.nombre)),upper(trim(p.apellido_paterno)),upper(trim(p.apellido_materno)),trim(p.boleta_o_empleado),lower(trim(p.correo)),upper(trim(p.curp)),trim(p.escuela_cct))
     =ROW(NEW.nombre,NEW.apellido_paterno,NEW.apellido_materno,NEW.boleta_o_empleado,NEW.correo,NEW.curp,trim(NEW.escuela_cct))))
 ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='REVISION_AUTORIZADA_REQUERIDA'; END IF;
 IF ROW(NEW.nombre,NEW.apellido_paterno,NEW.apellido_materno,NEW.boleta_o_empleado,NEW.correo,NEW.curp,NEW.escuela_cct,NEW.estado)
  IS DISTINCT FROM ROW(OLD.nombre,OLD.apellido_paterno,OLD.apellido_materno,OLD.boleta_o_empleado,OLD.correo,OLD.curp,OLD.escuela_cct,OLD.estado)
 THEN NEW.version:=OLD.version+1; ELSE NEW.version:=OLD.version; END IF;
 IF NEW.estado='Pendiente' THEN NEW.revisado_en:=NULL;
 ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN NEW.revisado_en:=now(); END IF;
 RETURN NEW;
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
  'coincide_padron',pad->>'estado'='coincidente','cuenta_confirmada_coincide',cuenta->>'estado'='coincidente',
  'conflicto_identidad',sisaep_registro.conflicto_alta(p_id),
  'puede_aceptar',s.estado='Pendiente' AND NOT sisaep_registro.conflicto_alta(p_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.sisaep_admin_revisar_version(p_id uuid,p_estado text,p_version integer,p_estado_esperado text DEFAULT 'Pendiente')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cct text:=sisaep_registro.escuela_administrador(); s sisaep_registro.solicitudes%ROWTYPE; v_uid uuid;
BEGIN
 IF p_id IS NULL OR p_estado IS NULL OR p_estado NOT IN('Aceptado','Rechazado') OR p_estado_esperado IS DISTINCT FROM 'Pendiente' OR p_version IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='REVISION_INVALIDA'; END IF;
 SELECT q.* INTO s FROM sisaep_registro.solicitudes q WHERE q.id=p_id AND (v_cct IS NULL OR trim(q.escuela_cct)=v_cct) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SOLICITUD_NO_DISPONIBLE'; END IF;
 IF s.estado<>p_estado_esperado OR s.version<>p_version THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='SOLICITUD_CAMBIO'; END IF;
 IF p_estado='Aceptado' THEN
  -- Serializa las altas también frente a importaciones: comprobar e insertar es atómico.
  LOCK TABLE public."App_Solicitudes",public.sic_usuarios IN SHARE ROW EXCLUSIVE MODE;
  IF sisaep_registro.conflicto_alta(p_id) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='IDENTIDAD_EN_CONFLICTO'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."App_Solicitudes" p WHERE trim(p.boleta_o_empleado)=s.boleta_o_empleado OR lower(trim(p.correo))=s.correo OR upper(trim(p.curp))=s.curp) THEN
   INSERT INTO public."App_Solicitudes"(nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
   VALUES(s.nombre,s.apellido_paterno,s.apellido_materno,s.boleta_o_empleado,s.correo,s.curp,s.escuela_cct);
  END IF;
  -- Una cuenta ya confirmada sin perfil recibe el perfil validado, sin privilegios administrativos.
  SELECT a.id INTO v_uid FROM auth.users a WHERE lower(a.email)=s.correo AND a.email_confirmed_at IS NOT NULL;
  IF v_uid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sic_usuarios u WHERE u.id_usuario=v_uid) THEN
   INSERT INTO public.sic_usuarios(id_usuario,nombre,apellido_paterno,apellido_materno,boleta_o_empleado,correo,curp,escuela_cct)
   VALUES(v_uid,s.nombre,s.apellido_paterno,s.apellido_materno,s.boleta_o_empleado,s.correo,s.curp,s.escuela_cct);
  END IF;
 END IF;
 INSERT INTO sisaep_registro.revisiones(solicitud_id,administrador_id,estado_anterior,estado_nuevo,version_solicitud)
 VALUES(p_id,auth.uid(),s.estado,p_estado,s.version);
 UPDATE sisaep_registro.solicitudes SET estado=p_estado WHERE id=p_id;
 RETURN sisaep_registro.detalle_solicitud(p_id);
END;
$$;
REVOKE ALL ON FUNCTION sisaep_registro.conflicto_alta(uuid),sisaep_registro.validar_revision() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sisaep_admin_revisar_version(uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sisaep_admin_revisar_version(uuid,text,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'PASS: aprobación del director y alta en padrón instaladas' AS resultado;
