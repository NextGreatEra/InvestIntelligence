CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"cmc_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"cmc_rank" integer,
	"circulating_supply" numeric(30, 8),
	"total_supply" numeric(30, 8),
	"max_supply" numeric(30, 8),
	"infinite_supply" boolean,
	"first_historical_data" timestamp,
	"last_historical_data" timestamp,
	"date_added" timestamp,
	"last_updated" timestamp NOT NULL,
	"price" numeric(30, 8),
	"volume_24h" numeric(30, 8),
	"volume_change_24h" numeric(10, 2),
	"percent_change_1h" numeric(10, 2),
	"percent_change_24h" numeric(10, 2),
	"percent_change_7d" numeric(10, 2),
	"market_cap" numeric(30, 8),
	"market_cap_dominance" numeric(10, 2),
	"fully_diluted_market_cap" numeric(30, 8),
	CONSTRAINT "assets_cmc_id_unique" UNIQUE("cmc_id")
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"allocation" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
