import { createHash } from 'node:crypto';

const HMX_VERSION = '1.7';
const MAX_SOURCE_EXPORT_BYTES = 8 * 1024 * 1024;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const asArray = value => Array.isArray(value) ? value.filter(isRecord) : [];
const textValue = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};
const safeSlug = value => {
  const slug = String(value ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug || createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 16);
};
const cloneJson = value => JSON.parse(JSON.stringify(value));
const objectOrEmpty = value => isRecord(value) ? cloneJson(value) : {};
const parseDate = value => {
  if (value === null || value === undefined || value === '') return null;
  const time = typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const nonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const canonicalRef = (exportId, kind, identity) => exportId + ':' + safeSlug(kind) + '-' + safeSlug(identity);
const rowIdentity = (row, index, fallback) =>
  textValue(row.id, row.ref, row.key, row.name, row.title, row.canonicalName, row.canonical_name) || (fallback + '-' + (index + 1));
const memoryContent = row =>
  textValue(row.content, row.text, row.summary, row.description, row.instructions, row.instruction, row.identityAssertion, row.identity_assertion, row.originStatement, row.origin_statement);

function indexNativeReferences(sections, exportId, warnings = []) {
  const index = new Map();
  const ownerByAlias = new Map();
  const ambiguous = new Set();

  // Never use last-write-wins for native aliases: the same short id/name can
  // legitimately occur in different sections or records. Once ambiguous, an
  // alias stays unresolved for this export, so edges cannot silently attach to
  // the wrong canonical memory.
  const addAlias = (value, ref, owner) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const normalized = value.trim();
    const suffix = normalized.includes(':')
      ? normalized.slice(normalized.lastIndexOf(':') + 1).trim()
      : normalized;

    for (const alias of new Set([normalized, suffix])) {
      if (!alias || ambiguous.has(alias)) continue;
      if (!index.has(alias)) {
        index.set(alias, ref);
        ownerByAlias.set(alias, owner);
        continue;
      }
      if (ownerByAlias.get(alias) !== owner) {
        index.delete(alias);
        ownerByAlias.delete(alias);
        ambiguous.add(alias);
      }
    }
  };

  for (const [sectionName, kind] of [['memories', 'memory'], ['skills', 'skill'], ['goals', 'goal']]) {
    for (const [i, row] of asArray(sections[sectionName]).entries()) {
      const id = rowIdentity(row, i, kind);
      const ref = canonicalRef(exportId, kind, id);
      const owner = sectionName + ':' + i;
      for (const key of ['id', 'ref', 'key', 'name', 'title']) addAlias(row[key], ref, owner);
    }
  }

  if (ambiguous.size > 0) {
    warnings.push('Detected ' + ambiguous.size +
      ' ambiguous native reference alias(es); affected references were left unresolved in the HMX export.');
  }
  return index;
}

function toHmxMemory(row, index, exportId, kind = 'memory') {
  const identity = rowIdentity(row, index, kind);
  const content = memoryContent(row) || JSON.stringify(row);
  const metadata = {
    ...objectOrEmpty(row.metadata),
    nk1NativeKind: kind,
    nk1NativeIdentity: identity,
    nk1NativeRecord: cloneJson(row),
  };
  const memory = {
    ref: canonicalRef(exportId, kind, identity),
    type: kind === 'skill' ? 'procedural' : (textValue(row.type, row.memory_type, row.memoryType, row.category) || 'semantic'),
    status: textValue(row.status) || 'active',
    content,
    metadata,
  };
  const createdAt = parseDate(row.created_at ?? row.createdAt ?? row.created);
  const updatedAt = parseDate(row.updated_at ?? row.updatedAt ?? row.modifiedAt);
  const validFrom = parseDate(row.valid_from ?? row.validFrom);
  const validUntil = parseDate(row.valid_until ?? row.validUntil ?? row.expiresAt);
  const lastAccessed = parseDate(row.last_accessed ?? row.lastAccessed);
  if (createdAt) memory.created_at = createdAt;
  if (updatedAt) memory.updated_at = updatedAt;
  if (validFrom !== null) memory.valid_from = validFrom;
  if (validUntil !== null) memory.valid_until = validUntil;
  const importance = finiteNumber(row.importance);
  const trust = finiteNumber(row.trust_level ?? row.trustLevel ?? row.trust);
  const decay = finiteNumber(row.decay_rate ?? row.decayRate);
  const accessCount = nonNegativeInteger(row.access_count ?? row.accessCount);
  if (importance !== undefined) memory.importance = importance;
  if (trust !== undefined) memory.trust_level = trust;
  if (decay !== undefined) memory.decay_rate = decay;
  if (accessCount !== undefined) memory.access_count = accessCount;
  if (lastAccessed) memory.last_accessed = lastAccessed;
  if (isRecord(row.source_attribution ?? row.sourceAttribution)) {
    memory.source_attribution = cloneJson(row.source_attribution ?? row.sourceAttribution);
  }
  return memory;
}

function toHmxIdentity(row, index) {
  const key = textValue(row.key, row.canonicalName, row.canonical_name, row.name, row.id) || ('identity-' + (index + 1));
  const content = textValue(row.content, row.identityAssertion, row.identity_assertion, row.originStatement, row.origin_statement, row.description);
  const traits = Array.isArray(row.facets) ? row.facets : Array.isArray(row.coreTraits) ? row.coreTraits : Array.isArray(row.core_traits) ? row.core_traits : [];
  const facets = traits.map(item => {
    if (isRecord(item)) {
      const concept = textValue(item.concept, item.name, item.label, item.trait);
      return concept ? { ...cloneJson(item), concept } : null;
    }
    const concept = textValue(item);
    return concept ? { concept, strength: 1 } : null;
  }).filter(Boolean);
  const metadata = {
    ...objectOrEmpty(row.metadata),
    nk1NativeIdentity: cloneJson(row),
    ...(Array.isArray(row.coreValues) ? { coreValues: cloneJson(row.coreValues) } : {}),
    ...(Array.isArray(row.core_values) ? { coreValues: cloneJson(row.core_values) } : {}),
  };
  return { key, content: content || JSON.stringify(row), ...(facets.length ? { facets } : {}), metadata };
}

function toHmxGoal(row, index, exportId, refIndex) {
  const identity = rowIdentity(row, index, 'goal');
  const result = {
    ref: canonicalRef(exportId, 'goal', identity),
    title: textValue(row.title, row.name, row.goal, row.content) || identity,
    metadata: { ...objectOrEmpty(row.metadata), nk1NativeGoal: cloneJson(row) },
  };
  const description = textValue(row.description, row.summary, row.details);
  if (description) result.description = description;
  const hasDue = row.due_at !== undefined || row.dueAt !== undefined || row.deadline !== undefined;
  const due = parseDate(row.due_at ?? row.dueAt ?? row.deadline);
  if (hasDue) result.due_at = due;
  const parent = textValue(row.parent_ref, row.parentRef, row.parentId, row.parent_id);
  result.parent_ref = parent ? (refIndex.get(parent) || canonicalRef(exportId, 'goal', parent)) : null;
  return result;
}

function toHmxRelationship(row, index, exportId, refIndex) {
  const source = textValue(row.source_ref, row.sourceRef, row.source, row.sourceId, row.source_id, row.from, row.fromId);
  const target = textValue(row.target_ref, row.targetRef, row.target, row.targetId, row.target_id, row.to, row.toId);
  const edgeType = textValue(row.edge_type, row.edgeType, row.type, row.relation, row.kind);
  if (!source || !target || !edgeType) return null;
  const asRef = value => refIndex.get(value) || canonicalRef(exportId, 'ref', value);
  return {
    source_ref: asRef(source),
    target_ref: asRef(target),
    edge_type: edgeType,
    properties: { ...objectOrEmpty(row.properties), nk1NativeRelationship: cloneJson(row), nk1NativeIndex: index },
  };
}

function objectSection(value, name, warnings) {
  if (isRecord(value)) return cloneJson(value);
  if (value === null || value === undefined) return {};
  warnings.push('sections.' + name + ' was not an HMX object; native value was retained under config.nk1NativeSections.');
  return { nk1NativeRecords: cloneJson(value) };
}

/**
 * Convert the NK1-native export to the upstream Hexis HMX 1.7 envelope.
 * This is a format adapter, not a claim that NK1 has imported Hexis SQL or vectors.
 */
export function normalizeNk1HmxExport(nativeDocument, options = {}) {
  if (!isRecord(nativeDocument)) throw new TypeError('NK1 HMX export must be a JSON object');
  let serialized;
  try {
    serialized = JSON.stringify(nativeDocument);
  } catch {
    throw new TypeError('NK1 HMX export must be JSON-serializable');
  }
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_SOURCE_EXPORT_BYTES) {
    throw new RangeError('NK1 native HMX source export exceeds ' + MAX_SOURCE_EXPORT_BYTES + ' bytes');
  }
  const root = JSON.parse(serialized);
  const hasMalformedRootSections = Object.hasOwn(root, 'sections') && !isRecord(root.sections);
  const nativeSections = isRecord(root.sections) ? root.sections : {};
  const nativeRootFields = new Set([
    'sections', 'hmx_version', 'hmxVersion', 'record_type', 'recordType', 'version',
    'source', 'meta', 'metadata', 'intent', 'strategy', 'created_at', 'createdAt',
    'source_subject_id', 'sourceSubjectId', 'subject_id', 'subjectId',
    'export_id', 'exportId', 'source_lineage_id', 'sourceLineageId', 'exported_at', 'exportedAt',
  ]);
  const extraRootFields = Object.fromEntries(
    Object.entries(root).filter(([key]) => !nativeRootFields.has(key)),
  );
  const exportId = 'exp_' + createHash('sha256').update(serialized).digest('hex').slice(0, 16);
  const warnings = [];
  const sourceSubjectId = textValue(root.source_subject_id, root.sourceSubjectId, root.subject_id, root.subjectId);
  const refIndex = indexNativeReferences(nativeSections, exportId, warnings);
  const rawMemories = asArray(nativeSections.memories);
  const rawSkills = asArray(nativeSections.skills);
  const rawGoals = asArray(nativeSections.goals);
  const rawIdentity = Array.isArray(nativeSections.identity) ? asArray(nativeSections.identity) : isRecord(nativeSections.identity) ? [nativeSections.identity] : [];
  const rawRelationships = asArray(nativeSections.relationships);
  const malformedNativeSections = {};
  if (hasMalformedRootSections) {
    malformedNativeSections.sections_invalid_root = cloneJson(root.sections);
  }
  for (const name of ['memories', 'skills', 'goals', 'identity', 'relationships', 'episodes']) {
    const nativeValue = nativeSections[name];
    if (Array.isArray(nativeValue)) {
      const invalidRows = nativeValue.filter(value => !isRecord(value));
      if (invalidRows.length) malformedNativeSections[name + '_non_object_rows'] = cloneJson(invalidRows);
    } else if (
      nativeValue !== undefined &&
      nativeValue !== null &&
      !(name === 'identity' && isRecord(nativeValue))
    ) {
      malformedNativeSections[name + '_invalid_section'] = cloneJson(nativeValue);
    }
  }
  // Preserve malformed native config outside the active config object. The HMX
  // envelope requires config to be an object, but dropping a legacy scalar/array
  // here would silently destroy source data during an otherwise successful export.
  if (
    nativeSections.config !== undefined &&
    nativeSections.config !== null &&
    !isRecord(nativeSections.config)
  ) {
    malformedNativeSections.config_invalid_section = cloneJson(nativeSections.config);
  }
  const invalidEpisodes = Array.isArray(nativeSections.episodes)
    ? nativeSections.episodes.filter(row => isRecord(row) &&
        !textValue(row.summary, row.content, row.description) &&
        !(Array.isArray(row.memory_refs) && row.memory_refs.length) &&
        !(Array.isArray(row.memoryRefs) && row.memoryRefs.length))
    : [];
  if (invalidEpisodes.length) malformedNativeSections.episodes_without_required_summary_or_refs = cloneJson(invalidEpisodes);
  const invalidRelationships = rawRelationships.filter(row =>
    !textValue(row.source_ref, row.sourceRef, row.source, row.sourceId, row.source_id, row.from, row.fromId) ||
    !textValue(row.target_ref, row.targetRef, row.target, row.targetId, row.target_id, row.to, row.toId) ||
    !textValue(row.edge_type, row.edgeType, row.type, row.relation, row.kind));
  if (invalidRelationships.length) malformedNativeSections.relationships_without_required_endpoints = cloneJson(invalidRelationships);

  if (rawSkills.length) warnings.push('NK1 native skills were mapped to HMX procedural memories; native skill fields remain in memory metadata.');
  warnings.push('No automatic redaction was applied; review this export before transferring it outside NK1.');
  if (!process.env.NK1_HMX_EMBEDDING_MODEL) {
    warnings.push('NK1 did not provide an embedding model/vector payload; embedding_model is marked text-only and imports must re-embed before vector retrieval.');
  }

  const sections = {
    memories: [
      ...rawMemories.map((row, index) => toHmxMemory(row, index, exportId, 'memory')),
      ...rawSkills.map((row, index) => toHmxMemory(row, index, exportId, 'skill')),
    ],
    episodes: asArray(nativeSections.episodes).flatMap((row, index) => {
      const identity = rowIdentity(row, index, 'episode');
      const ref = canonicalRef(exportId, 'episode', identity);
      const summary = textValue(row.summary, row.content, row.description);
      const memoryRefs = Array.isArray(row.memory_refs) ? row.memory_refs : Array.isArray(row.memoryRefs) ? row.memoryRefs : [];
      if (!summary && !memoryRefs.length) {
        warnings.push('Native episode ' + identity + ' has neither a summary nor memory_refs and was retained under config.nk1NativeSections.');
        return [];
      }
      const episode = {
        ref,
        ...(summary ? { summary } : {}),
        memory_refs: memoryRefs.map(value => refIndex.get(String(value)) || canonicalRef(exportId, 'memory', value)),
        metadata: { ...objectOrEmpty(row.metadata), nk1NativeEpisode: cloneJson(row) },
      };
      const startedAt = parseDate(row.started_at ?? row.startedAt ?? row.createdAt);
      const endedAt = parseDate(row.ended_at ?? row.endedAt);
      if (startedAt) episode.started_at = startedAt;
      if (row.ended_at === null || row.endedAt === null || endedAt) episode.ended_at = endedAt;
      return [episode];
    }),
    relationships: rawRelationships.map((row, index) => toHmxRelationship(row, index, exportId, refIndex)).filter(Boolean),
    identity: rawIdentity.map(toHmxIdentity),
    goals: rawGoals.map((row, index) => toHmxGoal(row, index, exportId, refIndex)),
    in_flight_work: objectSection(nativeSections.in_flight_work ?? nativeSections.inFlightWork, 'in_flight_work', warnings),
    audit_records: objectSection(nativeSections.audit_records ?? nativeSections.auditRecords, 'audit_records', warnings),
    config: objectOrEmpty(nativeSections.config),
  };

  if (isRecord(nativeSections.narrative)) sections.narrative = cloneJson(nativeSections.narrative);
  else if (nativeSections.narrative !== undefined && nativeSections.narrative !== null) {
    warnings.push('Native narrative was not an object; it was preserved under config.nk1NativeSections.');
  }
  const handled = new Set(['memories','skills','goals','identity','relationships','episodes','in_flight_work','inFlightWork','audit_records','auditRecords','config','narrative']);
  const unsupportedNativeSections = { ...malformedNativeSections };
  for (const [name, value] of Object.entries(nativeSections)) {
    if (!handled.has(name)) unsupportedNativeSections[name] = cloneJson(value);
  }
  if (nativeSections.narrative !== undefined && nativeSections.narrative !== null && !isRecord(nativeSections.narrative)) {
    unsupportedNativeSections.narrative = cloneJson(nativeSections.narrative);
  }
  if (Object.keys(unsupportedNativeSections).length) {
    sections.config.nk1NativeSections = { ...objectOrEmpty(sections.config.nk1NativeSections), ...unsupportedNativeSections };
    warnings.push('Preserved native-only sections in config.nk1NativeSections: ' + Object.keys(unsupportedNativeSections).join(', ') + '.');
  }
  sections.config.nk1NativeExport = {
    sourceSchema: 'NK1-native',
    sourceNativeExportId: textValue(root.export_id, root.exportId) || null,
    sourceSubjectId: sourceSubjectId || null,
    adapterVersion: '1.0.0',
    vectorPayloadPresent: false,
    ...(Object.keys(extraRootFields).length ? { extraRootFields: cloneJson(extraRootFields) } : {}),
  };
  if (Object.keys(extraRootFields).length) {
    warnings.push(
      'Preserved unconsumed native root fields in sections.config.nk1NativeExport.extraRootFields: ' +
      Object.keys(extraRootFields).join(', ') + '.',
    );
  }

  const configuredDimension = Number(process.env.NK1_HMX_EMBEDDING_DIMENSION);
  const embeddingDimension = Number.isSafeInteger(configuredDimension) && configuredDimension > 0 ? configuredDimension : 1;
  const source = {
    instance_id: textValue(process.env.NK1_INSTANCE_ID) || 'nk1-neuro-kurisu',
    schema_version: textValue(process.env.NK1_HMX_SCHEMA_VERSION) || 'nk1-native-v1',
    embedding_model: textValue(process.env.NK1_HMX_EMBEDDING_MODEL) || 'nk1-text-only-no-vectors',
    embedding_dimension: embeddingDimension,
    hexis_lineage_id: textValue(root.source_lineage_id, root.sourceLineageId) || ('nk1:' + safeSlug(sourceSubjectId || 'default-subject')),
  };
  const exportedAt = parseDate(root.exported_at ?? root.exportedAt) || new Date().toISOString();
  const intent = ['port', 'duplicate', 'telepathy', 'analysis'].includes(options.intent) ? options.intent : 'port';
  const taskCount = value => isRecord(value)
    ? (Array.isArray(value.consolidation_tasks) ? value.consolidation_tasks.length : 0) +
      (Array.isArray(value.reconsolidation_tasks) ? value.reconsolidation_tasks.length : 0)
    : 0;
  const auditCount = value => isRecord(value)
    ? Object.values(value).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
    : 0;
  const narrative = isRecord(sections.narrative) ? sections.narrative : {};
  const narrativeNodes = ['life_chapters', 'turning_points', 'narrative_threads', 'value_conflicts']
    .reduce((sum, key) => sum + (Array.isArray(narrative[key]) ? narrative[key].length : 0), 0);
  const edgeTypes = [...new Set(sections.relationships.map(row => row.edge_type))];
  const sectionNames = Object.keys(sections);
  const normalized = {
    hmx_version: HMX_VERSION,
    export_id: exportId,
    export_intent: intent,
    exported_at: exportedAt,
    source,
    capabilities: {
      formats: ['json'],
      sections: sectionNames,
      hash_algorithms: ['sha256'],
      relationship_edge_types: edgeTypes,
      optional_features: ['nk1-native-metadata', 'text-only-no-vectors'],
      embedding_model: source.embedding_model,
      embedding_dimension: source.embedding_dimension,
    },
    privacy: {
      redaction_policy: 'none',
      contains_sensitive_content: true,
      consent_scope: 'migration',
      excluded_secret_patterns: [],
      includes_raw_turns: false,
    },
    export_scope: {
      filter: 'nk1-native-runtime',
      include_protected: ['identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals'],
      include_raw_units: false,
      include_config: true,
      include_in_flight_work: true,
      include_audit_records: true,
    },
    sections,
    export_warnings: [...new Set(warnings)],
    statistics: {
      total_memories: sections.memories.length,
      total_episodes: sections.episodes.length,
      total_relationships: sections.relationships.length,
      total_raw_units: Array.isArray(sections.raw_units) ? sections.raw_units.length : 0,
      total_narrative_nodes: narrativeNodes,
      total_in_flight_tasks: taskCount(sections.in_flight_work),
      total_audit_records: auditCount(sections.audit_records),
      total_conflicts_predicted: 0,
      estimated_embedding_items: 0,
      estimated_embedding_tokens: 0,
      estimated_embedding_cost_units: null,
      estimated_uncompressed_bytes: Buffer.byteLength(serialized, 'utf8'),
      nativeSkillRecordsMapped: rawSkills.length,
    },
  };
  const normalizedBytes = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (normalizedBytes > MAX_SOURCE_EXPORT_BYTES) {
    throw new RangeError('NK1 normalized HMX export exceeds the ' + MAX_SOURCE_EXPORT_BYTES + '-byte import staging limit');
  }
  return normalized;
}
