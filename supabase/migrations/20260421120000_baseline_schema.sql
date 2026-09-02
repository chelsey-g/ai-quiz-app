-- Consolidated baseline schema for Trove.
-- Generated 2026-08-28 from the live database (`supabase db dump --linked`),
-- replacing 23 incrementally-authored migrations whose ledger had drifted.
-- This file is the single source of truth for the schema. Do not edit it;
-- make schema changes in new timestamped migrations after it.
-- See CONTRIBUTING.md -> Database changes.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_deck_card_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if TG_OP = 'INSERT' then
    update decks set card_count = card_count + 1 where id = NEW.deck_id;
  elsif TG_OP = 'DELETE' then
    update decks set card_count = card_count - 1 where id = OLD.deck_id;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_deck_card_count"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "uuid" NOT NULL,
    "front" "text" NOT NULL,
    "back" "text" NOT NULL,
    "card_type" "text" DEFAULT 'flashcard'::"text" NOT NULL,
    "times_seen" integer DEFAULT 0 NOT NULL,
    "times_correct" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "repetitions" integer DEFAULT 0 NOT NULL,
    "ease_factor" double precision DEFAULT 2.5 NOT NULL,
    "interval_days" integer DEFAULT 1 NOT NULL,
    "next_review_at" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer,
    "mc_distractors" "text"[],
    "mc_status" "text" DEFAULT 'pending'::"text",
    "flagged" boolean DEFAULT false NOT NULL,
    "last_typed_answer" "text",
    "last_answer_correct" boolean,
    "mc_condensed_answer" "text",
    CONSTRAINT "cards_mc_status_check" CHECK (("mc_status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "score" integer,
    "total" integer,
    "card_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "challenge_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."challenge_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenger_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "deck_id" "uuid",
    "card_ids" "uuid"[],
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "quiz_mode" "text" DEFAULT 'multiple-choice'::"text" NOT NULL,
    CONSTRAINT "challenges_quiz_mode_check" CHECK (("quiz_mode" = ANY (ARRAY['multiple-choice'::"text", 'type'::"text", 'random'::"text"]))),
    CONSTRAINT "challenges_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_decks" (
    "collection_id" "uuid" NOT NULL,
    "deck_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."collection_decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "missed_deck_id" "uuid"
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid",
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "topic_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "card_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "source_deck_id" "uuid",
    "is_code_deck" boolean DEFAULT false NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kata_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "problem_title" "text" NOT NULL,
    "problem_description" "text" NOT NULL,
    "function_stub" "text" NOT NULL,
    "difficulty" "text" DEFAULT 'easy'::"text" NOT NULL,
    "test_cases" "jsonb" NOT NULL,
    "user_code" "text",
    "results" "jsonb",
    "passed_count" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kata_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "source_path" "text" NOT NULL,
    "raw_content" "text" NOT NULL,
    "github_sha" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['challenge_received'::"text", 'challenge_completed'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "default_study_mode" "text" DEFAULT 'flip'::"text",
    "daily_goal" integer,
    "notification_prefs" "jsonb" DEFAULT '{"challenge_received": true, "challenge_completed": true}'::"jsonb" NOT NULL,
    "username" "text",
    CONSTRAINT "profiles_daily_goal_check" CHECK (("daily_goal" > 0)),
    CONSTRAINT "profiles_default_study_mode_check" CHECK (("default_study_mode" = ANY (ARRAY['flip'::"text", 'type'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "deck_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "score" integer,
    "total" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_decks"
    ADD CONSTRAINT "collection_decks_pkey" PRIMARY KEY ("collection_id", "deck_id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kata_attempts"
    ADD CONSTRAINT "kata_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_source_path_github_sha_key" UNIQUE ("source_path", "github_sha");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_display_name_unique" UNIQUE ("display_name");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "challenge_attempts_challenge_id_idx" ON "public"."challenge_attempts" USING "btree" ("challenge_id");



CREATE INDEX "challenge_attempts_user_id_idx" ON "public"."challenge_attempts" USING "btree" ("user_id");



CREATE INDEX "challenges_challenger_id_idx" ON "public"."challenges" USING "btree" ("challenger_id");



CREATE INDEX "collection_decks_deck_id_idx" ON "public"."collection_decks" USING "btree" ("deck_id");



CREATE INDEX "collections_user_id_idx" ON "public"."collections" USING "btree" ("user_id");



CREATE UNIQUE INDEX "decks_user_source_unique" ON "public"."decks" USING "btree" ("user_id", "source_deck_id") WHERE ("source_deck_id" IS NOT NULL);



CREATE INDEX "kata_attempts_deck_id_idx" ON "public"."kata_attempts" USING "btree" ("deck_id");



CREATE INDEX "kata_attempts_user_id_idx" ON "public"."kata_attempts" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "notifications_user_id_read_idx" ON "public"."notifications" USING "btree" ("user_id", "read");



CREATE INDEX "profiles_username_idx" ON "public"."profiles" USING "btree" ("username");



CREATE OR REPLACE TRIGGER "trg_card_count" AFTER INSERT OR DELETE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."update_deck_card_count"();



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_attempts"
    ADD CONSTRAINT "challenge_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collection_decks"
    ADD CONSTRAINT "collection_decks_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_decks"
    ADD CONSTRAINT "collection_decks_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_missed_deck_id_fkey" FOREIGN KEY ("missed_deck_id") REFERENCES "public"."decks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_source_deck_id_fkey" FOREIGN KEY ("source_deck_id") REFERENCES "public"."decks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kata_attempts"
    ADD CONSTRAINT "kata_attempts_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kata_attempts"
    ADD CONSTRAINT "kata_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can manage their own kata attempts" ON "public"."kata_attempts" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cards_select_public_deck" ON "public"."cards" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."decks"
  WHERE (("decks"."id" = "cards"."deck_id") AND ("decks"."is_public" = true)))));



ALTER TABLE "public"."challenge_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_attempts_select_challenger" ON "public"."challenge_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_attempts"."challenge_id") AND ("c"."challenger_id" = "auth"."uid"())))));



CREATE POLICY "challenge_attempts_select_own" ON "public"."challenge_attempts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "challenge_attempts_update_own" ON "public"."challenge_attempts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenges_insert" ON "public"."challenges" FOR INSERT WITH CHECK (("auth"."uid"() = "challenger_id"));



CREATE POLICY "challenges_select_challenger" ON "public"."challenges" FOR SELECT USING (("auth"."uid"() = "challenger_id"));



CREATE POLICY "challenges_select_participant" ON "public"."challenges" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."challenge_attempts" "ca"
  WHERE (("ca"."challenge_id" = "challenges"."id") AND ("ca"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."collection_decks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collection_decks_delete" ON "public"."collection_decks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_decks"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "collection_decks_insert" ON "public"."collection_decks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_decks"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "collection_decks_select" ON "public"."collection_decks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_decks"."collection_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."is_public" = true))))));



ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collections_delete" ON "public"."collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "collections_insert" ON "public"."collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "collections_select" ON "public"."collections" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("is_public" = true)));



CREATE POLICY "collections_update" ON "public"."collections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."decks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "decks_select_public" ON "public"."decks" FOR SELECT USING (("is_public" = true));



ALTER TABLE "public"."kata_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner access" ON "public"."cards" USING ((EXISTS ( SELECT 1
   FROM "public"."decks"
  WHERE (("decks"."id" = "cards"."deck_id") AND ("decks"."user_id" = "auth"."uid"())))));



CREATE POLICY "owner access" ON "public"."decks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner access" ON "public"."notes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner access" ON "public"."sessions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_all" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."challenge_attempts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_deck_card_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_deck_card_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_deck_card_count"() TO "service_role";


















GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_attempts" TO "anon";
GRANT ALL ON TABLE "public"."challenge_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."collection_decks" TO "anon";
GRANT ALL ON TABLE "public"."collection_decks" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_decks" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."decks" TO "anon";
GRANT ALL ON TABLE "public"."decks" TO "authenticated";
GRANT ALL ON TABLE "public"."decks" TO "service_role";



GRANT ALL ON TABLE "public"."kata_attempts" TO "anon";
GRANT ALL ON TABLE "public"."kata_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."kata_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

































-- ─────────────────────────────────────────────────────────────────────────
-- The following live in non-public schemas that `supabase db dump` skips,
-- restored here verbatim from the original migrations.
-- ─────────────────────────────────────────────────────────────────────────

-- Auto-create a profiles row for every new auth user
-- (function is in the public-schema dump above; the trigger on auth.users is not)
drop trigger if exists "on_auth_user_created" on "auth"."users";
create trigger "on_auth_user_created"
  after insert on "auth"."users"
  for each row execute procedure "public"."handle_new_user"();

-- avatars storage bucket + policies (from 20260504000000_add_avatar_url.sql)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

do $$ begin
  create policy "avatars_public_read" on storage.objects
    for select using (bucket_id = 'avatars');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "avatars_insert_own" on storage.objects
    for insert with check (
      bucket_id = 'avatars'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "avatars_update_own" on storage.objects
    for update using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null;
end $$;
