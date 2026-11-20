CREATE TABLE `custom_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weights` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
