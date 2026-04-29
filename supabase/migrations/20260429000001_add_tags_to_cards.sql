alter table cards add column if not exists tags text[] not null default '{}';
