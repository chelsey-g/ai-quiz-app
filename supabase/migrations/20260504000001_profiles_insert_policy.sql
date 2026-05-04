do $$ begin
  create policy "profiles_insert_own" on profiles
    for insert with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;
