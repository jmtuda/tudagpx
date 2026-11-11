-- Additive definitions only; schema=1 and current-only-v1 remain unchanged.
-- Legacy missing metadata stays missing. Missing waypoints and [] are equivalent.
BEGIN;
CREATE OR REPLACE FUNCTION tudagpx_valid_waypoints(points jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE p jsonb; ids text[] := ARRAY[]::text[]; elevation double precision;
BEGIN
  IF NOT tudagpx_valid_points(points, true) THEN RETURN false; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(points) LOOP
    IF jsonb_typeof(p->'id') IS DISTINCT FROM 'string'
      OR btrim(p->>'id', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = ''
      OR (p->>'id') = ANY(ids) OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p->'description') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    ids := array_append(ids, p->>'id');
    IF p ? 'ele' AND p->'ele' <> 'null'::jsonb THEN
      -- JSON numbers can exceed the finite JavaScript/double precision range.
      BEGIN
        elevation := (p->>'ele')::double precision;
        IF elevation IN ('Infinity'::double precision, '-Infinity'::double precision, 'NaN'::double precision) THEN RETURN false; END IF;
      EXCEPTION WHEN numeric_value_out_of_range THEN RETURN false;
      END;
    END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION tudagpx_validate_current_workspace(doc jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE category text; item jsonb;
BEGIN
  PERFORM tudagpx_validate_workspace(doc);
  IF doc->'projects' <> '[]'::jsonb OR jsonb_path_exists(doc, '$.**.deletedAt') THEN
    RAISE EXCEPTION 'La política actual no admite papelera ni proyectos históricos.' USING ERRCODE = '22023';
  END IF;
  FOREACH category IN ARRAY ARRAY['routes','segments','draft'] LOOP
    FOR item IN SELECT value FROM jsonb_array_elements(doc->category) LOOP
      IF (category <> 'draft' AND item ? 'completed' AND jsonb_typeof(item->'completed') IS DISTINCT FROM 'boolean')
        OR (item ? 'description' AND jsonb_typeof(item->'description') IS DISTINCT FROM 'string') THEN
        RAISE EXCEPTION 'Metadatos de trazado inválidos.' USING ERRCODE = '22023';
      END IF;
      IF item ? 'waypoints' AND NOT tudagpx_valid_waypoints(item->'waypoints') THEN
        RAISE EXCEPTION 'Waypoints con datos inválidos o identificadores repetidos.' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION tudagpx_save_workspace(
  p_owner text, p_version bigint, p_document jsonb, p_patch boolean DEFAULT false,
  p_upload text DEFAULT NULL, p_total integer DEFAULT NULL
) RETURNS TABLE(version bigint) LANGUAGE plpgsql AS $$
DECLARE previous jsonb; next_doc jsonb; current_version bigint := 0; category text; entry jsonb;
  original jsonb; candidate jsonb; changes jsonb; combined jsonb; seen text[];
  removals jsonb := '{}'::jsonb; removed text[]; removal jsonb;
  part_count integer; valid_parts boolean; assembled text; saved_version bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner, 0));
  SELECT v.version, v.payload INTO current_version, previous FROM tudagpx_workspace_versions v
    WHERE v.owner_id = p_owner ORDER BY v.version DESC LIMIT 1;
  current_version := coalesce(current_version, 0);
  IF p_version IS NULL OR p_version <> current_version THEN
    RAISE EXCEPTION 'Hay cambios en otra pestaña o dispositivo. Descarga tu copia antes de recargar.' USING ERRCODE = '40001';
  END IF;
  IF p_upload IS NOT NULL THEN
    IF p_upload !~ '^[a-f0-9-]{36}$' OR p_total IS NULL OR p_total < 1 OR p_total > 1024 THEN
      RAISE EXCEPTION 'Carga no válida.' USING ERRCODE = '22023';
    END IF;
    SELECT count(*)::int, bool_and(u.total = p_total AND u.part >= 0 AND u.part < p_total),
      string_agg(u.chunk, '' ORDER BY u.part) INTO part_count, valid_parts, assembled
      FROM tudagpx_upload_parts u WHERE u.owner_id = p_owner AND u.upload_id = p_upload;
    IF part_count <> p_total OR valid_parts IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'La carga está incompleta. No se ha guardado ninguna versión.' USING ERRCODE = '22023';
    END IF;
    BEGIN p_document := assembled::jsonb;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Datos JSON no válidos.' USING ERRCODE = '22023'; END;
  END IF;
  IF p_patch THEN
    IF jsonb_typeof(p_document) IS DISTINCT FROM 'object'
      OR (p_document - ARRAY['fields','routes','segments','projects','remove']) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Patch no válido.' USING ERRCODE = '22023';
    END IF;
    next_doc := coalesce(previous, '{"schema":1,"routes":[],"segments":[],"draft":[],"projects":[],"draftName":"Mi nueva ruta"}'::jsonb);
    IF p_document ? 'remove' THEN
      removals := p_document->'remove';
      IF jsonb_typeof(removals) IS DISTINCT FROM 'object' OR removals - ARRAY['routes','segments'] <> '{}'::jsonb THEN
        RAISE EXCEPTION 'Borrado explícito no válido.' USING ERRCODE = '22023';
      END IF;
    END IF;
    FOREACH category IN ARRAY ARRAY['routes','segments'] LOOP
      removed := ARRAY[]::text[];
      IF NOT removals ? category THEN CONTINUE; END IF;
      IF jsonb_typeof(removals->category) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Borrado explícito no válido.' USING ERRCODE = '22023';
      END IF;
      FOR removal IN SELECT value FROM jsonb_array_elements(removals->category) LOOP
        IF jsonb_typeof(removal) IS DISTINCT FROM 'string' OR removal #>> '{}' = ''
          OR (removal #>> '{}') = ANY(removed) THEN
          RAISE EXCEPTION 'Identificador de borrado inválido o repetido.' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(next_doc->category) r WHERE r->>'id' = removal #>> '{}') THEN
          RAISE EXCEPTION 'No existe el original que se quiere borrar.' USING ERRCODE = '22023';
        END IF;
        removed := array_append(removed, removal #>> '{}');
      END LOOP;
      SELECT coalesce(jsonb_agg(value ORDER BY ord), '[]'::jsonb) INTO combined
        FROM jsonb_array_elements(next_doc->category) WITH ORDINALITY AS records(value, ord)
        WHERE NOT (value->>'id' = ANY(removed));
      next_doc := jsonb_set(next_doc, ARRAY[category], combined);
    END LOOP;
    IF p_document ? 'fields' THEN
      changes := p_document->'fields';
      IF jsonb_typeof(changes) IS DISTINCT FROM 'object' OR changes - ARRAY['draft','draftName'] <> '{}'::jsonb THEN
        RAISE EXCEPTION 'Campos de patch no válidos.' USING ERRCODE = '22023';
      END IF;
      next_doc := next_doc || changes;
    END IF;
    FOREACH category IN ARRAY ARRAY['routes','segments','projects'] LOOP
      IF NOT p_document ? category THEN CONTINUE; END IF;
      IF jsonb_typeof(p_document->category) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Colección de patch no válida.' USING ERRCODE = '22023';
      END IF;
      seen := ARRAY[]::text[];
      FOR entry IN SELECT value FROM jsonb_array_elements(p_document->category) LOOP
        IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string'
          OR entry->>'id' = '' OR jsonb_typeof(entry->'fields') IS DISTINCT FROM 'object'
          OR entry - ARRAY['id','fields'] <> '{}'::jsonb OR (entry->>'id') = ANY(seen)
          OR (entry->'fields' ? 'id' AND entry->'fields'->'id' IS DISTINCT FROM entry->'id')
          OR coalesce(removals->category, '[]'::jsonb) ? (entry->>'id') THEN
          RAISE EXCEPTION 'Registro de patch no válido o borrado simultáneo.' USING ERRCODE = '22023';
        END IF;
        seen := array_append(seen, entry->>'id');
        SELECT value INTO original FROM jsonb_array_elements(next_doc->category) WHERE value->>'id' = entry->>'id';
        candidate := coalesce(original, '{}'::jsonb) || (entry->'fields') || jsonb_build_object('id', entry->>'id');
        SELECT coalesce(jsonb_agg(CASE WHEN value->>'id' = entry->>'id' THEN candidate ELSE value END ORDER BY ord), '[]'::jsonb)
          INTO combined FROM jsonb_array_elements(next_doc->category) WITH ORDINALITY AS records(value, ord);
        IF original IS NULL THEN combined := combined || jsonb_build_array(candidate); END IF;
        next_doc := jsonb_set(next_doc, ARRAY[category], combined);
      END LOOP;
    END LOOP;
  ELSE next_doc := p_document;
  END IF;
  PERFORM tudagpx_validate_current_workspace(next_doc);
  FOREACH category IN ARRAY ARRAY['routes','segments'] LOOP
    FOR original IN SELECT value FROM jsonb_array_elements(previous->category) LOOP
      IF p_patch AND coalesce(removals->category, '[]'::jsonb) ? (original->>'id') THEN CONTINUE; END IF;
      SELECT value INTO candidate FROM jsonb_array_elements(next_doc->category) WHERE value->>'id' = original->>'id';
      IF category = 'routes' AND (candidate IS NULL OR candidate->'original' IS DISTINCT FROM original->'original'
        OR candidate->'originalBase64' IS DISTINCT FROM original->'originalBase64' OR candidate->'tracks' IS DISTINCT FROM original->'tracks'
        OR coalesce(candidate->'waypoints', '[]'::jsonb) IS DISTINCT FROM coalesce(original->'waypoints', '[]'::jsonb)) THEN
        RAISE EXCEPTION 'No se permite sustituir ni eliminar implícitamente originales.' USING ERRCODE = '22023';
      ELSIF category = 'segments' AND (candidate IS NULL OR candidate->'points' IS DISTINCT FROM original->'points'
        OR candidate->'original' IS DISTINCT FROM original->'original'
        OR candidate->'originalBase64' IS DISTINCT FROM original->'originalBase64'
        OR coalesce(candidate->'waypoints', '[]'::jsonb) IS DISTINCT FROM coalesce(original->'waypoints', '[]'::jsonb)) THEN
        RAISE EXCEPTION 'Los segmentos originales no se pueden sobrescribir ni eliminar implícitamente.' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
  saved_version := current_version + 1;
  INSERT INTO tudagpx_workspace_versions(owner_id, version, payload) VALUES(p_owner, saved_version, next_doc);
  DELETE FROM tudagpx_workspace_versions v WHERE v.owner_id = p_owner AND v.version <> saved_version;
  IF p_upload IS NOT NULL THEN
    DELETE FROM tudagpx_upload_parts WHERE owner_id = p_owner AND upload_id = p_upload;
  END IF;
  PERFORM tudagpx_cleanup_uploads(p_owner, NULL);
  RETURN QUERY SELECT saved_version;
END $$;
COMMENT ON FUNCTION tudagpx_save_workspace(text,bigint,jsonb,boolean,text,integer) IS 'current-only-v1: explicit removals; immutable surviving originals; one atomic current head; payload/parts stay in PostgreSQL';
COMMIT;
