"""Prepare/verify TC10's marker-specific fixture on the existing Compose DB."""

import argparse
import json
from pathlib import Path
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
COLLECTION = ROOT / "tests/postman/ITMS.postman_collection.json"
FOLDER = "2. Requirement tests (10 cases)"


def sql(statement):
    return subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "sh", "-c",
         'psql -X -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
        cwd=ROOT, input=statement, text=True, capture_output=True, check=True,
    ).stdout.strip()


def load_marker(state):
    marker = json.loads(state.read_text())["marker"]
    if not re.fullmatch(r"postman_rb_[0-9a-f]{32}", marker):
        raise ValueError("Invalid fixture marker; refusing to execute SQL")
    return marker


def prepare(state, base_url):
    if state.exists():
        raise RuntimeError(f"Fixture already exists: use cleanup --state {state} first")
    marker = "postman_rb_" + uuid.uuid4().hex
    environment = state.with_suffix(".postman_environment.json")
    state.write_text(json.dumps({"marker": marker}) + "\n")
    try:
        # Same fail-after-parent-and-first-item witness as the existing RollbackTest.
        sql(f"""
BEGIN;
CREATE SEQUENCE public.{marker}_witness;
CREATE FUNCTION public.{marker}() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM equipment_requests
        WHERE id=NEW.request_id AND title='{marker}') THEN
        RAISE EXCEPTION 'Rollback probe did not observe its parent';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM equipment_request_items
        WHERE request_id=NEW.request_id AND specification='{marker}_first') THEN
        RAISE EXCEPTION 'Rollback probe did not observe its first item';
    END IF;
    -- nextval survives rollback: an unrelated HTTP 500 cannot satisfy this check.
    PERFORM nextval('public.{marker}_witness');
    RAISE EXCEPTION 'Deliberate Postman rollback item failure: {marker}';
END $$;
CREATE TRIGGER {marker} BEFORE INSERT ON equipment_request_items FOR EACH ROW
    WHEN (NEW.specification='{marker}') EXECUTE FUNCTION public.{marker}();
COMMIT;
""")
        env = json.loads((ROOT / "tests/postman/ITMS.local.postman_environment.json").read_text())
        env["name"] = "ITMS Local + TC10 rollback fixture"
        next(v for v in env["values"] if v["key"] == "baseUrl")["value"] = base_url.rstrip("/")
        env["values"].append({"key": "rollback_marker", "value": marker, "enabled": True, "type": "default"})
        environment.write_text(json.dumps(env, indent=2) + "\n")
    except BaseException:
        cleanup(state)
        raise
    print(f"Prepared {marker}; import environment: {environment}", flush=True)
    return environment


def verify(state):
    marker = load_marker(state)
    # This psql process is a fresh connection after the failed HTTP transaction.
    rows = sql(f"""
SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM public.{marker}_witness;
SELECT count(*) FROM equipment_requests WHERE title='{marker}';
SELECT count(*) FROM equipment_request_items WHERE specification IN ('{marker}', '{marker}_first');
""").splitlines()
    assert len(rows) == 3 and int(rows[0]) >= 1 and rows[1:] == ["0", "0"], rows
    print(f"PASS TC10 DB: witness={rows[0]}, parents=0, items=0 ({marker})", flush=True)


def cleanup(state):
    marker = load_marker(state)
    # Only this fixture's failed request is removed if a broken rollback saved it.
    sql(f"""
BEGIN;
DROP TRIGGER IF EXISTS {marker} ON equipment_request_items;
DROP FUNCTION IF EXISTS public.{marker}();
DROP SEQUENCE IF EXISTS public.{marker}_witness;
DELETE FROM equipment_requests WHERE title='{marker}';
COMMIT;
""")
    counts = sql(f"""
SELECT count(*) FROM pg_trigger WHERE tgname='{marker}';
SELECT count(*) FROM pg_proc WHERE proname='{marker}';
SELECT count(*) FROM pg_class WHERE relname='{marker}_witness';
SELECT count(*) FROM equipment_requests WHERE title='{marker}';
SELECT count(*) FROM equipment_request_items WHERE specification IN ('{marker}', '{marker}_first');
""").splitlines()
    assert counts == ["0"] * 5, counts
    state.with_suffix(".postman_environment.json").unlink(missing_ok=True)
    state.unlink()
    print("PASS cleanup: fixture trigger/function/sequence/parent/items absent; successful cases retained.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "verify", "cleanup", "run"])
    parser.add_argument("--state", type=Path, default=Path("/private/tmp/itms-postman-rollback.json"))
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--newman", default="newman", help="Newman executable, used by run")
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.state, args.base_url)
    elif args.command == "cleanup":
        cleanup(args.state)
    elif args.command == "verify":
        try:
            verify(args.state)
        finally:
            cleanup(args.state)
    else:
        environment = prepare(args.state, args.base_url)
        try:
            result = subprocess.run([
                args.newman, "run", str(COLLECTION), "-e", str(environment),
                "--folder", FOLDER, "--iteration-count", "1", "--timeout-request", "15000",
                "--reporters", "cli", "--color", "off",
            ], cwd=ROOT)
            verify(args.state)
            result.check_returncode()
        finally:
            cleanup(args.state)


if __name__ == "__main__":
    main()
