import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const normalizationStatusEnum = pgEnum("normalization_status", ["CONFIRMED", "AUTO_MATCHED", "NEEDS_REVIEW"]);
export const identifierKindEnum = pgEnum("identifier_kind", ["UPC", "GTIN12", "GTIN13", "EAN", "DPCI", "TCIN", "WALMART_ITEM_ID", "MEIJER_SKU", "RETAILER_SKU", "MANUFACTURER_SKU"]);
export const identifierConfidenceEnum = pgEnum("identifier_confidence", ["EXACT", "CLAIMED", "PARSED", "INFERRED"]);
export const productStateEnum = pgEnum("product_state", ["NEW", "HUNT", "WATCH", "IGNORE", "OWN"]);
export const retailerKindEnum = pgEnum("retailer_kind", ["PHYSICAL_AND_ONLINE", "ONLINE_ONLY", "CROWD_INVENTORY"]);
export const listingStatusEnum = pgEnum("listing_status", ["ACTIVE", "PREORDER", "OUT_OF_STOCK", "REMOVED", "UNKNOWN"]);
export const availabilityStatusEnum = pgEnum("availability_status", ["IN_STOCK", "LIMITED", "OUT_OF_STOCK", "PICKUP_UNAVAILABLE", "PREORDER", "ONLINE_ONLY", "UNKNOWN", "SOURCE_UNAVAILABLE"]);
export const mediaEvidenceEnum = pgEnum("media_evidence", ["NONE", "PHOTO_LINK", "VIDEO_LINK", "UNKNOWN"]);
export const locationScopeEnum = pgEnum("location_scope", ["NAMED_STORE", "LOCAL_CITY", "REGIONAL", "NATIONAL", "UNKNOWN"]);
export const evidenceKindEnum = pgEnum("evidence_kind", ["EXACT_PRODUCT_PHOTO", "EXACT_PRODUCT_TEXT", "LINE_OR_WAVE_PHOTO", "LINE_OR_WAVE_TEXT", "GENERAL_RETAILER_ACTIVITY"]);
export const reviewStatusEnum = pgEnum("review_status", ["AUTO_ACCEPTED", "NEEDS_REVIEW", "REJECTED"]);
export const waveStatusEnum = pgEnum("wave_status", ["PLANNED", "ACTIVE", "HISTORICAL", "UNKNOWN"]);
export const waveRelationshipEnum = pgEnum("wave_relationship", ["OFFICIAL", "ASSORTMENT", "CASEMATE", "COMMUNITY_ASSOCIATED", "INFERRED"]);
export const rankingLabelEnum = pgEnum("ranking_label", ["STRONG", "POSSIBLE", "WEAK", "INSUFFICIENT"]);
export const ingestionStatusEnum = pgEnum("ingestion_status", ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "SKIPPED"]);
export const matchReviewStatusEnum = pgEnum("match_review_status", ["OPEN", "RESOLVED", "DISMISSED"]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: varchar("canonical_name", { length: 300 }).notNull(),
  franchise: varchar("franchise", { length: 20 }).notNull().default("TMNT"),
  brand: varchar("brand", { length: 120 }), manufacturer: varchar("manufacturer", { length: 120 }), line: varchar("line", { length: 120 }),
  productType: varchar("product_type", { length: 80 }), characters: text("characters").array().notNull().default(sql`ARRAY[]::text[]`),
  description: text("description"), primaryImageUrl: text("primary_image_url"), releaseDate: timestamp("release_date", { withTimezone: true }),
  firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(), lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  normalizationStatus: normalizationStatusEnum("normalization_status").notNull().default("CONFIRMED"), archivedAt: timestamp("archived_at", { withTimezone: true }), ...timestamps
}, (table) => [check("products_tmny_only", sql`${table.franchise} = 'TMNT'`), index("products_detected_idx").on(table.firstDetectedAt)]);

export const retailers = pgTable("retailers", {
  id: uuid("id").primaryKey().defaultRandom(), key: varchar("key", { length: 50 }).notNull(), name: varchar("name", { length: 100 }).notNull(),
  kind: retailerKindEnum("kind").notNull(), active: boolean("active").notNull().default(true), ...timestamps
}, (table) => [uniqueIndex("retailers_key_unique").on(table.key)]);

export const appUsers = pgTable("app_users", {
  id: varchar("id", { length: 128 }).primaryKey(), email: varchar("email", { length: 320 }), displayName: varchar("display_name", { length: 120 }).notNull(), ...timestamps
}, (table) => [uniqueIndex("app_users_email_unique").on(table.email)]);

export const retailerListings = pgTable("retailer_listings", {
  id: uuid("id").primaryKey().defaultRandom(), productId: uuid("product_id").notNull().references(() => products.id), retailerId: uuid("retailer_id").notNull().references(() => retailers.id),
  retailerProductId: varchar("retailer_product_id", { length: 128 }), canonicalUrl: text("canonical_url").notNull(), canonicalUrlHash: varchar("canonical_url_hash", { length: 64 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(), imageUrl: text("image_url"), currency: varchar("currency", { length: 3 }).notNull().default("USD"), priceMinor: integer("price_minor"),
  listingStatus: listingStatusEnum("listing_status").notNull().default("UNKNOWN"), exclusive: boolean("exclusive"), rawSourceRef: varchar("raw_source_ref", { length: 300 }),
  firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(), lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull(), lastChangedAt: timestamp("last_changed_at", { withTimezone: true }).notNull(), ...timestamps
}, (table) => [uniqueIndex("listings_retailer_product_unique").on(table.retailerId, table.retailerProductId), uniqueIndex("listings_url_hash_unique").on(table.retailerId, table.canonicalUrlHash), check("listings_price_nonnegative", sql`${table.priceMinor} is null or ${table.priceMinor} >= 0`)]);

export const productIdentifiers = pgTable("product_identifiers", {
  id: uuid("id").primaryKey().defaultRandom(), productId: uuid("product_id").notNull().references(() => products.id), kind: identifierKindEnum("kind").notNull(),
  namespace: varchar("namespace", { length: 100 }).notNull(), valueNormalized: varchar("value_normalized", { length: 128 }).notNull(), valueDisplay: varchar("value_display", { length: 128 }).notNull(), retailerId: uuid("retailer_id").references(() => retailers.id),
  sourceListingId: uuid("source_listing_id").references(() => retailerListings.id), confidence: identifierConfidenceEnum("confidence").notNull(),
  firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull(), lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).notNull(), ...timestamps
}, (table) => [uniqueIndex("identifiers_namespace_unique").on(table.namespace, table.kind, table.valueNormalized), index("identifiers_product_idx").on(table.productId)]);

export const userProductStates = pgTable("user_product_states", {
  id: uuid("id").primaryKey().defaultRandom(), userId: varchar("user_id", { length: 128 }).notNull(), productId: uuid("product_id").notNull().references(() => products.id),
  state: productStateEnum("state").notNull().default("NEW"), notes: text("notes"), changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(), lastMutationId: varchar("last_mutation_id", { length: 128 }), ...timestamps
}, (table) => [uniqueIndex("user_product_state_unique").on(table.userId, table.productId)]);

export const productStateHistory = pgTable("product_state_history", {
  id: uuid("id").primaryKey().defaultRandom(), userProductStateId: uuid("user_product_state_id").notNull().references(() => userProductStates.id),
  state: productStateEnum("state").notNull(), mutationId: varchar("mutation_id", { length: 128 }).notNull(), changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("state_history_mutation_unique").on(table.userProductStateId, table.mutationId)]);

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(), retailerId: uuid("retailer_id").notNull().references(() => retailers.id), retailerStoreId: varchar("retailer_store_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(), addressSummary: varchar("address_summary", { length: 200 }), city: varchar("city", { length: 100 }).notNull(), region: varchar("region", { length: 30 }).notNull(), postalCode: varchar("postal_code", { length: 20 }),
  latitude: numeric("latitude", { precision: 9, scale: 6 }), longitude: numeric("longitude", { precision: 9, scale: 6 }), active: boolean("active").notNull().default(true), ...timestamps
}, (table) => [uniqueIndex("store_retailer_id_unique").on(table.retailerId, table.retailerStoreId)]);

export const storeProfiles = pgTable("store_profiles", {
  id: uuid("id").primaryKey().defaultRandom(), userId: varchar("user_id", { length: 128 }).notNull(), storeId: uuid("store_id").notNull().references(() => stores.id), preference: integer("preference").notNull().default(0), lineTags: text("line_tags").array().notNull().default(sql`ARRAY[]::text[]`), notes: text("notes"), ...timestamps
}, (table) => [uniqueIndex("store_profile_unique").on(table.userId, table.storeId), check("store_preference_range", sql`${table.preference} between -10 and 10`)]);

export const availabilityObservations = pgTable("availability_observations", {
  id: uuid("id").primaryKey().defaultRandom(), listingId: uuid("listing_id").notNull().references(() => retailerListings.id), storeId: uuid("store_id").references(() => stores.id),
  status: availabilityStatusEnum("status").notNull(), quantity: integer("quantity"), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), effectiveAt: timestamp("effective_at", { withTimezone: true }),
  sourceKind: varchar("source_kind", { length: 80 }).notNull(), sourceRef: varchar("source_ref", { length: 300 }).notNull(), parserVersion: varchar("parser_version", { length: 50 }).notNull(), idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(), rawLabel: varchar("raw_label", { length: 200 }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("availability_idempotency_unique").on(table.idempotencyKey), index("availability_latest_idx").on(table.listingId, table.storeId, table.observedAt), check("availability_quantity_nonnegative", sql`${table.quantity} is null or ${table.quantity} >= 0`)]);

export const crowdPosts = pgTable("crowd_posts", {
  id: uuid("id").primaryKey().defaultRandom(), sourceKey: varchar("source_key", { length: 50 }).notNull(), externalPostId: varchar("external_post_id", { length: 128 }).notNull(), permalink: text("permalink").notNull(), community: varchar("community", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(), bodyExcerpt: text("body_excerpt"), authorDisplay: varchar("author_display", { length: 120 }), postedAt: timestamp("posted_at", { withTimezone: true }).notNull(), fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(), parentOrCrosspostId: varchar("parent_or_crosspost_id", { length: 128 }), mediaEvidence: mediaEvidenceEnum("media_evidence").notNull().default("UNKNOWN"), rawSourceRef: varchar("raw_source_ref", { length: 300 }), ...timestamps
}, (table) => [uniqueIndex("crowd_post_source_unique").on(table.sourceKey, table.externalPostId), index("crowd_post_content_idx").on(table.contentHash)]);

export const sightings = pgTable("sightings", {
  id: uuid("id").primaryKey().defaultRandom(), crowdPostId: uuid("crowd_post_id").notNull().references(() => crowdPosts.id), retailerId: uuid("retailer_id").references(() => retailers.id), storeId: uuid("store_id").references(() => stores.id),
  locationScope: locationScopeEnum("location_scope").notNull(), locationText: varchar("location_text", { length: 300 }), city: varchar("city", { length: 100 }), region: varchar("region", { length: 30 }), observedAt: timestamp("observed_at", { withTimezone: true }),
  evidenceKind: evidenceKindEnum("evidence_kind").notNull(), confidenceScore: integer("confidence_score").notNull(), confidenceReasons: jsonb("confidence_reasons").$type<string[]>().notNull(), reviewStatus: reviewStatusEnum("review_status").notNull(), idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(), ...timestamps
}, (table) => [uniqueIndex("sighting_idempotency_unique").on(table.idempotencyKey), check("sighting_confidence_range", sql`${table.confidenceScore} between 0 and 100`)]);

export const sightingProductCandidates = pgTable("sighting_product_candidates", {
  sightingId: uuid("sighting_id").notNull().references(() => sightings.id), productId: uuid("product_id").notNull().references(() => products.id), matchType: varchar("match_type", { length: 60 }).notNull(), score: integer("score").notNull(), reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(), confirmed: boolean("confirmed").notNull().default(false)
}, (table) => [primaryKey({ columns: [table.sightingId, table.productId] }), check("candidate_score_range", sql`${table.score} between 0 and 100`)]);

export const waves = pgTable("waves", {
  id: uuid("id").primaryKey().defaultRandom(), name: varchar("name", { length: 200 }).notNull(), brand: varchar("brand", { length: 120 }), line: varchar("line", { length: 120 }), retailerId: uuid("retailer_id").references(() => retailers.id), releaseWindow: varchar("release_window", { length: 100 }), status: waveStatusEnum("status").notNull().default("UNKNOWN"), ...timestamps
});

export const waveMemberships = pgTable("wave_memberships", {
  waveId: uuid("wave_id").notNull().references(() => waves.id), productId: uuid("product_id").notNull().references(() => products.id), relationship: waveRelationshipEnum("relationship").notNull(), sourceRef: varchar("source_ref", { length: 300 }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.waveId, table.productId] })]);

export const rankingSnapshots = pgTable("ranking_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(), userId: varchar("user_id", { length: 128 }).notNull(), productId: uuid("product_id").notNull().references(() => products.id), storeId: uuid("store_id").notNull().references(() => stores.id), score: integer("score").notNull(),
  label: rankingLabelEnum("label").notNull(), factors: jsonb("factors").$type<Array<{ code: string; direction: string; points: number; evidenceRef: string; observedAt: string }>>().notNull(), calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull(), rulesVersion: varchar("rules_version", { length: 40 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("ranking_product_store_idx").on(table.productId, table.storeId, table.calculatedAt)]);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(), sourceKey: varchar("source_key", { length: 50 }).notNull(), jobType: varchar("job_type", { length: 80 }).notNull(), startedAt: timestamp("started_at", { withTimezone: true }).notNull(), finishedAt: timestamp("finished_at", { withTimezone: true }), status: ingestionStatusEnum("status").notNull().default("RUNNING"),
  fetchedCount: integer("fetched_count").notNull().default(0), parsedCount: integer("parsed_count").notNull().default(0), createdCount: integer("created_count").notNull().default(0), updatedCount: integer("updated_count").notNull().default(0), ignoredCount: integer("ignored_count").notNull().default(0), failedCount: integer("failed_count").notNull().default(0),
  cursor: varchar("cursor", { length: 500 }), errorCode: varchar("error_code", { length: 80 }), sanitizedMessage: varchar("sanitized_message", { length: 500 }), parserVersion: varchar("parser_version", { length: 50 }).notNull(), runKey: varchar("run_key", { length: 128 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("ingestion_run_key_unique").on(table.runKey), index("ingestion_source_started_idx").on(table.sourceKey, table.startedAt)]);

export const matchReviewItems = pgTable("match_review_items", {
  id: uuid("id").primaryKey().defaultRandom(), sourceKey: varchar("source_key", { length: 50 }).notNull(), externalListingId: varchar("external_listing_id", { length: 128 }).notNull(), candidateProductIds: uuid("candidate_product_ids").array().notNull(), reasonCode: varchar("reason_code", { length: 80 }).notNull(), status: matchReviewStatusEnum("status").notNull().default("OPEN"), details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}), resolvedAt: timestamp("resolved_at", { withTimezone: true }), ...timestamps
}, (table) => [uniqueIndex("match_review_open_unique").on(table.sourceKey, table.externalListingId, table.reasonCode)]);
