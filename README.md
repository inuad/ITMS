# IT Equipment Request Management System

## Environment

ระบบจริงมี Frontend, Backend, PostgreSQL และ Redis ใน Docker Compose. Frontend ใช้ real API เป็นค่าเริ่มต้นของ Compose; Login เป็นการเลือกตัวตนจำลอง.

ต้องมี Docker Desktop + Docker Compose. ตรวจบน Docker Desktop 4.43.2 / Engine 28.3.2 / Compose 2.38.2 (arm64); ไม่ต้องติดตั้ง Node/JDK บน host เพื่อรัน Compose.

- Frontend: Node 22.16.0, Next.js 16.3.7, React 19.3.0, TypeScript 5.9.3
- React Hook Form 7.89.0 / Zod 4.6.5 / resolvers 5.9.1; exact versions ใน package-lock.json
- Vitest 4.1.11 / React Testing Library 16.3.0 / jsdom 26.1.0
- Backend: JDK 21, Spring Boot 4.0.8, Kotlin 2.2.21, Maven 3.9.9; JUnit 5.14.4 / MockK 1.14.11
- PostgreSQL 17.9-bookworm / Redis 8.2.9-alpine / Caffeine ตาม Boot dependency management
- k6 runner 1.3.0 ใน Compose `performance` profile (แยกจาก startup ปกติ); ผล read/write scenarios อยู่ในหัวข้อ Test & API

## Run

รันจาก workspace root:

```sh
docker compose up -d --build --wait
docker compose ps
docker compose logs backend frontend
```

เปิด [Frontend](http://localhost:3000). API อยู่ [Backend](http://localhost:8080/api/v1/equipment-requests), ต้องส่ง identity headers; [readiness](http://localhost:8080/actuator/health/readiness) ตรวจ application + DB และไม่ผูกความพร้อมกับ Redis เพื่อให้ fallback ใช้งานได้.

เลือก Employee `somchai@example.com` หรือ `suda@example.com`; Approver `arun@example.com`. Employee จัดการเฉพาะคำขอตนเอง; Approver อ่านทั้งหมดและอนุมัติ/ปฏิเสธ Pending. มีข้อมูลจาก verification อยู่ในตารางหลักแล้ว เช่น `REQ-2026-000049` เป็น Approved จาก Browser workflow. DB ใหม่เริ่มว่างและสร้าง Draft ผ่าน UI ได้.

ทุก service bind เฉพาะ localhost. ค่าเริ่มต้น frontend 3000, backend 8080, PostgreSQL 5432, Redis 6379; DB/user/password `itms`. เปลี่ยนได้ด้วย FRONTEND_PORT/BACKEND_PORT/DB_PORT/REDIS_PORT และ DB_NAME/DB_USERNAME/DB_PASSWORD. ถ้าเปลี่ยน frontend/backend ports ต้องตั้ง CORS_ALLOWED_ORIGINS และ NEXT_PUBLIC_API_BASE_URL ให้ตรงด้วย เช่น:

```sh
FRONTEND_PORT=3001 BACKEND_PORT=8081 \
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:8081 docker compose up -d --build --wait
```

Frontend ใช้ Backend API จริงทุก endpoint ทั้ง host dev และ Compose; ค่าเริ่มต้น `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`. ไม่มี mock API, mode switch หรือ fallback ข้อมูลจำลอง. NEXT_PUBLIC_API_BASE_URL เป็น build-time configuration; browser API URL ต้องเป็น origin ที่ browser เข้าถึงได้. อย่าใช้ hostname `backend` ใน browser.

```sh
# Frontend host development (Node 22)
cd frontend
npm ci
npm run dev
```

Compose รอ PostgreSQL/Redis health ก่อนเริ่ม backend, Flyway migrate ก่อน JPA validate, frontend รอ backend readiness. Dockerfiles ใช้ non-root runtime. PostgreSQL ใช้ persistent volume; `docker compose down` คงข้อมูล. `down -v` ลบข้อมูลทั้งหมด ใช้เฉพาะเมื่อตั้งใจเริ่มใหม่ตามขั้นตอนด้านล่าง ไม่ใช้ในการตรวจทดสอบปกติ. ไม่ต้องเตรียม DB ด้วยมือ — migration scripts V1–V3 อยู่ที่ `backend/src/main/resources/db/migration/` และรันอัตโนมัติตอน backend start; V1/V2/V3 immutable, schema changes ต้องเพิ่ม migration ใหม่. โครงสร้างตาราง/constraints/indexes ปัจจุบันสรุปไว้ใน [SCHEMA.md](SCHEMA.md).

ล้างข้อมูลทั้งหมดเพื่อทดลองใหม่ (รันเองจาก workspace root): คำสั่งนี้ลบ PostgreSQL volume ของ Compose รวมทุก database, requests/items, Flyway history และ sequence อย่างถาวร. Containers ถูกสร้างใหม่จึงล้าง Redis/Caffeine cache ด้วย; Flyway สร้าง schema ใหม่อัตโนมัติ ไม่มี seed data และเลขคำขอเริ่มที่ `REQ-<ปีปัจจุบัน>-000001`. หากเปิด backend บน host ให้หยุด process นั้นก่อนและเริ่มใหม่หลัง reset.

```sh
docker compose down -v && docker compose up -d --wait
```

เปิดหรือ refresh [Frontend](http://localhost:3000) เพื่อสร้าง Draft ใหม่. การ reset แบบนี้เป็นการล้าง environment โดยผู้ใช้ แยกจาก cleanup fixture ของ automated tests ที่ยังคงลบเฉพาะข้อมูลของตนเอง.

## Test & API

```sh
docker compose --profile test run --build --rm frontend-test
docker compose --profile test run --build --rm backend-test
docker compose --profile performance run --rm k6 run /scripts/read-scenario.js
docker compose --profile performance run --rm k6 run /scripts/write-scenario.js
```

รันคำสั่งทั้งหมดจาก workspace root โดยเปิด Docker Desktop (คำสั่งแรกในหัวข้อ Run ต้องรันก่อนเพื่อให้ Backend/PostgreSQL พร้อม). ผลล่าสุด (2026-09-30): frontend **12 tests** ครอบคลุม 7 scenarios; backend **20 tests** ครอบคลุม 9 unit scenarios + 1 real HTTP/JDBC rollback scenario และ 6 checks เดิม ผ่านครบไม่มี skip ใน Compose. Backend test runner รอ Backend พร้อมและตั้ง TEST_BASE_URL ให้อัตโนมัติ; rollback ใช้ PostgreSQL หลักและลบ fixture ของตัวเองใน finally. รัน Maven บน host โดยไม่มี TEST_BASE_URL จะผ่าน 19 tests และ skip rollback 1 รายการ. รายละเอียดชุด backend อยู่ใน [TEST-02](docs/PHASE_3/task_2.md).

k6 สอง scenarios ผ่านทุก threshold (10 VUs/1 นาที, p95<500ms, failed<1%, checks>99%): baseline read **p(95)=13.12ms** / write **p(95)=26.74ms** และรอบยืนยันซ้ำวันเดียวกันบนระบบเงียบ read **p(95)=21.31ms** / write **p(95)=30.79ms** — failed 0.00% และ checks 100% ทุกรอบ. ทุก run เขียน HTML report อัตโนมัติไป `tests/performance/results/` และ k6 exit non-zero เมื่อ threshold ไม่ผ่าน. เงื่อนไข run, env override และประวัติทุกรอบอยู่ใน [tests/performance/README.md](tests/performance/README.md).

Backend แสดง `[SUITE]` และชื่อ `@DisplayName` ของแต่ละเคสพร้อม `[PASS]`, `[FAIL]`, `[SKIP]` หรือ `[ABORTED]`. Unit scenarios เรียง 1–9 พร้อมเคสย่อย 1b/1c/4b/6b; rollback มีหมายเลข 10 และ checks เดิมมีหัวข้อ suite แยก. ใช้คำสั่งเดิมด้านบนได้ทันที.

สคริปต์ตรวจรับแบบ one-off ของ Phase 2 (HTTP matrix, rollback probe, cache runtime) และ logs/verification ที่เกี่ยวของถูกลบออกแล้วหลังปิดงานตามคำสั่งผู้ใช้ เพราะชุด tests ด้านบนครอบคลุมการตรวจรับปัจจุบัน; บทสรุปผลที่ผ่านมาบันทึกไว้ใน [แผนงาน](docs/implementation-plan.md) และ [handoff](docs/handoff_300926.md).

การเก็บกวาดข้อมูลทดสอบ: RollbackTest (JUnit และ Postman TC10) ลบ fixture/trigger/function ของตัวเองใน finally ทุก run; successful fixtures จาก verification และ k6 เก็บไว้ตามข้อตกลงเพื่อทดลอง UI โดย k6 ใส่ marker ที่ `title` (`K6RD-…` อ่านอย่างเดียว, `K6WR-…` write workflow). ต้องการ reset เฉพาะข้อมูลทดสอบให้ลบเฉพาะ rows ที่ `title` ขึ้นต้นด้วย marker เหล่านั้นผ่าน SQL (items ลบตาม cascade) — ห้าม truncate tables หรือ reset sequence.

API base `/api/v1/equipment-requests`; ทุก call ส่ง `X-User-Role` และ `X-User-Email`. รายละเอียดอยู่ใน [API contract](docs/api-contract.md).

Postman: Import [Collection](tests/postman/ITMS.postman_collection.json) และ [Local Environment](tests/postman/ITMS.local.postman_environment.json). มีสอง folders: Backend APIs ครบ 8 business endpoints + 3 Actuator endpoints และ 10 requirement cases (49 setup/action/readback requests). อ่าน [วิธีรันและเตรียม rollback case](tests/postman/README.md); รันเฉพาะ Folder 2 พร้อม TC10 fixture แล้วตรวจ DB/cleanup ด้วย helper. Newman verification ผ่าน 49 requests/142 assertions (บันทึกใน [handoff](docs/handoff_300926.md)).

| Method | Suffix        | Input/ผลลัพธ์                                   |
| ------ | ------------- | ----------------------------------------------- |
| POST   | —             | Create Draft → 201 detail                       |
| GET    | —             | keyword/status/department/page/size/sort → page |
| GET    | /{id}         | detail                                          |
| PUT    | /{id}         | Draft fields + version                          |
| POST   | /{id}/submit  | version                                         |
| POST   | /{id}/approve | version                                         |
| POST   | /{id}/reject  | version + reason                                |
| POST   | /{id}/cancel  | version                                         |

Keyword เป็น literal substring แบบ case-insensitive ที่ requestNumber/title/employeeName; `%`, `_`, `!` เป็นตัวอักษรธรรมดา. Filters รวม AND; Employee owner scope ใช้ทุก query. Pagination page>=0, size 1–100, createdAt asc/desc; ID เป็น secondary order. totalItems=sum(quantity). Error มี timestamp/status/code/message/path/fieldErrors; stale version คืน 409 และ UI คงค่าที่กรอก. Create ไม่รับ status/requestNumber/version จาก client และ unknown fields คืน 400.

Host backend development (JDK 21):

```sh
docker compose up -d --wait postgres redis
# ตั้ง JAVA_HOME ให้ชี้ JDK 21; Homebrew/macOS:
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
cd backend
./mvnw -Dkotlin.compiler.daemon=false package
# หยุด backend container ก่อนถ้าใช้ port 8080 เดียวกัน
"$JAVA_HOME/bin/java" -jar target/itms-backend-0.1.0.jar
```

Root formatter: `npm ci`, `npm run format`, `npm run format:check`; Prettier 3.9.9 ใช้ tabs ขนาด 4, ข้าม build/generated files และ logs ตาม `.prettierignore`.

## Decisions

- Native fetch/React Hooks; แยก identity/UI state จาก API/form state. API client เรียก Backend จริงเสมอ; tests ใช้ HTTP response stubs เฉพาะในไฟล์ tests; AbortController ป้องกัน stale responses หลังเปลี่ยนผู้ใช้
- React Hook Form + Zod; native date input เทียบวัน Asia/Bangkok. totalItems เป็น derived value; ไม่เก็บซ้ำใน schema/state
- Backend service ตรวจ Role/owner/version/state; Request+Items transaction เดียว, JPA @Version รวม item-only edits. No-op edit คง version/timestamps/items เดิม. Timestamps ใช้ microsecond ให้ response ตรง PostgreSQL
- List ใช้ paginated Request query + count + grouped item totals หนึ่ง query; ไม่ fetch items ทีละ Request
- Redis detail ทุกสถานะ TTL 60s (request-id key); service ตรวจ owner แม้ cache hit. Caffeine list TTL 10s / maximum 500 entries; key รวม identity/role/query/page/size/sort
- ทุก successful write ล้าง detail + list หลัง commit; failed write/no-op ไม่ evict. Redis failure log และ fallback DB; หลัง eviction ล้ม bypass Redis detail reads/fills 60s ให้ old keys หมดอายุก่อนใช้ cache ต่อ
- Backend readiness ใช้ DB; Redis เป็น cache ที่ล้มแล้วระบบยังบันทึกได้. Redis จำกัด 128MB/allkeys-lru; ไม่มี requirement ให้ cache data durable
- JUnit 5 ใช้ pure unit tests/MockK; formal rollback test ใช้ external HTTP/JDBC กับ Backend/PostgreSQL จริง และไม่โหลด Spring TestContext

## Scope

- จำลอง Login เท่านั้น; headers ไม่ใช่ production authentication. ไม่มี password/JWT/users table
- Testing และ user trials ใช้ DB/tables หลักเดียวกัน พร้อมเก็บ successful fixtures; ไม่มี test DB/volume/table ใหม่ใน Phase นี้
- Backend หนึ่ง instance: Caffeine invalidation และ Redis failure bypass ไม่กระจายข้าม instances. Concurrent cache read/invalidation หรือ backend restart ระหว่าง Redis outage ยังอาจเห็นข้อมูลเก่าจน TTL หมด; write ทุกครั้งตรวจ DB และ version
- ข้อมูลคำขอทั้งหมดอ่าน/เขียนผ่าน Backend ลง PostgreSQL หลักและคงอยู่หลัง reload/restart; รายชื่อ Login จำลองยังใช้ตามขอบเขตที่ตกลง
- มี Postman Collection ตามคำสั่งเพิ่มเติมของผู้ใช้; ไม่มี E2E suite, Bonus integration suite, CI/CD หรือ deployment. Performance targets 10 VUs/1 minute ต่อ read/write scenario, p95<500ms, failed requests<1% ผ่านทั้งสอง scenarios (ผลอยู่ในหัวข้อ Test & API)
- Frontend/Backend/Testing ทุก Phase ผ่านครบ (TEST-01–04) พร้อม evidence จริง; Git repository เป็นงานส่งมอบที่ผู้รับโครงการ init/commit เอง. ดู [แผน](docs/implementation-plan.md) และ [handoff](docs/handoff_300926.md)
