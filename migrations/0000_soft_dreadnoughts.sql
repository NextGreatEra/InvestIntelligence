CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"current_price" numeric(20, 8) NOT NULL,
	"price_change_percentage_24h" numeric(10, 2),
	"last_updated" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"allocation" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"price" numeric NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
