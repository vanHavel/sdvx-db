# sdvx-db
Sound Voltex Konasute Chart Database 

[sdvx.directory](https://sdvx.directory) is currently live with the data for Konasute.

# Obtaining the raw data 
To obtain the raw song / chart info for Konasute, we use [v-flux](https://github.com/vanHavel/v-flux) which reads it from Konasute memory.

The output is written to the file `songs.jsonl`. 

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
