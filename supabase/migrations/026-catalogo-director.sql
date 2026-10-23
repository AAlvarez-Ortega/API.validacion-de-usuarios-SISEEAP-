-- Catálogo escolar administrado por el director. Conserva claves y relaciones históricas.
BEGIN;
-- No atribuye un semestre real a las materias nuevas que el director aún no ha clasificado.
INSERT INTO public.semestres(id_semestre,descripcion) VALUES(0,'Sin semestre especificado') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.catalogo_programas (
 escuela_cct varchar(10) NOT NULL REFERENCES public.sic_escuela(cct),
 id_plan integer NOT NULL REFERENCES public.sic_plan_est(id_plane),
 id_carrera integer NOT NULL REFERENCES public.sic_carreras(id_carrera),
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(escuela_cct,id_plan,id_carrera)
);
INSERT INTO public.catalogo_programas(escuela_cct,id_plan,id_carrera)
 SELECT DISTINCT id_escuela,id_plane,id_carrera FROM public.sic_pca ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.catalogo_materias_escuela (
 escuela_cct varchar(10) NOT NULL REFERENCES public.sic_escuela(cct),
 codigo varchar(15) NOT NULL REFERENCES public.sic_asignaturas(id_asignatura),
 nombre text NOT NULL CHECK(length(btrim(nombre)) BETWEEN 1 AND 100),
 activa boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 actualizada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 actualizada_por uuid REFERENCES public.sic_usuarios(id_usuario),
 PRIMARY KEY(escuela_cct,codigo)
);
ALTER TABLE public.sic_pca ADD COLUMN IF NOT EXISTS catalogo_habilitada boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.catalogo_academico_eventos (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 escuela_cct varchar(10) NOT NULL REFERENCES public.sic_escuela(cct),
 usuario uuid NOT NULL REFERENCES public.sic_usuarios(id_usuario),
 accion text NOT NULL, datos jsonb NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.catalogo_programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_materias_escuela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_academico_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogo_programas,public.catalogo_materias_escuela,public.catalogo_academico_eventos FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS historial_inmutable ON public.catalogo_academico_eventos;
CREATE TRIGGER historial_inmutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.catalogo_academico_eventos
 FOR EACH STATEMENT EXECUTE FUNCTION campus.inmutable();

CREATE OR REPLACE FUNCTION public.sisaep_admin_catalogo(p_cct text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scope text:=sisaep_registro.escuela_administrador(); cct text:=coalesce(nullif(upper(btrim(p_cct)),''),scope);
BEGIN
 IF cct IS NULL OR sisaep_seguridad.admin_constancias(cct) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CATALOGO_ESCUELA_NO_AUTORIZADA'; END IF;
 RETURN jsonb_build_object('escuela_cct',cct,
  'escuelas',(SELECT coalesce(jsonb_agg(jsonb_build_object('cct',btrim(e.cct),'nombre',e.nombre,'siglas',e.siglas) ORDER BY e.nombre),'[]') FROM public.sic_escuela e WHERE sisaep_seguridad.admin_constancias(btrim(e.cct))),
  'carreras',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id_carrera,'nombre',descripcion) ORDER BY descripcion,id_carrera),'[]') FROM public.sic_carreras),
  'planes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id_plane,'nombre',descripcion) ORDER BY id_plane DESC),'[]') FROM public.sic_plan_est),
  'programas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id_plan',p.id_plan,'id_carrera',p.id_carrera,'nombre_carrera',c.descripcion,'nombre_plan',e.descripcion) ORDER BY c.descripcion,p.id_plan),'[]') FROM public.catalogo_programas p JOIN public.sic_carreras c ON c.id_carrera=p.id_carrera JOIN public.sic_plan_est e ON e.id_plane=p.id_plan WHERE p.escuela_cct=cct),
  'materias',(SELECT coalesce(jsonb_agg(jsonb_build_object('codigo',m.codigo,'nombre',m.nombre,'activa',m.activa,'revision',m.revision,
    'programas',(SELECT coalesce(jsonb_agg(jsonb_build_object('id_plan',p.id_plane,'id_carrera',p.id_carrera) ORDER BY p.id_carrera,p.id_plane),'[]') FROM public.sic_pca p WHERE p.id_escuela=cct AND p.id_asignatura=m.codigo AND p.catalogo_habilitada)) ORDER BY m.nombre,m.codigo),'[]')
    FROM (SELECT p.id_asignatura codigo,coalesce(m.nombre,a.descripcion,p.id_asignatura) nombre,coalesce(m.activa,true) activa,coalesce(m.revision,0) revision FROM (SELECT DISTINCT id_asignatura FROM public.sic_pca WHERE id_escuela=cct UNION SELECT codigo FROM public.catalogo_materias_escuela WHERE escuela_cct=cct) p JOIN public.sic_asignaturas a ON a.id_asignatura=p.id_asignatura LEFT JOIN public.catalogo_materias_escuela m ON m.escuela_cct=cct AND m.codigo=p.id_asignatura) m),
  'historial',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id DESC),'[]') FROM (SELECT id,accion,datos,creado_en FROM public.catalogo_academico_eventos WHERE escuela_cct=cct ORDER BY id DESC LIMIT 30) e));
END; $$;

CREATE OR REPLACE FUNCTION public.sisaep_admin_guardar_programa(p_cct text,p_carrera integer,p_plan integer,p_nombre_carrera text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE cct text:=upper(btrim(p_cct)); cid integer:=p_carrera; nombre text:=btrim(p_nombre_carrera); nuevo integer;
BEGIN
 IF sisaep_seguridad.admin_constancias(cct) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CATALOGO_ESCUELA_NO_AUTORIZADA'; END IF;
 IF p_plan IS NULL OR p_plan NOT BETWEEN 1 AND 9999 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PLAN_INVALIDO'; END IF;
 IF cid IS NULL THEN
  IF nombre IS NULL OR length(nombre) NOT BETWEEN 2 AND 150 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARRERA_INVALIDA'; END IF;
  PERFORM pg_advisory_xact_lock(260001);
  SELECT min(id_carrera) INTO cid FROM public.sic_carreras WHERE lower(btrim(descripcion))=lower(nombre);
  IF cid IS NULL THEN
   SELECT coalesce(max(id_carrera),0)+1 INTO cid FROM public.sic_carreras;
   INSERT INTO public.sic_carreras(id_carrera,descripcion,fecha_alta) VALUES(cid,nombre,current_date);
  END IF;
 ELSIF NOT EXISTS(SELECT 1 FROM public.sic_carreras WHERE id_carrera=cid) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CARRERA_INVALIDA'; END IF;
 INSERT INTO public.sic_plan_est(id_plane,descripcion) VALUES(p_plan,'Plan '||p_plan) ON CONFLICT DO NOTHING;
 INSERT INTO public.catalogo_programas(escuela_cct,id_plan,id_carrera) VALUES(cct,p_plan,cid) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS nuevo = ROW_COUNT;
 IF nuevo>0 THEN INSERT INTO public.catalogo_academico_eventos(escuela_cct,usuario,accion,datos) VALUES(cct,auth.uid(),'PROGRAMA_AGREGADO',jsonb_build_object('id_carrera',cid,'id_plan',p_plan)); END IF;
 RETURN jsonb_build_object('id_carrera',cid,'id_plan',p_plan);
END; $$;

CREATE OR REPLACE FUNCTION public.sisaep_admin_guardar_materia_catalogo(p_cct text,p_codigo text,p_nombre text,p_programas jsonb,p_activa boolean,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE cct text:=upper(btrim(p_cct)); codigo text:=upper(btrim(p_codigo)); nombre text:=btrim(p_nombre); previa public.catalogo_materias_escuela%ROWTYPE; n integer; r record;
BEGIN
 IF sisaep_seguridad.admin_constancias(cct) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='CATALOGO_ESCUELA_NO_AUTORIZADA'; END IF;
 IF codigo IS NULL OR codigo !~ '^[A-Z0-9_.-]{1,15}$' OR nombre IS NULL OR length(nombre) NOT BETWEEN 1 AND 100
  OR p_activa IS NULL OR p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_programas) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_programas) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MATERIA_CATALOGO_INVALIDA'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_programas) x WHERE jsonb_typeof(x)<>'object' OR coalesce(x->>'id_plan','') !~ '^[0-9]{1,4}$' OR coalesce(x->>'id_carrera','') !~ '^[0-9]{1,9}$') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PROGRAMA_INVALIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_programas) x WHERE NOT EXISTS(SELECT 1 FROM public.catalogo_programas p WHERE (p.escuela_cct,p.id_plan,p.id_carrera)=(cct,(x->>'id_plan')::int,(x->>'id_carrera')::int))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PROGRAMA_FUERA_DE_ESCUELA'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cct||'/'||codigo,26));
 SELECT * INTO previa FROM public.catalogo_materias_escuela m WHERE m.escuela_cct=cct AND m.codigo=codigo FOR UPDATE;
 IF coalesce(previa.revision,0)<>p_revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CATALOGO_DESACTUALIZADO'; END IF;
 -- La clave global se conserva. Cada escuela mantiene su nombre sin renombrar otras escuelas.
 INSERT INTO public.sic_asignaturas(id_asignatura,descripcion,periodo) VALUES(codigo,left(nombre,70),0) ON CONFLICT DO NOTHING;
 INSERT INTO public.catalogo_materias_escuela(escuela_cct,codigo,nombre,activa,revision,actualizada_por) VALUES(cct,codigo,nombre,p_activa,1,auth.uid())
 ON CONFLICT ON CONSTRAINT catalogo_materias_escuela_pkey DO UPDATE SET nombre=excluded.nombre,activa=excluded.activa,revision=public.catalogo_materias_escuela.revision+1,actualizada_en=clock_timestamp(),actualizada_por=auth.uid() RETURNING revision INTO n;
 UPDATE public.sic_pca p SET catalogo_habilitada=false WHERE p.id_escuela=cct AND p.id_asignatura=codigo;
 FOR r IN SELECT DISTINCT (x->>'id_plan')::int plan,(x->>'id_carrera')::int carrera FROM jsonb_array_elements(p_programas) x LOOP
  INSERT INTO public.sic_pca(id_escuela,id_plane,id_carrera,id_asignatura,catalogo_habilitada) VALUES(cct,r.plan,r.carrera,codigo,true)
   ON CONFLICT(id_escuela,id_plane,id_carrera,id_asignatura) DO UPDATE SET catalogo_habilitada=true;
 END LOOP;
 INSERT INTO public.catalogo_academico_eventos(escuela_cct,usuario,accion,datos) VALUES(cct,auth.uid(),'MATERIA_GUARDADA',jsonb_build_object('codigo',codigo,'nombre',nombre,'activa',p_activa,'programas',p_programas,'revision',n));
 RETURN jsonb_build_object('codigo',codigo,'revision',n);
END; $$;

CREATE OR REPLACE FUNCTION public.sisaep_catalogo_alta_materia()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb:=sisaep_seguridad.contexto_asistencias();
BEGIN
 IF (ctx->>'rol')::integer<>2 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SOLO_PROFESOR_CREA_MATERIA'; END IF;
 RETURN jsonb_build_object(
  'periodos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id_cicloesc,'descripcion',coalesce(descripcion,'Ciclo '||id_cicloesc),'desde',curso_inicio,'hasta',curso_fin) ORDER BY curso_inicio DESC,id_cicloesc),'[]') FROM public.sic_ciclos WHERE curso_inicio IS NOT NULL AND curso_fin>=curso_inicio AND isfinite(curso_inicio) AND isfinite(curso_fin)),
  'planes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id_plan',p.id_plan,'id_carrera',p.id_carrera,'descripcion',concat_ws(' · ',c.descripcion,'Plan '||p.id_plan)) ORDER BY c.descripcion,p.id_plan),'[]') FROM public.catalogo_programas p JOIN public.sic_carreras c ON c.id_carrera=p.id_carrera WHERE p.escuela_cct=ctx->>'escuela'),
  'materias',(SELECT coalesce(jsonb_agg(jsonb_build_object('codigo',p.id_asignatura,'nombre',coalesce(m.nombre,a.descripcion,p.id_asignatura),'id_plan',p.id_plane,'id_carrera',p.id_carrera) ORDER BY coalesce(m.nombre,a.descripcion),p.id_asignatura,p.id_carrera,p.id_plane),'[]') FROM public.sic_pca p JOIN public.sic_asignaturas a ON a.id_asignatura=p.id_asignatura LEFT JOIN public.catalogo_materias_escuela m ON m.escuela_cct=p.id_escuela AND m.codigo=p.id_asignatura WHERE p.id_escuela=ctx->>'escuela' AND p.catalogo_habilitada AND coalesce(m.activa,true)));
END; $$;

-- Actualiza sólo la comprobación del catálogo en el alta con horario existente.
DO $actualizar$ DECLARE def text; original text; nueva text; patron text;
BEGIN
 original:=$old$IF NOT EXISTS(SELECT 1 FROM public.sic_pca WHERE
    (id_escuela,id_plane,id_carrera,id_asignatura)=(ctx->>'escuela',p_plan,p_carrera,codigo)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ASIGNATURA_FUERA_DEL_PLAN'; END IF;$old$;
 nueva:=$new$PERFORM 1 FROM public.catalogo_materias_escuela cm WHERE cm.escuela_cct=ctx->>'escuela' AND cm.codigo=codigo FOR SHARE;
  PERFORM 1 FROM public.sic_pca p WHERE (p.id_escuela,p.id_plane,p.id_carrera,p.id_asignatura)=(ctx->>'escuela',p_plan,p_carrera,codigo) FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM public.sic_pca p LEFT JOIN public.catalogo_materias_escuela cm ON cm.escuela_cct=p.id_escuela AND cm.codigo=p.id_asignatura WHERE
    (p.id_escuela,p.id_plane,p.id_carrera,p.id_asignatura)=(ctx->>'escuela',p_plan,p_carrera,codigo) AND p.catalogo_habilitada AND coalesce(cm.activa,true)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ASIGNATURA_FUERA_DEL_PLAN'; END IF;
  IF nombre IS DISTINCT FROM (SELECT coalesce(cm.nombre,a.descripcion,a.id_asignatura) FROM public.sic_asignaturas a LEFT JOIN public.catalogo_materias_escuela cm ON cm.escuela_cct=ctx->>'escuela' AND cm.codigo=a.id_asignatura WHERE a.id_asignatura=codigo) THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='CATALOGO_DESACTUALIZADO'; END IF;$new$;
 SELECT pg_get_functiondef('public.sisaep_crear_materia_horario(uuid,text,text,text,integer,integer,integer,jsonb)'::regprocedure) INTO def;
 def:=replace(def,E'\r\n',E'\n');
 patron:=$pat$IF[[:space:]]+NOT[[:space:]]+EXISTS\(SELECT[[:space:]]+1[[:space:]]+FROM[[:space:]]+public\.sic_pca[[:space:]]+WHERE[[:space:]]+\(id_escuela,id_plane,id_carrera,id_asignatura\)=\(ctx\->>'escuela',p_plan,p_carrera,codigo\)\)[[:space:]]+THEN[[:space:]]+RAISE[[:space:]]+EXCEPTION[[:space:]]+USING[[:space:]]+ERRCODE='22023',MESSAGE='ASIGNATURA_FUERA_DEL_PLAN';[[:space:]]+END[[:space:]]+IF;$pat$;
 IF def ~ patron THEN EXECUTE regexp_replace(def,patron,nueva);
 ELSIF strpos(def,'CATALOGO_DESACTUALIZADO')=0 THEN RAISE EXCEPTION 'Alta docente diferente: revisar antes de aplicar 026'; END IF;
END; $actualizar$;

-- Las versiones anteriores pueden recuperar sus materias existentes. Toda nueva alta requiere carrera, plan y horario.
CREATE OR REPLACE FUNCTION public.sisaep_crear_materia(p_id uuid,p_codigo text,p_nombre text,p_secuencia text,p_periodo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb:=sisaep_seguridad.contexto_asistencias(); m public.materias_docente%ROWTYPE;
BEGIN
 IF (ctx->>'rol')::integer<>2 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='SOLO_PROFESOR_CREA_MATERIA'; END IF;
 SELECT * INTO m FROM public.materias_docente WHERE id_profesor=auth.uid() AND codigo_materia=upper(btrim(p_codigo)) AND secuencia=upper(btrim(p_secuencia)) AND periodo=btrim(p_periodo);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MATERIA_REQUIERE_CATALOGO'; END IF;
 RETURN to_jsonb(m);
END; $$;
REVOKE ALL ON FUNCTION public.sisaep_admin_catalogo(text),public.sisaep_admin_guardar_programa(text,integer,integer,text),public.sisaep_admin_guardar_materia_catalogo(text,text,text,jsonb,boolean,integer),public.sisaep_catalogo_alta_materia() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sisaep_admin_catalogo(text),public.sisaep_admin_guardar_programa(text,integer,integer,text),public.sisaep_admin_guardar_materia_catalogo(text,text,text,jsonb,boolean,integer),public.sisaep_catalogo_alta_materia() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
