// ═══════════════════════════════════════════════════
//  ChancesYA v3 — Servidor completo
//  - Supabase para guardar ventas y usuarios
//  - Scraping automático loteriasdehoy.co
//  - Actualiza resultados 6am, 2pm, 10pm Colombia
// ═══════════════════════════════════════════════════

const express    = require('express');
const axios      = require('axios');
const cheerio    = require('cheerio');
const cron       = require('node-cron');
const cors       = require('cors');
const fs         = require('fs-extra');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase (pon tus credenciales aquí o en variables de entorno) ──
const SUPABASE_URL   = process.env.SUPABASE_URL   || 'PEGA_TU_SUPABASE_URL_AQUI';
const SUPABASE_KEY   = process.env.SUPABASE_KEY   || 'PEGA_TU_SUPABASE_KEY_AQUI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Caché local de resultados ──
let resultadosCache = [];
let ultimaActualizacion = null;

// ══════════════════════════════════════════
//  SCRAPING — loteriasdehoy.co
// ══════════════════════════════════════════
async function scrape() {
  console.log(`[${new Date().toLocaleString('es-CO')}] Scraping loteriasdehoy.co...`);
  try {
    const { data: html } = await axios.get('https://loteriasdehoy.co/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        'Accept-Language': 'es-CO,es;q=0.9'
      },
      timeout: 20000
    });

    const $ = cheerio.load(html);
    const resultados = [];

    $('h3').each((_, el) => {
      const h3     = $(el);
      const nombre = h3.find('a').text().trim() || h3.text().trim();
      if (!nombre || nombre.length < 3) return;

      let fecha = '';
      let prev  = h3.prev();
      for (let i = 0; i < 5; i++) {
        const t = prev.text().trim();
        if (/\d{4}/.test(t) && t.length < 30) { fecha = t; break; }
        prev = prev.prev();
      }

      const digitos = [];
      let sub = '';
      let cur = h3.next(), steps = 0;
      while (cur.length && steps < 30) {
        if ((cur.prop('tagName') || '') === 'H3') break;
        const t = cur.text().trim();
        if (/^\d$/.test(t)) digitos.push(t);
        else if (digitos.length >= 3 && t && t.length <= 15 && t !== nombre && !sub) sub = t;
        cur = cur.next(); steps++;
      }

      if (digitos.length >= 3) {
        const numero = digitos.slice(0, 4).join('');
        const low    = nombre.toLowerCase();
        const esLot  = ['bogot','medell','valle','risarald','santander','boyac',
                        'cundinam','tolima','meta','huila','quind','cauca','cruz roja']
                       .some(k => low.includes(k));
        resultados.push({
          nombre, numero, sub: sub || '',
          fecha: fecha || new Date().toLocaleDateString('es-CO'),
          tipo: esLot ? 'loteria' : 'chance'
        });
      }
    });

    if (resultados.length > 0) {
      resultadosCache = resultados;
      ultimaActualizacion = new Date().toISOString();
      console.log(`✅ ${resultados.length} resultados scrapeados.`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('❌ Error scraping:', e.message);
    return false;
  }
}

// ══════════════════════════════════════════
//  CRON — 6am, 2pm, 10pm hora Colombia
// ══════════════════════════════════════════
cron.schedule('0 6,14,22 * * *', () => scrape(), { timezone: 'America/Bogota' });

// ══════════════════════════════════════════
//  API — RESULTADOS
// ══════════════════════════════════════════
app.get('/api/resultados', async (req, res) => {
  // Si no hay caché o tiene más de 6h, actualizar
  if (!resultadosCache.length) await scrape();
  res.json({ resultados: resultadosCache, ultimaActualizacion, total: resultadosCache.length });
});

app.post('/api/resultados/actualizar', async (req, res) => {
  const ok = await scrape();
  res.json({ ok, total: resultadosCache.length, ultimaActualizacion });
});

// ══════════════════════════════════════════
//  API — AUTENTICACIÓN
// ══════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('login', usuario.trim())
    .eq('activo', true)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Usuario no encontrado' });
  if (data.password !== password) return res.status(401).json({ error: 'Contraseña incorrecta' });

  res.json({
    ok: true,
    usuario: { id: data.id, login: data.login, nombre: data.nombre, rol: data.rol }
  });
});

// ══════════════════════════════════════════
//  API — VENTAS
// ══════════════════════════════════════════

// Registrar una venta
app.post('/api/ventas', async (req, res) => {
  const { vendedor_id, vendedor_login, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin items' });

  const ref = 'CYA' + Date.now().toString().slice(-8);
  const registros = items.map(it => ({
    ref,
    numero:         it.numero,
    loteria:        it.loteria,
    monto:          it.monto,
    modo:           it.modo,
    comprador_nom:  it.comprador_nom,
    comprador_cel:  it.comprador_cel,
    vendedor_id:    vendedor_id,
    vendedor_login: vendedor_login,
    fecha:          new Date().toISOString()
  }));

  const { data, error } = await supabase.from('ventas').insert(registros).select();
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, ref, total: items.reduce((s,i) => s + i.monto, 0), ventas: data });
});

// Obtener ventas (vendedor ve las suyas, admin ve todas)
app.get('/api/ventas', async (req, res) => {
  const { vendedor_login, rol } = req.query;

  let query = supabase.from('ventas').select('*').order('fecha', { ascending: false });
  if (rol !== 'admin') query = query.eq('vendedor_login', vendedor_login);

  // Solo ventas del día actual
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  query = query.gte('fecha', hoy.toISOString());

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ventas: data || [] });
});

// ══════════════════════════════════════════
//  API — USUARIOS (solo admin)
// ══════════════════════════════════════════
app.get('/api/usuarios', async (req, res) => {
  const { data, error } = await supabase.from('usuarios').select('id,login,nombre,rol,activo').order('nombre');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ usuarios: data });
});

app.post('/api/usuarios', async (req, res) => {
  const { login, nombre, password, rol } = req.body;
  if (!login || !nombre || !password) return res.status(400).json({ error: 'Faltan campos' });
  const { data, error } = await supabase.from('usuarios').insert([{ login, nombre, password, rol: rol||'vendedor', activo: true }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, usuario: data[0] });
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { error } = await supabase.from('usuarios').update({ activo: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════════
//  API — CONFIG (solo admin)
// ══════════════════════════════════════════
app.get('/api/config', async (req, res) => {
  const { data } = await supabase.from('config').select('*').single();
  res.json(data || { monto_max: 20000, monto_min: 500, comision_pct: 5, pos4: [] });
});

app.put('/api/config', async (req, res) => {
  const cfg = req.body;
  const { data: existing } = await supabase.from('config').select('id').single();
  let result;
  if (existing) {
    result = await supabase.from('config').update(cfg).eq('id', existing.id).select();
  } else {
    result = await supabase.from('config').insert([cfg]).select();
  }
  res.json({ ok: !result.error });
});

// ══════════════════════════════════════════
//  STATUS
// ══════════════════════════════════════════
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', ultimaActualizacion, total: resultadosCache.length });
});

// ══════════════════════════════════════════
//  INICIO
// ══════════════════════════════════════════
async function start() {
  console.log('🎲 Iniciando ChancesYA v3...');
  await scrape(); // Cargar resultados al inicio
  app.listen(PORT, () => {
    console.log(`✅ Servidor en http://localhost:${PORT}`);
    console.log(`🔄 Resultados: automático 6am, 2pm, 10pm (Colombia)`);
  });
}

start();
