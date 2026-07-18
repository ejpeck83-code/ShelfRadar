CREATE TYPE "public"."availability_status" AS ENUM('IN_STOCK', 'LIMITED', 'OUT_OF_STOCK', 'PICKUP_UNAVAILABLE', 'PREORDER', 'ONLINE_ONLY', 'UNKNOWN', 'SOURCE_UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('EXACT_PRODUCT_PHOTO', 'EXACT_PRODUCT_TEXT', 'LINE_OR_WAVE_PHOTO', 'LINE_OR_WAVE_TEXT', 'GENERAL_RETAILER_ACTIVITY');--> statement-breakpoint
CREATE TYPE "public"."identifier_confidence" AS ENUM('EXACT', 'CLAIMED', 'PARSED', 'INFERRED');--> statement-breakpoint
CREATE TYPE "public"."identifier_kind" AS ENUM('UPC', 'GTIN12', 'GTIN13', 'EAN', 'DPCI', 'TCIN', 'WALMART_ITEM_ID', 'MEIJER_SKU', 'RETAILER_SKU', 'MANUFACTURER_SKU');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('ACTIVE', 'PREORDER', 'OUT_OF_STOCK', 'REMOVED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."location_scope" AS ENUM('NAMED_STORE', 'LOCAL_CITY', 'REGIONAL', 'NATIONAL', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."match_review_status" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."media_evidence" AS ENUM('NONE', 'PHOTO_LINK', 'VIDEO_LINK', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."normalization_status" AS ENUM('CONFIRMED', 'AUTO_MATCHED', 'NEEDS_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."product_state" AS ENUM('NEW', 'HUNT', 'WATCH', 'IGNORE', 'OWN');--> statement-breakpoint
CREATE TYPE "public"."ranking_label" AS ENUM('STRONG', 'POSSIBLE', 'WEAK', 'INSUFFICIENT');--> statement-breakpoint
CREATE TYPE "public"."retailer_kind" AS ENUM('PHYSICAL_AND_ONLINE', 'ONLINE_ONLY', 'CROWD_INVENTORY');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('AUTO_ACCEPTED', 'NEEDS_REVIEW', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."wave_relationship" AS ENUM('OFFICIAL', 'ASSORTMENT', 'CASEMATE', 'COMMUNITY_ASSOCIATED', 'INFERRED');--> statement-breakpoint
CREATE TYPE "public"."wave_status" AS ENUM('PLANNED', 'ACTIVE', 'HISTORICAL', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"email" varchar(320),
	"display_name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"store_id" uuid,
	"status" "availability_status" NOT NULL,
	"quantity" integer,
	"observed_at" timestamp with time zone NOT NULL,
	"effective_at" timestamp with time zone,
	"source_kind" varchar(80) NOT NULL,
	"source_ref" varchar(300) NOT NULL,
	"parser_version" varchar(50) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"raw_label" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_quantity_nonnegative" CHECK ("availability_observations"."quantity" is null or "availability_observations"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "crowd_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(50) NOT NULL,
	"external_post_id" varchar(128) NOT NULL,
	"permalink" text NOT NULL,
	"community" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"body_excerpt" text,
	"author_display" varchar(120),
	"posted_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"parent_or_crosspost_id" varchar(128),
	"media_evidence" "media_evidence" DEFAULT 'UNKNOWN' NOT NULL,
	"raw_source_ref" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(50) NOT NULL,
	"job_type" varchar(80) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingestion_status" DEFAULT 'RUNNING' NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"parsed_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"ignored_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"cursor" varchar(500),
	"error_code" varchar(80),
	"sanitized_message" varchar(500),
	"parser_version" varchar(50) NOT NULL,
	"run_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(50) NOT NULL,
	"external_listing_id" varchar(128) NOT NULL,
	"candidate_product_ids" uuid[] NOT NULL,
	"reason_code" varchar(80) NOT NULL,
	"status" "match_review_status" DEFAULT 'OPEN' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "identifier_kind" NOT NULL,
	"namespace" varchar(100) NOT NULL,
	"value_normalized" varchar(128) NOT NULL,
	"value_display" varchar(128) NOT NULL,
	"retailer_id" uuid,
	"source_listing_id" uuid,
	"confidence" "identifier_confidence" NOT NULL,
	"first_observed_at" timestamp with time zone NOT NULL,
	"last_observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_product_state_id" uuid NOT NULL,
	"state" "product_state" NOT NULL,
	"mutation_id" varchar(128) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" varchar(300) NOT NULL,
	"franchise" varchar(20) DEFAULT 'TMNT' NOT NULL,
	"brand" varchar(120),
	"manufacturer" varchar(120),
	"line" varchar(120),
	"product_type" varchar(80),
	"characters" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"description" text,
	"primary_image_url" text,
	"release_date" timestamp with time zone,
	"first_detected_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"normalization_status" "normalization_status" DEFAULT 'CONFIRMED' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_tmny_only" CHECK ("products"."franchise" = 'TMNT')
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"label" "ranking_label" NOT NULL,
	"factors" jsonb NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"rules_version" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailer_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"retailer_id" uuid NOT NULL,
	"retailer_product_id" varchar(128),
	"canonical_url" text NOT NULL,
	"canonical_url_hash" varchar(64) NOT NULL,
	"title" varchar(300) NOT NULL,
	"image_url" text,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"price_minor" integer,
	"listing_status" "listing_status" DEFAULT 'UNKNOWN' NOT NULL,
	"exclusive" boolean,
	"raw_source_ref" varchar(300),
	"first_detected_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"last_changed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_price_nonnegative" CHECK ("retailer_listings"."price_minor" is null or "retailer_listings"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"kind" "retailer_kind" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sighting_product_candidates" (
	"sighting_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"match_type" varchar(60) NOT NULL,
	"score" integer NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sighting_product_candidates_sighting_id_product_id_pk" PRIMARY KEY("sighting_id","product_id"),
	CONSTRAINT "candidate_score_range" CHECK ("sighting_product_candidates"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crowd_post_id" uuid NOT NULL,
	"retailer_id" uuid,
	"store_id" uuid,
	"location_scope" "location_scope" NOT NULL,
	"location_text" varchar(300),
	"city" varchar(100),
	"region" varchar(30),
	"observed_at" timestamp with time zone,
	"evidence_kind" "evidence_kind" NOT NULL,
	"confidence_score" integer NOT NULL,
	"confidence_reasons" jsonb NOT NULL,
	"review_status" "review_status" NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sighting_confidence_range" CHECK ("sightings"."confidence_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "store_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"store_id" uuid NOT NULL,
	"preference" integer DEFAULT 0 NOT NULL,
	"line_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_preference_range" CHECK ("store_profiles"."preference" between -10 and 10)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"retailer_store_id" varchar(100) NOT NULL,
	"name" varchar(160) NOT NULL,
	"address_summary" varchar(200),
	"city" varchar(100) NOT NULL,
	"region" varchar(30) NOT NULL,
	"postal_code" varchar(20),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_product_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"product_id" uuid NOT NULL,
	"state" "product_state" DEFAULT 'NEW' NOT NULL,
	"notes" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_mutation_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wave_memberships" (
	"wave_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"relationship" "wave_relationship" NOT NULL,
	"source_ref" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wave_memberships_wave_id_product_id_pk" PRIMARY KEY("wave_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"brand" varchar(120),
	"line" varchar(120),
	"retailer_id" uuid,
	"release_window" varchar(100),
	"status" "wave_status" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_observations" ADD CONSTRAINT "availability_observations_listing_id_retailer_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."retailer_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_observations" ADD CONSTRAINT "availability_observations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_source_listing_id_retailer_listings_id_fk" FOREIGN KEY ("source_listing_id") REFERENCES "public"."retailer_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_state_history" ADD CONSTRAINT "product_state_history_user_product_state_id_user_product_states_id_fk" FOREIGN KEY ("user_product_state_id") REFERENCES "public"."user_product_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_listings" ADD CONSTRAINT "retailer_listings_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sighting_product_candidates" ADD CONSTRAINT "sighting_product_candidates_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "public"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sighting_product_candidates" ADD CONSTRAINT "sighting_product_candidates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_crowd_post_id_crowd_posts_id_fk" FOREIGN KEY ("crowd_post_id") REFERENCES "public"."crowd_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sightings" ADD CONSTRAINT "sightings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_states" ADD CONSTRAINT "user_product_states_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wave_memberships" ADD CONSTRAINT "wave_memberships_wave_id_waves_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."waves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wave_memberships" ADD CONSTRAINT "wave_memberships_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waves" ADD CONSTRAINT "waves_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_idempotency_unique" ON "availability_observations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "availability_latest_idx" ON "availability_observations" USING btree ("listing_id","store_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crowd_post_source_unique" ON "crowd_posts" USING btree ("source_key","external_post_id");--> statement-breakpoint
CREATE INDEX "crowd_post_content_idx" ON "crowd_posts" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_run_key_unique" ON "ingestion_runs" USING btree ("run_key");--> statement-breakpoint
CREATE INDEX "ingestion_source_started_idx" ON "ingestion_runs" USING btree ("source_key","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_review_open_unique" ON "match_review_items" USING btree ("source_key","external_listing_id","reason_code");--> statement-breakpoint
CREATE UNIQUE INDEX "identifiers_namespace_unique" ON "product_identifiers" USING btree ("namespace","kind","value_normalized");--> statement-breakpoint
CREATE INDEX "identifiers_product_idx" ON "product_identifiers" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "state_history_mutation_unique" ON "product_state_history" USING btree ("user_product_state_id","mutation_id");--> statement-breakpoint
CREATE INDEX "products_detected_idx" ON "products" USING btree ("first_detected_at");--> statement-breakpoint
CREATE INDEX "ranking_product_store_idx" ON "ranking_snapshots" USING btree ("product_id","store_id","calculated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_retailer_product_unique" ON "retailer_listings" USING btree ("retailer_id","retailer_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_url_hash_unique" ON "retailer_listings" USING btree ("retailer_id","canonical_url_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "retailers_key_unique" ON "retailers" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "sighting_idempotency_unique" ON "sightings" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "store_profile_unique" ON "store_profiles" USING btree ("user_id","store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_retailer_id_unique" ON "stores" USING btree ("retailer_id","retailer_store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_product_state_unique" ON "user_product_states" USING btree ("user_id","product_id");