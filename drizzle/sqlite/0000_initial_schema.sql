CREATE TABLE `qoqa_order_subuniverses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`subuniverse` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_qoqa_order_subuniverses_pair` ON `qoqa_order_subuniverses` (`order_number`,`subuniverse`);--> statement-breakpoint
CREATE INDEX `idx_qoqa_order_subuniverses_sub` ON `qoqa_order_subuniverses` (`subuniverse`);--> statement-breakpoint
CREATE TABLE `qoqa_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`order_date` text NOT NULL,
	`amount_chf` numeric NOT NULL,
	`status` text,
	`subtotal_chf` numeric,
	`discount_chf` numeric,
	`vat_chf` numeric,
	`delivery_on` text,
	`offer_id` text,
	`offer_title` text,
	`offer_subtitle` text,
	`universe` text,
	`subuniverse` text,
	`item_description` text,
	`invoice_number` text,
	`pdf_filename` text,
	`pdf_data` blob,
	`raw_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_qoqa_orders_order_number` ON `qoqa_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `qoqa_subuniverses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`name_fr` text,
	`name_de` text,
	`universe_tracking_identifier` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_qoqa_subuniverses_identifier` ON `qoqa_subuniverses` (`identifier`);--> statement-breakpoint
CREATE TABLE `qoqa_universes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`universe_tracking_identifier` text NOT NULL,
	`name_fr` text,
	`name_de` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_qoqa_universes_identifier` ON `qoqa_universes` (`universe_tracking_identifier`);