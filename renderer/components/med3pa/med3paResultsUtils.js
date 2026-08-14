/**
 * Utilities to read the MED3pa session result structures stored in MongoDB
 * (metrics_by_dr, profiles, lost_profiles, tree) as produced by
 * pythonCode/modules/med3pa/run_med3pa_analysis.py.
 *
 * Note: all dict keys coming from python are strings (BSON restriction),
 * including declaration rates and samples ratios.
 */

/**
 * @description Union of metric names found in metrics_by_dr entries
 */
export function getMetricNames(metricsByDr) {
  const names = new Set()
  Object.values(metricsByDr || {}).forEach((entry) => {
    Object.keys(entry?.metrics || {}).forEach((m) => names.add(m))
  })
  return Array.from(names)
}

/**
 * @description Curve of one metric across declaration rates
 * @returns {Array} [[dr, value], ...] sorted by dr ascending, null values skipped
 */
export function getCurve(metricsByDr, metric) {
  const points = []
  Object.entries(metricsByDr || {}).forEach(([dr, entry]) => {
    const value = entry?.metrics?.[metric]
    if (value !== null && value !== undefined) points.push([parseInt(dr), value])
  })
  points.sort((a, b) => a[0] - b[0])
  return points
}

/**
 * @description Population kept at a DR under a strictly-greater-than rule.
 *
 * MED3pa keeps everyone at or above the threshold (`confidence >= t`), so a group
 * of patients sharing one confidence value is admitted all at once. That makes the
 * reported population jump — DR 7 and DR 27 can both report 27.2% because no
 * threshold in between separates that tied group.
 *
 * This returns the population from the last operating point *before* the tied
 * group was admitted, i.e. what `confidence > t` would keep.
 *
 * Note: the metrics shown alongside this figure are still computed on the
 * at-or-above population, so the two describe different sets of patients.
 *
 * @param {Object} metricsByDr session.metrics_by_dr
 * @param {Number} dr the declaration rate being displayed
 * @returns {Number|null} population fraction (0-1), or null when there is no
 *   lower operating point (the threshold is already the lowest)
 */
export function getLowerEndPopulation(metricsByDr, dr) {
  const entry = metricsByDr?.[String(dr)]
  if (!entry || entry.min_confidence_level === null || entry.min_confidence_level === undefined) return null

  const lowerKeys = Object.keys(metricsByDr)
    .map(Number)
    .filter((k) => k < dr)
    .sort((a, b) => b - a)

  for (const key of lowerKeys) {
    const candidate = metricsByDr[String(key)]
    // The first entry with a strictly higher threshold is the operating point
    // immediately below this one; everything between shares this threshold.
    if (candidate && candidate.min_confidence_level > entry.min_confidence_level) {
      return candidate.population_percentage ?? null
    }
  }
  return null
}

/**
 * @description Entry of metrics_by_dr at a given DR (nearest key fallback)
 */
export function getMetricsEntryAt(metricsByDr, dr) {
  if (!metricsByDr) return null
  if (metricsByDr[String(dr)]) return metricsByDr[String(dr)]
  const keys = Object.keys(metricsByDr).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) return null
  let best = keys[0]
  keys.forEach((k) => {
    if (Math.abs(k - dr) < Math.abs(best - dr)) best = k
  })
  return metricsByDr[String(best)]
}

/**
 * @description Find the DR that maximizes a metric and its improvement vs full declaration (DR=100)
 * @returns {Object|null} {dr, value, baseline, improvement}
 */
export function bestDrForMetric(metricsByDr, metric) {
  const curve = getCurve(metricsByDr, metric)
  if (curve.length === 0) return null
  const baselinePoint = curve[curve.length - 1] // highest dr available (full population)
  let best = curve[0]
  curve.forEach(([dr, v]) => {
    if (v > best[1] || (v === best[1] && dr > best[0])) best = [dr, v]
  })
  return { dr: best[0], value: best[1], baseline: baselinePoint[1], improvement: best[1] - baselinePoint[1] }
}

/**
 * @description Samples ratios available in the profiles record
 */
export function getSamplesRatios(profiles) {
  return Object.keys(profiles || {}).sort((a, b) => Number(a) - Number(b))
}

/**
 * @description Profiles list at a given samples ratio and DR, with nearest-DR-key fallback
 * @returns {Array} profile dicts [{id, path, metrics, "node information"}]
 */
export function getProfilesAt(profiles, ratio, dr) {
  const byDr = profiles?.[String(ratio)]
  if (!byDr) return []
  if (byDr[String(dr)]) return byDr[String(dr)]
  const keys = Object.keys(byDr).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) return []
  // take the closest computed DR
  let best = keys[0]
  keys.forEach((k) => {
    if (Math.abs(k - dr) < Math.abs(best - dr)) best = k
  })
  return byDr[String(best)] || []
}

/**
 * @description Set of node ids lost (dropped out) at a given samples ratio and DR
 */
export function getLostProfileIds(lostProfiles, ratio, dr) {
  const lost = getProfilesAt(lostProfiles, ratio, dr)
  return new Set(lost.map((p) => p.id))
}

/**
 * @description The declaration rate at which each profile drops out, for a given samples ratio.
 *
 * A profile is listed in lost_profiles for every DR at or below the point it
 * stops surviving, so the highest DR at which it appears there is the moment it
 * greys out in the tree. Profiles sharing a DR are grouped into one point.
 *
 * Profiles lost at *every* DR are skipped: their branch matches no patient in the
 * evaluation split, so they were never present and never disappeared.
 *
 * @param {Object} lostProfiles session.lost_profiles
 * @param {String|Number} ratio the selected samples ratio
 * @returns {Array} [{dr, profiles: [{id, label}]}] sorted by dr
 */
export function getProfileDisappearances(lostProfiles, ratio) {
  const byDr = lostProfiles?.[String(ratio)]
  if (!byDr) return []
  const drs = Object.keys(byDr)
    .map(Number)
    .sort((a, b) => a - b)
  if (drs.length === 0) return []

  const lostAt = {}
  drs.forEach((dr) => {
    const atThisDr = byDr[String(dr)] || []
    atThisDr.forEach((profile) => {
      if (!lostAt[profile.id]) lostAt[profile.id] = { drs: [], path: profile.path || [] }
      lostAt[profile.id].drs.push(dr)
    })
  })

  const byPoint = {}
  Object.keys(lostAt).forEach((id) => {
    const entry = lostAt[id]
    if (entry.drs.length === drs.length) return // never present
    const dr = Math.max(...entry.drs)
    const label = entry.path.filter((c) => c !== "*").join(" & ") || "All population"
    if (!byPoint[dr]) byPoint[dr] = []
    byPoint[dr].push({ id: Number(id), label: label })
  })

  return Object.keys(byPoint)
    .map((dr) => ({ dr: Number(dr), profiles: byPoint[dr].sort((a, b) => a.id - b.id) }))
    .sort((a, b) => a.dr - b.dr)
}

/**
 * @description Map node_id -> profile dict for quick lookup
 */
export function profilesById(profilesList) {
  const map = {}
  ;(profilesList || []).forEach((p) => {
    map[p.id] = p
  })
  return map
}

/**
 * @description Flatten the nested tree dict (c_left/c_right) into positioned nodes and edges
 * for SVG rendering. x in [0,100], y in [0,100].
 * @returns {Object} {nodes: [{id, feature, threshold, rule, path, depth, x, y, isLeaf}], edges: [{x1,y1,x2,y2,childId}], depth}
 */
export function layoutTree(tree) {
  if (!tree) return { nodes: [], edges: [], depth: 0 }
  const nodes = []
  const edges = []
  let leafCount = 0
  let maxDepth = 0

  function walk(node, depth) {
    maxDepth = Math.max(maxDepth, depth)
    const isLeaf = !node.c_left && !node.c_right
    const current = {
      id: node.node_id,
      feature: node.feature ?? null,
      threshold: node.threshold ?? null,
      path: node.path || [],
      rule: node.path && node.path.length > 1 ? node.path[node.path.length - 1] : "All population",
      depth: depth,
      isLeaf: isLeaf,
      x: 0,
      y: 0
    }
    if (isLeaf) {
      current.x = leafCount++
      nodes.push(current)
      return current
    }
    const children = []
    if (node.c_left) children.push(walk(node.c_left, depth + 1))
    if (node.c_right) children.push(walk(node.c_right, depth + 1))
    current.x = children.reduce((acc, c) => acc + c.x, 0) / children.length
    nodes.push(current)
    children.forEach((c) => edges.push({ parentId: current.id, childId: c.id }))
    return current
  }

  walk(tree, 0)

  // normalize coordinates to percentages
  const xDiv = Math.max(leafCount - 1, 1)
  const yDiv = Math.max(maxDepth, 1)
  nodes.forEach((n) => {
    n.x = leafCount === 1 ? 50 : 8 + (n.x / xDiv) * 84
    n.y = 8 + (n.depth / yDiv) * 80
  })
  const byId = {}
  nodes.forEach((n) => {
    byId[n.id] = n
  })
  const positionedEdges = edges.map((e) => ({
    x1: byId[e.parentId].x,
    y1: byId[e.parentId].y,
    x2: byId[e.childId].x,
    y2: byId[e.childId].y,
    childId: e.childId
  }))
  return { nodes, edges: positionedEdges, depth: maxDepth }
}

/**
 * @description Ids of the nodes on the path from the root to the node whose path matches the
 * given profile path (used to highlight a patient's profile chain)
 */
export function nodeIdsOnPath(nodes, profilePath) {
  if (!profilePath) return new Set()
  const target = profilePath.filter((p) => p !== "*")
  const ids = new Set()
  nodes.forEach((n) => {
    const nPath = (n.path || []).filter((p) => p !== "*")
    // node is on the path if its own path is a prefix of the target path
    if (nPath.length <= target.length && nPath.every((step, i) => step === target[i])) {
      ids.add(n.id)
    }
  })
  return ids
}

/**
 * @description Color scale helpers. value expected in [0, 1].
 * "confidence" = red->yellow->green, "performance" = light->dark blue
 */
export function metricColor(value, scheme = "confidence") {
  const v = Math.max(0, Math.min(1, value ?? 0))
  if (scheme === "performance") {
    const light = [222, 235, 247]
    const dark = [8, 81, 156]
    const c = light.map((l, i) => Math.round(l + (dark[i] - l) * v))
    return `rgb(${c[0]},${c[1]},${c[2]})`
  }
  // red (#d73027) -> yellow (#fee08b) -> green (#1a9850)
  const stops = [
    [215, 48, 39],
    [254, 224, 139],
    [26, 152, 80]
  ]
  const t = v * 2
  const [a, b] = t <= 1 ? [stops[0], stops[1]] : [stops[1], stops[2]]
  const f = t <= 1 ? t : t - 1
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/**
 * @description Readable text color (dark/light) on top of an rgb() background
 */
export function textColorOn(rgbString) {
  const m = rgbString.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (!m) return "#212529"
  const lum = 0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])
  return lum > 150 ? "#212529" : "#FFFFFF"
}

export const METRIC_CURVE_COLORS = {
  Auc: "#378ADD",
  AUC: "#378ADD",
  Accuracy: "#6A3FA0",
  Recall: "#1D9E75",
  Sensitivity: "#1D9E75",
  Specificity: "#BA7517",
  BalancedAccuracy: "#0F6E56",
  Precision: "#8E5BB5",
  PPV: "#8E5BB5",
  NPV: "#D85A30",
  F1Score: "#C2185B",
  MCC: "#5D4037"
}

const FALLBACK_COLORS = ["#378ADD", "#1D9E75", "#BA7517", "#D85A30", "#8E5BB5", "#C2185B", "#5D4037", "#0F6E56", "#6A3FA0"]

export function curveColor(metric, index) {
  return METRIC_CURVE_COLORS[metric] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}
