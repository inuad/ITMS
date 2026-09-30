# ITMS Postman Collection

Collection: [ITMS.postman_collection.json](ITMS.postman_collection.json) (v2.1). Environment: [ITMS.local.postman_environment.json](ITMS.local.postman_environment.json).

## Import และใช้งาน

1. เปิด Postman → Import ทั้ง Collection และ Local Environment แล้วเลือก `ITMS Local`.
2. รัน Backend/PostgreSQL/Redis ด้วย Compose ตาม [Root README](../../README.md#run). ตั้ง `baseUrl` เป็น origin ของ Backend โดยไม่มี slash ท้าย; ค่าเริ่มต้น `http://localhost:8080`.
3. Folder **1. Backend APIs (all endpoints)** ใช้ส่งทีละ request: API ธุรกิจครบ 8 เส้น พร้อม health/readiness/discovery อีก 3 เส้น. Create เก็บ `requestId` และ `requestVersion`; detail และ successful actions อัปเดตค่าให้อัตโนมัติ. Edit/Submit/Cancel ใช้ Employee; Approve/Reject ใช้ Approver.
4. Folder **2. Requirement tests (10 cases)** ใช้ Collection Runner เลือกเฉพาะ Folder นี้ เรียงตามไฟล์ และรัน **1 iteration**. มี TC01–TC10 รวม 49 requests เพราะแต่ละ case มี setup/actions/readback. แต่ละ case เริ่มจาก request แรกของกลุ่ม; ไม่ข้าม setup.

Folder 1 มี branches ที่เลือกใช้ตามสถานะ: Approve/Reject/Cancel ใช้กับคำขอแยกกัน จึงไม่ใช้ Run ทั้ง Collection. List มี page/size/sort พร้อม optional keyword/status/department ที่ปิดไว้ ให้เปิดในแท็บ Params เมื่อต้องการกรอง.

Operational endpoints มาจาก `spring-boot-starter-actuator` ที่มีอยู่เดิมใน [Backend pom.xml](../../backend/pom.xml). [application.yml](../../backend/src/main/resources/application.yml) เปิด health และ readiness group; [Docker Compose](../../docker-compose.yml) ใช้ `/actuator/health/readiness` เป็น backend healthcheck. Collection รวม `/actuator` (endpoint discovery), `/actuator/health` (สถานะรวม) และ `/actuator/health/readiness` (ความพร้อมของ application + DB) จึงมี 8 business + 3 operational endpoints; รอบสร้าง Collection ไม่ได้เพิ่ม dependency หรือ endpoints ใหม่.

ระบบจำลอง Login ด้วย `X-User-Role`/`X-User-Email`; ไม่มี login/token endpoint. Environment มี Employee A `somchai@example.com`, Employee B `suda@example.com`, Approver `arun@example.com` ตาม registry จริง. ไม่เปลี่ยน email เป็นบุคคลนอก registry. `requiredDate` คำนวณเป็นวันพรุ่งนี้ Asia/Bangkok ทุก request; case state/UUID/version เป็น Collection variables ที่ scripts จัดการเอง อย่าสร้าง Environment variables ชื่อ `tc01_*`–`tc09_*` หรือ `requestId`/`requestVersion` มาทับ.

## Requirement mapping

อิง [Backend scenarios 1–10 ในแผนที่อนุมัติ](../../docs/implementation-plan.md#automated-test-scenarios) และ [API contract](../../docs/api-contract.md).

| Case | Requirement และข้อมูลทดสอบ                                                                                               | ผลที่ตรวจ                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| TC01 | Create Draft: NOTEBOOK quantity 1 + MONITOR quantity 2; เพิ่ม invalid quantity 0/6                                       | 201, DRAFT/version 0, UUID/requestNumber/items, totalItems=3, อ่านกลับตรง response; invalid quantity → 400/fieldErrors        |
| TC02 | Create Draft items=[] แล้ว Submit                                                                                        | 422 BUSINESS_RULE_VIOLATION/fieldErrors.items; aggregate คงเดิม                                                               |
| TC03 | Create → Submit DRAFT → PENDING; ต่อด้วย Approve ที่ถูกต้อง                                                              | PENDING/version 1 → APPROVED/version 2; totalItems=3 และอ่านกลับ                                                              |
| TC04 | Approver พยายาม Approve DRAFT                                                                                            | 409 REQUEST_STATE_CONFLICT; aggregate คงเดิม                                                                                  |
| TC05 | Pending → Reject ด้วย reason เป็นช่องว่าง; ต่อด้วย reason ที่ถูกต้อง                                                     | 400 VALIDATION_ERROR/fieldErrors.reason; ไม่เปลี่ยนข้อมูลก่อน valid reject → REJECTED/version 2 และบันทึก reason              |
| TC06 | Pending → PUT edit                                                                                                       | 409 REQUEST_STATE_CONFLICT; aggregate คงเดิม                                                                                  |
| TC07 | GET detail ด้วย UUID ที่สร้างใหม่โดยไม่ได้บันทึก                                                                         | 404 REQUEST_NOT_FOUND และ unified error contract                                                                              |
| TC08 | Edit Draft ทำ version 0→1; stale edit/submit/cancel; Submit ทำ version 1→2; stale approve/reject; valid Cancel           | 409 REQUEST_VERSION_CONFLICT ครบห้า write paths; snapshot รวม fields/items/timestamps ไม่ถูกทับ; Cancel → CANCELLED/version 3 |
| TC09 | Owner A Draft/Pending, Owner B Draft และ decoy; keyword มี `%_!` + status + department; ตรวจ owner/Approver และ size=101 | AND filters + literal substring คืน A Draft ตัวเดียว, Approver เห็น A/B Draft, owner B อ่าน A → 403, invalid size → 400       |
| TC10 | Item ที่สองบันทึกล้มหลัง parent + item แรก; ใช้ fixture ตามด้านล่าง                                                      | 500 INTERNAL_ERROR แบบ generic, list ไม่มี partial request; **ต้องตรวจ DB witness≥1 และ parent/items=0 ผ่าน connection ใหม่** |

Error assertions ตรวจ timestamp/status/code/message/path/fieldErrors. Failed actions ตรวจ detail ทั้ง aggregate รวม version/timestamps/item IDs เพื่อยืนยันว่าไม่เปลี่ยนข้อมูล. ชุดนี้ทดสอบ HTTP contract กับระบบจริง; ไม่แทนที่ pure unit coverage ใน TEST-02 หรือ k6 ของ TEST-03.

## TC10: เตรียม fixture และตรวจ rollback จริง

ใช้ [rollback_fixture.py](rollback_fixture.py) ซึ่งนำรูปแบบ witness มาจาก [RollbackTest.kt](../../backend/src/test/kotlin/com/ttb/itms/RollbackTest.kt). ต้องมี Python 3, Docker CLI และ Compose DB ที่รันอยู่; helper ใช้ DB user/name จาก container ไม่มี credential เพิ่ม.

```sh
# จาก workspace root; สร้าง temporary trigger/function/sequence เฉพาะ UUID marker
python3 tests/postman/rollback_fixture.py prepare
```

Import Environment ที่ helper แสดง (`/private/tmp/itms-postman-rollback.postman_environment.json`) แล้วเลือก Environment นี้แทน Local. รันเฉพาะ Folder 2 ให้ครบ จากนั้น:

```sh
# ตรวจ witness และ 0 parents/0 items ด้วย connection ใหม่; finally cleanup แม้ assertion ล้ม
python3 tests/postman/rollback_fixture.py verify

# หากยกเลิกการทดสอบหลัง prepare ให้ cleanup โดยไม่ตรวจผล
python3 tests/postman/rollback_fixture.py cleanup
```

`verify` ลบ fixture และ Environment ชั่วคราวแล้ว ให้เลือก Local กลับ. การรันรอบใหม่ต้อง prepare ใหม่. หากยังไม่เตรียม fixture, TC10 แจ้ง script error และไม่ถือว่าทดสอบครบ 10 cases. HTTP 500/list ว่างอย่างเดียวไม่ยืนยันว่า DB เขียน parent/item ก่อน rollback; sequence witness ที่อยู่นอก transaction คือหลักฐานดังกล่าว.

Trigger ทำงานเฉพาะ specification ที่ตรง UUID marker; คงข้อมูลที่ทดสอบสำเร็จจาก TC01–09 ไว้ใน main tables สำหรับลอง UI ตามข้อตกลงเดิม. Helper ไม่ truncate/reset sequence/migrate DB; cleanup ลบเฉพาะ fixture ของ TC10 หาก rollback ผิดแล้วมี partial request. State file ป้องกัน prepare ซ้ำก่อน cleanup; ใช้ `--state /private/tmp/<unique-name>.json` เมื่อต้องแยก session และส่งค่าเดียวกันให้ prepare/verify/cleanup.

## Newman

หากเครื่องมี Newman อยู่แล้ว รันครบทั้งสิบ cases พร้อมเตรียม/ตรวจ/cleanup rollback อัตโนมัติ:

```sh
python3 tests/postman/rollback_fixture.py run
# เปลี่ยน Backend origin หรือ executable ได้
python3 tests/postman/rollback_fixture.py run --base-url http://localhost:8081 --newman /path/to/newman
```

หรือใช้ prepare → Newman → verify แบบแยกขั้น:

```sh
newman run tests/postman/ITMS.postman_collection.json \
  -e /private/tmp/itms-postman-rollback.postman_environment.json \
  --folder '2. Requirement tests (10 cases)' --iteration-count 1 --timeout-request 15000
```

Project ไม่เพิ่ม npm dependencies; Newman เป็นเครื่องมือภายนอกสำหรับตรวจไฟล์นี้. Scripts ใช้ `pm.collectionVariables`/`pm.variables` ตาม [Postman variable API](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-variables/). ผลรันและข้อจำกัดอยู่ใน [verification](verification_300926.md).
