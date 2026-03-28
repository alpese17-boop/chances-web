-- ═══════════════════════════════════════════
--  ChancesYA — Tablas en Supabase
--  Copia TODO esto y pégalo en Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Tabla de usuarios/vendedores
CREATE TABLE IF NOT EXISTS usuarios (
  id         BIGSERIAL PRIMARY KEY,
  login      TEXT UNIQUE NOT NULL,
  nombre     TEXT NOT NULL,
  password   TEXT NOT NULL,
  rol        TEXT DEFAULT 'vendedor',
  activo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS ventas (
  id             BIGSERIAL PRIMARY KEY,
  ref            TEXT NOT NULL,
  numero         TEXT NOT NULL,
  loteria        TEXT NOT NULL,
  monto          INTEGER NOT NULL,
  modo           INTEGER DEFAULT 4,
  comprador_nom  TEXT,
  comprador_cel  TEXT,
  vendedor_id    BIGINT,
  vendedor_login TEXT,
  fecha          TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS config (
  id          BIGSERIAL PRIMARY KEY,
  monto_max   INTEGER DEFAULT 20000,
  monto_min   INTEGER DEFAULT 500,
  comision_pct INTEGER DEFAULT 5,
  pos4        JSONB DEFAULT '[]'
);

-- ── Usuarios iniciales ──
-- (Cambia las contraseñas antes de usar en producción)
INSERT INTO usuarios (login, nombre, password, rol) VALUES
  ('admin',     'Administrador', 'admin123',  'admin'),
  ('vendedor1', 'Carlos Pérez',  'vend123',   'vendedor'),
  ('vendedor2', 'Laura Gómez',   'vend456',   'vendedor')
ON CONFLICT (login) DO NOTHING;

-- Configuración inicial
INSERT INTO config (monto_max, monto_min, comision_pct, pos4)
VALUES (20000, 500, 5, '[]');

-- ── Políticas de seguridad (RLS) ──
-- Desactiva RLS para que el servidor pueda leer/escribir
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventas   DISABLE ROW LEVEL SECURITY;
ALTER TABLE config   DISABLE ROW LEVEL SECURITY;
