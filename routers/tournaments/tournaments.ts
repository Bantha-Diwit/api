import { NextFunction, Request, Response, Router } from "https://deno.land/x/opine@1.1.0/mod.ts";
import { QueryObjectResult } from "https://deno.land/x/postgres@v0.8.0/query/query.ts";

import {
	PartialTournament, RocketLeagueMatch, RocketLeagueResult, RocketLeagueTeam, Round,
} from "../../../api - typings/mod.ts";
import { PlayerRow, ResultRow, TournamentRow } from "../../../db - typings/mod.ts";

import { db } from "../../index.ts";

export const tournamentsRouter = Router();

tournamentsRouter.get("/", (req: Request, res: Response<any>, next: NextFunction): Promise<Response<any>> => {
	return db.queryObject<Record<keyof TournamentRow, any>>(`
        SELECT t.id   as tournament_id,
               t.name as tournament_name,
               t.game as tournament_game_id,
               g.name as tournament_game_name,
               t.date as tournament_date,
               t.time as tournament_time
        FROM public.tournaments t
                 JOIN games g
                      ON t.game = g.id
        ORDER BY tournament_id;
	`)
		.then((result: QueryObjectResult<Record<keyof TournamentRow, any>>): TournamentRow[] => result.rows)
		.then((rows: PartialTournament[]): Response<any> => res.json(rows));
});

const tournamentRouter = Router({mergeParams: true});

tournamentsRouter.use("/:id", tournamentRouter);

tournamentRouter.get("/", async (req: Request, res: Response<any>, next: NextFunction): Promise<Response<any>> => {
	const id: number = Number.parseInt(req.params["id"]);
	if (!Number.isInteger(id)) {
		return Promise.resolve(res.send("Invalid Id"));
	}

	const [tournament, teams, rounds] = await Promise.all([
		db.queryObject<Record<keyof TournamentRow, any>>(`
		SELECT 	t.id	as tournament_id,
				t.name	as tournament_name,
				t.game	as tournament_game_id,
				g.name  as tournament_game_name,
				t.date	as tournament_date,
				t.time	as tournament_time
		FROM public.tournaments t
		JOIN games g
			ON t.game = g.id
		WHERE t.id = ${id}
		ORDER BY tournament_id
		LIMIT 1;
		`)
			.then((result: QueryObjectResult<Record<keyof TournamentRow, any>>): TournamentRow[] => result.rows)
			.then((rows: PartialTournament[]): PartialTournament => rows[0]),

		db.queryObject<Record<keyof PlayerRow, any>>(`
			SELECT	t.id				as team_id,
					t.name				as team_name,
					tt.avg_rank			as team_avg_rank,
					r.name				as team_avg_rank_name,
					p.id				as player_id,
					p.name				as player_name,
					pr.real_rank		as player_real_rank,
					r2.name				as player_real_rank_name,
					pr.perceived_rank	as player_perceived_rank,
					r3.name				as player_perceived_rank_name
			FROM (
				SELECT	teams.id					as team_id,
						round(avg(pr.real_rank))	as avg_rank
				FROM public.teams
				FULL JOIN public.team_players tp
					ON teams.id = tp.team_id
				JOIN public.players p
					ON tp.player_id = p.id
				FULL JOIN rocket_league.player_ranks pr
					ON p.id = pr.player_id
				WHERE tournament_id = ${id}
				GROUP BY teams.id
			) tt
			FULL JOIN teams t
				ON tt.team_id = t.id
			JOIN public.team_players tp
				ON t.id = tp.team_id
			JOIN public.players p
				ON tp.player_id = p.id
			JOIN rocket_league.player_ranks pr
				ON p.id = pr.player_id
			JOIN rocket_league.ranks r
				ON tt.avg_rank = r.id
			JOIN rocket_league.ranks r2
				ON pr.real_rank = r2.id
			JOIN rocket_league.ranks r3
				ON pr.perceived_rank = r3.id
			ORDER BY team_id;
		`)
			.then((result: QueryObjectResult<Record<keyof PlayerRow, any>>): PlayerRow[] => result.rows)
			.then((rows: PlayerRow[]): RocketLeagueTeam[] => {
				return rows.reduce((p: RocketLeagueTeam[], c: PlayerRow) => {
					if (!p.find(e => e.team_id === c.team_id)) {
						p.push({
							team_id: c.team_id,
							team_name: c.team_name,
							team_avg_rank: c.team_avg_rank,
							team_avg_rank_name: c.team_avg_rank_name,
							team_players: [],
						});
					}

					const t = p.find(e => e.team_id === c.team_id)!;
					t.team_players.push({
						player_id: c.player_id,
						player_name: c.player_name,
						player_real_rank: c.player_real_rank,
						player_real_rank_name: c.player_real_rank_name,
						player_perceived_rank: c.player_perceived_rank,
						player_perceived_rank_name: c.player_perceived_rank_name,
					});
					return p;
				}, []);
			}),

		db.queryObject<Record<keyof ResultRow, any>>(`
		SELECT	r.id		as round_id,
				r.name		as round_name,
				r.time		as round_time,
				tr."order"	as round_order,
				m.id		as match_id,
				m.name		as match_name,
				rm."order"	as match_order,
				g.id		as game_id,
				g.name		as game_name,
				mg."order"	as game_order,
				t.id	    as team_id,
				t.name      as team_name,
				mt."order"	as team_order,
				gr.score	as result_score,
				gr.assists	as result_assists,
				gr.saves	as result_saves,
				gr.shots	as result_shots,
				gr.goals	as result_goals
		FROM public.tournament_rounds tr
		FULL JOIN public.rounds r
			ON r.id = tr.round_id
		FULL JOIN public.round_matches rm
			ON r.id = rm.round_id
		FULL JOIN public.matches m
			ON m.id = rm.match_id
		FULL JOIN public.match_teams mt
			ON m.id = mt.match_id
		FULL JOIN public.teams t
			ON t.id = mt.team_id
		FULL JOIN public.match_games mg
			ON m.id = mg.match_id
		FULL JOIN public.games g
			ON mg.game_id = g.id
		FULL JOIN rocket_league.game_results gr
			ON g.id = gr.game_id AND mt.team_id = gr.team_id
		WHERE tr.tournament_id = ${id}
		ORDER BY round_order, match_order, game_order, team_order;
		`)
			.then((result: QueryObjectResult<Record<keyof ResultRow, any>>): ResultRow[] => result.rows)
			.then((rows: ResultRow[]): Round[] => {
				return rows.reduce((p: Round[], c: ResultRow) => {
					if (!p.find(e => e.round_id === c.round_id)) {
						p.push(new Round({
							round_id: c.round_id,
							round_name: c.round_name,
							round_time: c.round_time,
							round_order: c.round_order,
						}));
					}
					const r = p.find(e => e.round_id === c.round_id)!;

					if (!r.round_matches.find(e => e.match_id === c.match_id)) {
						r.round_matches.push(new RocketLeagueMatch({
							match_id: c.match_id, match_name: c.match_name, match_order: c.match_order,
						}));
					}
					const m = r.round_matches.find(e => e.match_id === c.match_id)!;

					if (!m.match_teams.find(e => e.team_id === c.team_id) || (c.team_name === null && m.match_teams.length < c.team_order)) {
						m.match_teams.push({
							team_id: c.team_id, team_name: c.team_name, team_order: c.team_order,
						});
					}

					if (!m.match_games.find(e => e.game_id === c.game_id)) {
						m.match_games.push({
							game_id: c.game_id, game_name: c.game_name, game_order: c.game_order, game_results: [],
						});
					}
					const g = m.match_games.find(e => e.game_id === c.game_id)!;

					if (!g.game_results.find(e => e.result_team_id === c.team_id) || (c.team_name === null && g.game_results.length < c.team_order)) {
						g.game_results.push({
							result_team_id: c.team_id,
							result_score: c.result_score,
							result_assists: c.result_assists,
							result_saves: c.result_saves,
							result_shots: c.result_shots,
							result_goals: c.result_goals,
						} as RocketLeagueResult);
					}

					return p;
				}, []);
			}),
	]);

	return res.json({
		...tournament, tournament_teams: teams, tournament_rounds: rounds,
	});
});
