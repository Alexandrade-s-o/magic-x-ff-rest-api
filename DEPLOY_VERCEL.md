# Despliegue en Vercel

El repositorio se despliega como **dos proyectos de Vercel** desde el mismo repo.

## 1. Backend (NestJS) — Root Directory: `/` (raíz)

La configuración está en `vercel.json`: `nest build` compila a `dist/` y la
función `api/index.js` atiende todas las rutas usando `dist/serverless.js`.

Variables de entorno (Settings → Environment Variables):

| Variable         | Ejemplo / nota                                                        |
| ---------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`   | Supabase *Transaction pooler* (puerto 6543) + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL`     | Supabase *Session pooler* (puerto 5432)                                |
| `JWT_SECRET`     | cadena larga y aleatoria                                              |
| `JWT_EXPIRES_IN` | `86400`                                                               |
| `CORS_ORIGIN`    | `https://tu-frontend.vercel.app` (opcional, por defecto `*`)          |

### Base de datos en Supabase

1. Crea el proyecto en Supabase y copia las cadenas en
   *Project Settings → Database → Connection string → ORMs (Prisma)*.
2. Ponlas en tu `.env` local (ver `.env.example`) y en Vercel.
3. Crea las tablas (una vez y tras cada cambio de esquema; usa `DIRECT_URL`):

```bash
npm run db:deploy
```

4. Carga los datos iniciales:

```bash
npm run import:cards
```

```bash
npm run seed:users
```

## 2. Frontend (Next.js) — Root Directory: `frontend`

| Variable          | Valor                                           |
| ----------------- | ----------------------------------------------- |
| `NEST_API_ORIGIN` | URL del backend, p. ej. `https://tu-api.vercel.app` |

Se lee en el build (`next.config.ts`), así que si la cambias hay que redesplegar.
