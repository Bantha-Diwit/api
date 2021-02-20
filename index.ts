import { opineCors } from "https://deno.land/x/cors@v1.2.1/mod.ts";
import "https://deno.land/x/dotenv@v2.0.0/load.ts";
import { Opine, opine } from "https://deno.land/x/opine@1.1.0/mod.ts";
import { ConnectionOptions } from "https://deno.land/x/postgres@v0.8.0/connection/connection_params.ts";
import { Client } from "https://deno.land/x/postgres@v0.8.0/mod.ts";

import { tournamentsRouter } from "./routers/tournaments/tournaments.ts";

export let app: Opine;
export let db: Client;

let db_config: ConnectionOptions;

Promise.resolve()
	.then((): void => console.log("Deno process started"))
	.then((): void => void (db_config = {
		database: Deno.env.get("PGDATABASE")!,
		hostname: Deno.env.get("PGHOST")!,
		password: Deno.env.get("PGPASSWORD")!,
		port: Number.parseInt(Deno.env.get("DB_PORTPGPORT")!),
		user: Deno.env.get("PGUSER")!,
	}))
	.then((): void => void (db = new Client(db_config)))
	.then((): void => void db.connect())
	.then((): void => console.log("Connected to the database"))
	.then((): void => {
		app = opine();
		app.use(opineCors());

		app.use("/tournaments", tournamentsRouter);

		app.get("/", (req, res) => res.send("Hello World"));
	})
	.then((): Promise<void> => new Promise<void>((resolve, reject): void => {
		app.listen({
			port: Number.parseInt(Deno.env.get("PORT")!),
			hostname: Deno.env.get("HOST"),
		}, ((): void => resolve()));
	}))
	.then((): void => console.log("Web server started"))
	.catch((error: Error): void => console.error(error));
