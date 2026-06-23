ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_typed_answer text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_answer_correct boolean;
