-- Additive only: existing append-only snapshots and upload parts are unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION tudagpx_valid_points(points jsonb, allow_empty boolean, check_ele boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE p jsonb;
BEGIN
  IF jsonb_typeof(points) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF NOT allow_empty AND jsonb_array_length(points) = 0 THEN RETURN false; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(points) LOOP
    IF jsonb_typeof(p) IS DISTINCT FROM 'object'
      OR jsonb_typeof(p->'lat') IS DISTINCT FROM 'number'
      OR jsonb_typeof(p->'lon') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF abs((p->>'lat')::numeric) > 90 OR abs((p->>'lon')::numeric) > 180 THEN RETURN false; END IF;
    IF check_ele AND p ? 'ele' AND p->'ele' <> 'null'::jsonb AND jsonb_typeof(p->'ele') <> 'number' THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION tudagpx_validate_workspace(doc jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE category text; item jsonb; track jsonb; element jsonb; ids text[] := ARRAY[]::text[]; encoded text;
BEGIN
  IF jsonb_typeof(doc) IS DISTINCT FROM 'object' OR doc->'schema' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(doc->'draftName') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Copia de seguridad incompatible.' USING ERRCODE = '22023';
  END IF;
  FOREACH category IN ARRAY ARRAY['routes','segments','draft','projects'] LOOP
    IF jsonb_typeof(doc->category) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Copia de seguridad incompatible.' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(doc->category) LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
        OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR (item->>'id') = ANY(ids) THEN
        RAISE EXCEPTION 'Trazados inválidos o identificadores repetidos.' USING ERRCODE = '22023';
      END IF;
      ids := array_append(ids, item->>'id');
      IF category <> 'projects' AND item ? 'deletedAt' THEN
        IF jsonb_typeof(item->'deletedAt') IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Marca de borrado inválida.' USING ERRCODE = '22023';
        END IF;
        BEGIN
          IF NOT isfinite((item->>'deletedAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid timestamp'; END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Marca de borrado inválida.' USING ERRCODE = '22023';
        END;
      END IF;
      IF category = 'routes' THEN
        IF jsonb_typeof(item->'tracks') IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'Trazados inválidos.' USING ERRCODE = '22023';
        END IF;
        IF jsonb_array_length(item->'tracks') = 0 THEN
          RAISE EXCEPTION 'Trazados inválidos.' USING ERRCODE = '22023';
        END IF;
        FOR track IN SELECT value FROM jsonb_array_elements(item->'tracks') LOOP
          IF NOT tudagpx_valid_points(track, false) THEN
            RAISE EXCEPTION 'Trazados inválidos.' USING ERRCODE = '22023';
          END IF;
        END LOOP;
        IF item ? 'original' AND jsonb_typeof(item->'original') <> 'string' THEN
          RAISE EXCEPTION 'Original GPX inválido.' USING ERRCODE = '22023';
        END IF;
        IF item ? 'originalBase64' THEN
          IF jsonb_typeof(item->'originalBase64') <> 'string' THEN
            RAISE EXCEPTION 'Bytes originales inválidos.' USING ERRCODE = '22023';
          END IF;
          -- Match browser atob: ASCII whitespace and unpadded base64 are allowed.
          encoded := regexp_replace(item->>'originalBase64', E'[ \\t\\n\\r\\f]', '', 'g');
          IF encoded !~ '^[A-Za-z0-9+/]*={0,2}$' OR length(encoded) % 4 = 1
            OR (position('=' IN encoded) > 0 AND length(encoded) % 4 <> 0) THEN
            RAISE EXCEPTION 'Bytes originales dañados.' USING ERRCODE = '22023';
          END IF;
        END IF;
      ELSIF category = 'projects' THEN
        IF jsonb_typeof(item->'elements') IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'Proyecto inválido.' USING ERRCODE = '22023';
        END IF;
        FOR element IN SELECT value FROM jsonb_array_elements(item->'elements') LOOP
          IF jsonb_typeof(element->'name') IS DISTINCT FROM 'string'
            OR NOT tudagpx_valid_points(element->'points', true, false) THEN
            RAISE EXCEPTION 'Proyecto con puntos inválidos.' USING ERRCODE = '22023';
          END IF;
        END LOOP;
      ELSE
        IF NOT tudagpx_valid_points(item->'points', category = 'draft') THEN
          RAISE EXCEPTION 'Trazados inválidos.' USING ERRCODE = '22023';
        END IF;
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
  part_count integer; valid_parts boolean; assembled text; saved_version bigint;
BEGIN
  -- Serialize this owner's commits, including its first revision. No payload leaves Postgres.
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
      OR (p_document - ARRAY['fields','routes','segments','projects']) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Patch no válido.' USING ERRCODE = '22023';
    END IF;
    next_doc := coalesce(previous, '{"schema":1,"routes":[],"segments":[],"draft":[],"projects":[],"draftName":"Mi nueva ruta"}'::jsonb);
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
          OR jsonb_typeof(entry->'fields') IS DISTINCT FROM 'object'
          OR entry - ARRAY['id','fields'] <> '{}'::jsonb OR (entry->>'id') = ANY(seen)
          OR (entry->'fields' ? 'id' AND entry->'fields'->'id' IS DISTINCT FROM entry->'id') THEN
          RAISE EXCEPTION 'Registro de patch no válido.' USING ERRCODE = '22023';
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
  PERFORM tudagpx_validate_workspace(next_doc);
  FOREACH category IN ARRAY ARRAY['routes','segments','projects'] LOOP
    FOR original IN SELECT value FROM jsonb_array_elements(previous->category) LOOP
      SELECT value INTO candidate FROM jsonb_array_elements(next_doc->category) WHERE value->>'id' = original->>'id';
      IF category = 'routes' AND (candidate IS NULL OR candidate->'original' IS DISTINCT FROM original->'original'
        OR candidate->'originalBase64' IS DISTINCT FROM original->'originalBase64' OR candidate->'tracks' IS DISTINCT FROM original->'tracks') THEN
        RAISE EXCEPTION 'No se permite sustituir ni eliminar originales.' USING ERRCODE = '22023';
      ELSIF category = 'segments' AND (candidate IS NULL OR candidate->'points' IS DISTINCT FROM original->'points') THEN
        RAISE EXCEPTION 'Los segmentos originales no se pueden sobrescribir. Edita y guarda una copia.' USING ERRCODE = '22023';
      ELSIF category = 'projects' AND candidate IS DISTINCT FROM original THEN
        RAISE EXCEPTION 'Las versiones guardadas son inmutables.' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO tudagpx_workspace_versions(owner_id, version, payload) VALUES(p_owner, current_version + 1, next_doc);
  SELECT v.version INTO saved_version FROM tudagpx_workspace_versions v WHERE v.owner_id = p_owner AND v.version = current_version + 1;
  IF saved_version IS NULL THEN RAISE EXCEPTION 'Missing saved revision'; END IF;
  IF p_upload IS NOT NULL THEN
    DELETE FROM tudagpx_upload_parts WHERE owner_id = p_owner AND upload_id = p_upload;
  END IF;
  RETURN QUERY SELECT saved_version;
END $$;
COMMENT ON FUNCTION tudagpx_save_workspace(text,bigint,jsonb,boolean,text,integer) IS 'TudaGPX incremental sync protocol 2; atomic append-only save; payload/parts stay inside PostgreSQL';
COMMIT;
