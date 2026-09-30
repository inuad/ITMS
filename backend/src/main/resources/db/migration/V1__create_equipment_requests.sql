-- V1: equipment_requests and equipment_request_items
-- REQ-YYYY-NNNNNN request number generated at insert time

-- Global sequence for request number (never resets per year, accepts gaps)
CREATE SEQUENCE equipment_request_number_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

CREATE TABLE equipment_requests (
    id              UUID            PRIMARY KEY,
    request_number  VARCHAR(20)     NOT NULL,
    employee_name   VARCHAR(100)    NOT NULL,
    employee_email  VARCHAR(255)    NOT NULL,
    department      VARCHAR(255)    NOT NULL,
    title           VARCHAR(150)    NOT NULL,
    purpose         VARCHAR(500)    NOT NULL,
    required_date   DATE            NOT NULL,
    additional_note VARCHAR(500),
    status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    rejection_reason TEXT,
    version         BIGINT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT uq_request_number UNIQUE (request_number)
);

CREATE TABLE equipment_request_items (
    id              UUID            PRIMARY KEY,
    request_id      UUID            NOT NULL,
    equipment_type  VARCHAR(20)     NOT NULL,
    quantity        INTEGER         NOT NULL,
    specification   VARCHAR(250),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT fk_item_request FOREIGN KEY (request_id) REFERENCES equipment_requests(id) ON DELETE CASCADE,
    CONSTRAINT chk_equipment_type CHECK (equipment_type IN ('NOTEBOOK', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET', 'OTHER')),
    CONSTRAINT chk_quantity CHECK (quantity >= 1 AND quantity <= 5)
);

-- Indexes for query patterns: owner/status/department/createdAt and item lookup
CREATE INDEX idx_requests_employee_email ON equipment_requests (employee_email);
CREATE INDEX idx_requests_status ON equipment_requests (status);
CREATE INDEX idx_requests_department ON equipment_requests (department);
CREATE INDEX idx_requests_created_at ON equipment_requests (created_at DESC);
CREATE INDEX idx_requests_employee_email_status ON equipment_requests (employee_email, status);
CREATE INDEX idx_items_request_id ON equipment_request_items (request_id);

-- Trigram index for keyword search on requestNumber/title/employeeName
-- pg_trgm provides case-insensitive substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_requests_request_number_trgm ON equipment_requests USING gin (request_number gin_trgm_ops);
CREATE INDEX idx_requests_title_trgm ON equipment_requests USING gin (title gin_trgm_ops);
CREATE INDEX idx_requests_employee_name_trgm ON equipment_requests USING gin (employee_name gin_trgm_ops);

-- Function to generate request number at insert time
-- Uses Asia/Bangkok timezone for year, global sequence, minimum 6-digit padding (never truncates)
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_val bigint;
    year_str text;
BEGIN
    seq_val := nextval('equipment_request_number_seq');
    year_str := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYY');
    NEW.request_number := 'REQ-' || year_str || '-' || lpad(seq_val::text, GREATEST(6, length(seq_val::text)), '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_request_number
    BEFORE INSERT ON equipment_requests
    FOR EACH ROW
    WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
    EXECUTE FUNCTION generate_request_number();
