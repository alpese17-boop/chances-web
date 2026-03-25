// ═══════════════════════════════════════════════════
//  ChancesYA v2 — Servidor
//  Scraping automático loteriasdehoy.co
//  Actualiza solo: 6am, 2pm, 10pm hora Colombia
// ═══════════════════════════════════════════════════

const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');
const cron    = require('node-cron');
const cors    = require('cors');
const fs      = require('fs-extra');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'resultados.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Crear archivo de datos si no existe ──
async function ensureData() {
  await fs.ensureDir(path.join(__dirname, 'data'));
  if (!await fs.pathExists(DATA_FILE)) {
    await fs.writeJson(DATA_FILE, { resultados:[], ultimaActualizacion:null });
  }
}

// ══════════════════════════════════════════
//  SCRAPING — loteriasdehoy.co
// ══════════════════════════════════════════
async function scrape() {
  console.log(`[${new Date().toLocaleString('es-CO')}] Scraping loteriasdehoy.co...`);
  try {
    const { data: html } = await axios.get('https://loteriasdehoy.co/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'es-CO,es;q=0.9'
      },
      timeout: 20000
    });

    const $  = cheerio.load(html);
    const resultados = [];

    $('h3').each((_, el) => {
      const h3     = $(el);
      const nombre = h3.find('a').text().trim() || h3.text().trim();
      if (!nombre || nombre.length < 3) return;

      // Fecha
      let fecha = '';
      let prev  = h3.prev();
      for (let i = 0; i < 5; i++) {
        const t = prev.text().trim();
        if (/\d{4}/.test(t) && t.length < 30) { fecha = t; break; }
        prev = prev.prev();
      }

      // Dígitos
      const digitos = [];
      let sub = '';
      let cur = h3.next();
      let steps = 0;
      while (cur.length && steps < 30) {
        if ((cur.prop('tagName')||'') === 'H3') break;
        const t = cur.text().trim();
        if (/^\d$/.test(t)) digitos.push(t);
        else if (digitos.length >= 3 && t && t.length <= 15 && t !== nombre && !sub) sub = t;
        cur = cur.next();
        steps++;
      }

      if (digitos.length >= 3) {
        const numero  = digitos.slice(0, 4).join('');
        const low     = nombre.toLowerCase();
        const esLot   = ['bogot','medell','valle','risarald','santander','boyac',
                         'cundinam','tolima','meta','huila','quind','cauca',
                         'cruz roja','extra','nariño'].some(k => low.includes(k));
        resultados.push({ nombre, numero, sub: sub||'', fecha: fecha||'Hoy', tipo: esLot?'loteria':'chance' });
      }
    });

    if (resultados.length === 0) { console.warn('⚠️  Sin resultados parseados'); return false; }

    await fs.writeJson(DATA_FILE, {
      resultados,
      ultimaActualizacion: new Date().toISOString(),
      total: resultados.length
    }, { spaces: 2 });

    console.log(`✅ ${resultados.length} resultados guardados.`);
    return true;
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
//  API
// ══════════════════════════════════════════
app.get('/api/resultados', async (req, res) => {
  try {
    await ensureData();
    const data = await fs.readJson(DATA_FILE);
    // Si datos tienen más de 6h, actualizar en background
    if (data.ultimaActualizacion) {
      const horas = (Date.now() - new Date(data.ultimaActualizacion).getTime()) / 3600000;
      if (horas > 6) scrape();
    } else {
      await scrape();
      return res.json(await fs.readJson(DATA_FILE));
    }
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/actualizar', async (req, res) => {
  const ok = await scrape();
  const data = await fs.readJson(DATA_FILE).catch(() => ({}));
  res.json({ ok, total: data.total||0, ultimaActualizacion: data.ultimaActualizacion });
});

app.get('/api/status', async (req, res) => {
  await ensureData();
  const data = await fs.readJson(DATA_FILE).catch(() => ({}));
  res.json({ status:'online', ultimaActualizacion: data.ultimaActualizacion||'Nunca', total: data.total||0 });
});

// ══════════════════════════════════════════
//  INICIO
// ══════════════════════════════════════════
async function start() {
  await ensureData();
  const data = await fs.readJson(DATA_FILE).catch(() => ({}));
  if (!data.resultados || data.resultados.length === 0) {
    console.log('📥 Primera vez — descargando resultados...');
    await scrape();
  } else {
    const horas = (Date.now() - new Date(data.ultimaActualizacion).getTime()) / 3600000;
    if (horas > 6) { console.log(`⏳ Datos de ${horas.toFixed(0)}h — actualizando...`); scrape(); }
    else console.log(`✅ Datos recientes (${horas.toFixed(1)}h) — usando caché.`);
  }
  app.listen(PORT, () => {
    console.log(`\n🎲 ChancesYA en http://localhost:${PORT}`);
    console.log(`🔄 Auto-actualización: 6am, 2pm, 10pm (Colombia)\n`);
  });
}

start();
