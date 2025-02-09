CREATE TABLE IF NOT EXISTS "stocks" (
  "id" serial PRIMARY KEY NOT NULL,
  "symbol" text NOT NULL,
  "description" text NOT NULL,
  "c" decimal(30, 8) NOT NULL,
  "dp" decimal(10, 2),
  "last_updated" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
);
