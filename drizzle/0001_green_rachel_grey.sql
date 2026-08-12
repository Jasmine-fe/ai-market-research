CREATE TABLE `fomc_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`section_title` text NOT NULL,
	`section_index` integer NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`token_count` integer NOT NULL,
	`embedding` blob NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `fomc_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_fomc_chunks_document_id` ON `fomc_chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `fomc_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_date` text NOT NULL,
	`published_at` text NOT NULL,
	`title` text NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`chunking_version` text NOT NULL,
	`embedding_model` text NOT NULL,
	`embedding_dimensions` integer NOT NULL,
	`chunk_count` integer NOT NULL,
	`indexed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fomc_documents_meeting_date` ON `fomc_documents` (`meeting_date`);--> statement-breakpoint
CREATE INDEX `idx_fomc_documents_published_at` ON `fomc_documents` (`published_at`);--> statement-breakpoint
CREATE TABLE `fomc_ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`documents_indexed` integer NOT NULL,
	`chunks_indexed` integer NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE VIRTUAL TABLE `fomc_chunks_fts` USING fts5(
	`chunk_id` UNINDEXED,
	`content`,
	`section_title`,
	tokenize = 'porter unicode61'
);
