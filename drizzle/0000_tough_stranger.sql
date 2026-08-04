CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`ua` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_exp_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`totp_secret` text,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_uq` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'list' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `announcements_enabled_idx` ON `announcements` (`is_enabled`,`sort_order`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`content_enc` text NOT NULL,
	`content_hash` text NOT NULL,
	`preview` text,
	`status` text DEFAULT 'available' NOT NULL,
	`order_id` integer,
	`batch_id` text,
	`sold_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_dedupe_uq` ON `cards` (`product_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `cards_alloc_idx` ON `cards` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `cards_order_idx` ON `cards` (`order_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_uq` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `coupon_usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_usages_order_uq` ON `coupon_usages` (`order_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`product_id` integer,
	`min_amount_cents` integer DEFAULT 0 NOT NULL,
	`max_uses` integer DEFAULT 0 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`expires_at` integer,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_uq` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`payable_cents` integer NOT NULL,
	`coupon_id` integer,
	`contact_email` text NOT NULL,
	`query_pass_hash` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_provider` text,
	`pay_currency` text,
	`pay_amount` text,
	`provider_trade_no` text,
	`paid_at` integer,
	`delivered_at` integer,
	`expires_at` integer NOT NULL,
	`ip` text,
	`ua` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_no_uq` ON `orders` (`order_no`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`contact_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_expiry_idx` ON `orders` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `orders_provider_idx` ON `orders` (`status`,`payment_provider`);--> statement-breakpoint
CREATE TABLE `payment_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_channels_uq` ON `payment_channels` (`provider`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`order_id` integer,
	`order_no` text,
	`kind` text NOT NULL,
	`raw_payload` text,
	`result` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_uq` ON `payment_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_key` text,
	`price_cents` integer NOT NULL,
	`original_price_cents` integer,
	`delivery_type` text DEFAULT 'auto' NOT NULL,
	`buy_min` integer DEFAULT 1 NOT NULL,
	`buy_max` integer DEFAULT 10 NOT NULL,
	`wholesale_tiers` text,
	`stock_alert_threshold` integer DEFAULT 10 NOT NULL,
	`sales_count` integer DEFAULT 0 NOT NULL,
	`sales_base` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_uq` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_cat_idx` ON `products` (`category_id`,`is_enabled`,`sort_order`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usdt_amount_locks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain` text NOT NULL,
	`address` text NOT NULL,
	`amount_micro` integer NOT NULL,
	`order_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`released` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usdt_lock_order_uq` ON `usdt_amount_locks` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `usdt_lock_amount_uq` ON `usdt_amount_locks` (`chain`,`address`,`amount_micro`) WHERE released = 0;