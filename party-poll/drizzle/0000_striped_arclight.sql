CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`selfie` text,
	`answers` text NOT NULL,
	`created_at` integer NOT NULL
);
