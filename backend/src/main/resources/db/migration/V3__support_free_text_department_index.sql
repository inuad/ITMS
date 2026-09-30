-- Department has no length limit and is filtered by equality only.
-- Hash avoids the B-tree index row-size limit for long free-text values.
DROP INDEX idx_requests_department;
CREATE INDEX idx_requests_department ON equipment_requests USING hash (department);
