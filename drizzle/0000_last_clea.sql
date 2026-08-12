CREATE TABLE `market_brief_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`status` text NOT NULL,
	`model` text,
	`rag_status` text,
	`summary_json` text NOT NULL
);
