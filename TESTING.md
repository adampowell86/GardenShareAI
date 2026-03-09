# GardenShare AI Test Report

Date: February 26, 2026

## Automated Verification

### Server
Command:
```bash
cd server
npm test
```

Result:
- 14 tests passed
- 0 failed

Covered areas include:
- CSRF enforcement
- Auth and token refresh flow
- Inventory and trade flow
- Matching score behavior
- Timing flag generation

### Client
Command:
```bash
cd client
npm test -- --run
```

Result:
- 1 test file passed
- 0 failed

### Production Build
Command:
```bash
cd client
npm run build
```

Result:
- Build completed successfully

## Optional Performance Check
Command:
```bash
cd server
npm run bench:matching
```

Latest run:
- Scored 10,000 pairs in ~69.74ms
- Average ~0.0070ms per pair

## Notes
- Integration tests use `server/prisma/test.db`.
- CSRF is required for unsafe methods and exercised in tests.
- OAuth providers are optional and depend on environment keys.
