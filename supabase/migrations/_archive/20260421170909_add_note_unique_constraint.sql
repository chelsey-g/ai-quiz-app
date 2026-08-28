alter table notes add constraint notes_source_path_github_sha_key unique (source_path, github_sha);
