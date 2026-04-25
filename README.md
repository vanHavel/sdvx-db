# sdvx-db
Sound Voltex Konasute Chart Database

# Generating the database
To generate the database:

```bash
cd python
uv sync
uv run create_sqlite_db.py
```

The db will be gzip-compressed and placed into the `web/public` directory.

# Collecting images
To collect and process images (song pack jackets, version logos, etc.):

```bash
cd python
uv run collect_images.py
```

# Running the dev server
```bash
cd web
npm run dev
```

# Building the web app
```bash
cd web
npm run build
```

# Serving the production build
```bash
cd web
npm run serve
```
