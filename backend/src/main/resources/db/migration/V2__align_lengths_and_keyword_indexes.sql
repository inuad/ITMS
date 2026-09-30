-- V1 has already been applied; keep its checksum unchanged.
-- Department is free text; request numbers must fit the full bigint sequence.
ALTER TABLE equipment_requests ALTER COLUMN department TYPE TEXT;
DROP TRIGGER trg_generate_request_number ON equipment_requests;
ALTER TABLE equipment_requests ALTER COLUMN request_number TYPE VARCHAR(28);
CREATE TRIGGER trg_generate_request_number
    BEFORE INSERT ON equipment_requests
    FOR EACH ROW
    WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
    EXECUTE FUNCTION generate_request_number();

-- Match the LOWER(column) expressions used by the existing search query.
DROP INDEX idx_requests_request_number_trgm;
DROP INDEX idx_requests_title_trgm;
DROP INDEX idx_requests_employee_name_trgm;
CREATE INDEX idx_requests_request_number_trgm ON equipment_requests USING gin (lower(request_number) gin_trgm_ops);
CREATE INDEX idx_requests_title_trgm ON equipment_requests USING gin (lower(title) gin_trgm_ops);
CREATE INDEX idx_requests_employee_name_trgm ON equipment_requests USING gin (lower(employee_name) gin_trgm_ops);
