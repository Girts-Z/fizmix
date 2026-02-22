/**
 * Cloudflare Pages Function: fit y = b/x² + a, compute R², apply -log(1-R²).
 * Returns only the transformed value; no R² or formula exposed.
 */

function fit(x, y) {
  const n = x.length;
  const u = x.map((xi) => 1 / (xi * xi));
  let sumU = 0, sumU2 = 0, sumY = 0, sumUY = 0;
  for (let i = 0; i < n; i++) {
    sumU += u[i];
    sumU2 += u[i] * u[i];
    sumY += y[i];
    sumUY += u[i] * y[i];
  }
  const det = n * sumU2 - sumU * sumU;
  if (Math.abs(det) < 1e-20) return null;
  const a = (sumY * sumU2 - sumU * sumUY) / det;
  const b = (n * sumUY - sumU * sumY) / det;
  const yPred = x.map((xi) => b / (xi * xi) + a);
  let ssRes = 0, ssTot = 0;
  const yMean = sumY / n;
  for (let i = 0; i < n; i++) {
    ssRes += (y[i] - yPred[i]) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return r2;
}

function transform(r2) {
  return -Math.log(Math.max(1e-10, 1 - Math.max(0, Math.min(0.9999, r2))));
}

export async function onRequestPost(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Nederīga JSON struktūra' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { rows } = body || {};
  if (!Array.isArray(rows)) {
    return new Response(JSON.stringify({ error: 'Trūkst datu rindu' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const x = [];
  const y = [];
  for (const row of rows) {
    const xi = parseFloat(row[0]), yi = parseFloat(row[1]);
    if (!isNaN(xi) && !isNaN(yi) && xi > 0) {
      x.push(xi);
      y.push(yi);
    }
  }

  if (x.length < 2) {
    return new Response(JSON.stringify({ error: 'Vajag vismaz 2 derīgus punktus' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const r2 = fit(x, y);
  if (r2 === null) {
    return new Response(JSON.stringify({ error: 'Pielāgošana neizdevās' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let mainResult;
  try {
    mainResult = transform(r2);
  } catch {
    return new Response(JSON.stringify({ error: 'Transformācija neizdevās' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const value = typeof mainResult === 'number' && isFinite(mainResult)
    ? Number(mainResult.toFixed(6))
    : mainResult;

  return new Response(JSON.stringify({ mainResult: value }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
