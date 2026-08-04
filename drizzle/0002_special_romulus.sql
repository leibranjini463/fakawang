CREATE TABLE `alipay_amount_locks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`order_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`released` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alipay_lock_order_uq` ON `alipay_amount_locks` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `alipay_lock_amount_uq` ON `alipay_amount_locks` (`account`,`amount_cents`) WHERE released = 0;