# API

## Project setup

```bash
cp .env.example .env
```

Don't forget to edit the .env file too!

### Run in production mode

```bash
deno run --allow-env --allow-read --allow-net mod.ts
```

### Run in debug mode (with debugger)

```bash
deno run --inspect-brk --unstable --allow-env --allow-read --allow-net mod.ts
```
