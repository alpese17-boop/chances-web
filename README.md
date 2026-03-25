# ChancesYA v2 — Instalación en Hostinger
============================================

## Lo que hace este sistema
- Resultados reales de Colombia desde loteriasdehoy.co
- Se actualiza SOLO todos los días a las 6am, 2pm y 10pm
- Sin sistema de pagos — todo en efectivo
- Login para vendedores y admin

---

## PASO A PASO EN HOSTINGER

### 1. Sube los archivos
En Hostinger → File Manager → sube toda esta carpeta

### 2. Activa Node.js en Hostinger
- Panel de Hostinger → "Node.js"
- Node.js version: 18 o superior  
- Application root: /public_html/chancesya (o donde subiste)
- Application startup file: server.js
- Clic "Create" / "Enable"

### 3. Instala dependencias
En Hostinger → Terminal (o SSH):
```bash
cd ~/public_html/chancesya
npm install
```

### 4. Inicia la app
```bash
npm start
```
O en Hostinger el botón "Restart" del panel Node.js

### 5. Listo
Tu página estará en: https://tu-dominio.com

---

## CREDENCIALES (cambiar en public/index.html)
- admin / admin123
- vendedor1 / vend123
- vendedor2 / vend456

Busca el array USERS en el script y cambia las contraseñas.

---

## ACTUALIZACIÓN AUTOMÁTICA
El servidor hace scraping automático:
- 6:00 AM — resultados mañana
- 2:00 PM — resultados tarde  
- 10:00 PM — resultados noche

Sin intervención manual. Funciona 365 días al año.
