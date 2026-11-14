// Lunatika PSI Data API — Cloudflare Worker + D1
// Data: NASA PSI investigation database (synced from local PostgreSQL)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const q = url.searchParams;

    try {
      // ---- health / status ----
      if (path === '/' || path === '/status') {
        const tables = {};
        for (const t of ['investigations', 'investigation_files', 'materials',
                         'investigation_materials', 'investigation_topics', 'investigation_topic_links']) {
          const r = await env.PSIDATA.prepare(`SELECT count(*) c FROM ${t}`).first();
          tables[t] = r?.c ?? 0;
        }
        return json({ ok: true, service: 'lunatika-psi-data', tables });
      }

      // ---- all investigations ----
      if (path === '/investigations') {
        const limit = Math.min(parseInt(q.get('limit') || '100'), 500);
        const offset = parseInt(q.get('offset') || '0');
        const rows = await env.PSIDATA
          .prepare('SELECT * FROM investigations ORDER BY id LIMIT ?1 OFFSET ?2')
          .bind(limit, offset).all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }

      // ---- one investigation: /investigations/PSI-69 ----
      const invMatch = path.match(/^\/investigations\/(PSI-\d+)$/i);
      if (invMatch) {
        const id = invMatch[1].toUpperCase();
        const inv = await env.PSIDATA.prepare('SELECT * FROM investigations WHERE id = ?1')
          .bind(id).first();
        if (!inv) return err(`investigation ${id} not found`, 404);
        const files = await env.PSIDATA
          .prepare('SELECT path, type, size, depth FROM investigation_files WHERE investigation_id = ?1 ORDER BY path')
          .bind(id).all();
        const mats = await env.PSIDATA
          .prepare(`SELECT im.*, m.canonical_name, m.category, m.phase, m.is_fuel
                    FROM investigation_materials im
                    JOIN materials m ON m.id = im.material_id
                    WHERE im.investigation_id = ?1
                    ORDER BY im.is_primary DESC, im.evidence_quality DESC`)
          .bind(id).all();
        const topics = await env.PSIDATA
          .prepare(`SELECT t.id, t.name, t.description, l.relevance
                    FROM investigation_topic_links l
                    JOIN investigation_topics t ON t.id = l.topic_id
                    WHERE l.investigation_id = ?1`)
          .bind(id).all();
        return json({ ok: true, investigation: inv,
                      material_count: mats.results.length, materials: mats.results,
                      topic_count: topics.results.length, topics: topics.results,
                      file_count: files.results.length, files: files.results });
      }

      // ---- search files: /files?investigation=PSI-69&q=heptane&limit=100 ----
      if (path === '/files') {
        const limit = Math.min(parseInt(q.get('limit') || '200'), 2000);
        const offset = parseInt(q.get('offset') || '0');
        const inv = q.get('investigation');
        const search = q.get('q');
        let sql = 'SELECT investigation_id, path, type, size, depth FROM investigation_files WHERE 1=1';
        const binds = [];
        if (inv) { sql += ' AND investigation_id = ?1'; binds.push(inv.toUpperCase()); }
        if (search) { sql += ' AND lower(path) LIKE ?2'; binds.push(`%${search.toLowerCase()}%`); }
        sql += ` ORDER BY investigation_id, path LIMIT ${binds.length ? '?' + (binds.length + 1) : '?1'} OFFSET ${binds.length + 1 ? '?' + (binds.length + 2) : '?2'}`;
        binds.push(limit, offset);
        const rows = await env.PSIDATA.prepare(sql).bind(...binds).all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }

      // ---- materials: /materials and /materials/:id ----
      if (path === '/materials') {
        const rows = await env.PSIDATA
          .prepare(`SELECT m.*, count(im.investigation_id) AS investigation_count
                    FROM materials m
                    LEFT JOIN investigation_materials im ON im.material_id = m.id
                    GROUP BY m.id ORDER BY m.id`)
          .all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }
      const matMatch = path.match(/^\/materials\/([a-z_]+)$/i);
      if (matMatch) {
        const id = matMatch[1].toLowerCase();
        const mat = await env.PSIDATA.prepare('SELECT * FROM materials WHERE id = ?1').bind(id).first();
        if (!mat) return err(`material ${id} not found`, 404);
        const rows = await env.PSIDATA
          .prepare(`SELECT im.investigation_id, im.role, im.confidence, im.is_primary,
                           im.evidence_quality, im.data_completeness, im.evidence_files, im.evidence_quote
                    FROM investigation_materials im
                    WHERE im.material_id = ?1
                    ORDER BY im.is_primary DESC, im.evidence_quality DESC`)
          .bind(id).all();
        return json({ ok: true, material: mat, investigations: rows.results });
      }

      // ---- fuel materials only: /fuels ----
      if (path === '/fuels') {
        const rows = await env.PSIDATA
          .prepare(`SELECT im.investigation_id, m.canonical_name, im.role, im.confidence, im.is_primary
                    FROM investigation_materials im
                    JOIN materials m ON m.id = im.material_id
                    WHERE m.is_fuel = 1 OR im.role = 'fuel'
                    ORDER BY im.investigation_id, m.canonical_name`)
          .all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }

      // ---- topics: /topics ----
      if (path === '/topics') {
        const rows = await env.PSIDATA
          .prepare(`SELECT t.id, t.name, t.description, t.keywords,
                           group_concat(l.investigation_id, ',') AS investigations
                    FROM investigation_topics t
                    LEFT JOIN investigation_topic_links l ON l.topic_id = t.id
                    GROUP BY t.id ORDER BY t.id`)
          .all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }

      // ---- raw SQL (GET only, SELECT) ----
      if (path === '/query') {
        const sql = q.get('sql');
        if (!sql) return err('missing ?sql= parameter');
        if (!/^\s*(select|with)\b/i.test(sql)) return err('only SELECT queries allowed');
        const rows = await env.PSIDATA.prepare(sql).all();
        return json({ ok: true, count: rows.results.length, data: rows.results });
      }

      return err(`unknown route: ${path}. Available: /status, /investigations, /investigations/:id, /files?investigation=&q=, /materials, /materials/:id, /fuels, /topics, /query?sql=`, 404);
    } catch (e) {
      return err(e.message, 500);
    }
  },
};
