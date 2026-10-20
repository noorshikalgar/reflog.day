-- Devices get a public id, so the API never shows a token hash.
ALTER TABLE device ADD COLUMN id TEXT;
UPDATE device SET id = lower(hex(randomblob(16))) WHERE id IS NULL;
CREATE UNIQUE INDEX device_id ON device(id);
