CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`original_price_cents` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_variants_idx` ON `product_variants` (`product_id`,`is_enabled`,`sort_order`);--> statement-breakpoint
DROP INDEX `cards_alloc_idx`;--> statement-breakpoint
ALTER TABLE `cards` ADD `variant_id` integer;--> statement-breakpoint
CREATE INDEX `cards_alloc_idx` ON `cards` (`product_id`,`variant_id`,`status`);--> statement-breakpoint
ALTER TABLE `orders` ADD `variant_id` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `variant_name` text;--> statement-breakpoint
ALTER TABLE `products` ADD `has_variants` integer DEFAULT false NOT NULL;