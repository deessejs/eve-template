CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"eve_session_id" text,
	"eve_continuation_token" text,
	"eve_stream_index" integer DEFAULT 0 NOT NULL,
	"title" text,
	"preview" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"pinned" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_event" ADD CONSTRAINT "conversation_event_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_user_pinned_updated_idx" ON "conversation" USING btree ("user_id","pinned","updated_at");--> statement-breakpoint
CREATE INDEX "conversation_user_archived_idx" ON "conversation" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "conversation_event_conversation_sequence_idx" ON "conversation_event" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_event_conversation_event_unique" ON "conversation_event" USING btree ("conversation_id","event_id");