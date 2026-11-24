# AAGAMAN MART Firestore Security Specification

## 1. Data Invariants
1. A customer profile `/customers/{customerId}` can only be created when `request.auth != null`, `request.auth.token.email_verified == true`, `customerId == request.auth.uid`, `uid == request.auth.uid`, `email == request.auth.token.email`, `isBlocked == false`, and server timestamps match `request.time`.
2. PII fields (`email`, `phone`, `name`) on `/customers/{customerId}` can ONLY be read (`get`) by the owning user (`request.auth.uid == customerId`) or a verified admin (`isAdmin()`).
3. Listing `/customers` is strictly restricted to verified admins (`isAdmin()`).
4. Customers cannot escalate privileges, modify `uid`, `email`, `authMethod`, `createdAt`, or clear `isBlocked` on update. Only `isAdmin()` may modify `isBlocked`.
5. `/storeConfig/main` is publicly readable via `get` for storefront rendering (`announcementText`, `headquarters`, `supportEmail`, `banners`, `deliveryConfig`) and writable only by `isAdmin()` with strict schema and bounded array (`banners.size() <= 10`, `deliveryConfig.pincodeRules.size() <= 100`) checks.
6. Client-supplied timestamps and shadow fields are rejected across all collections via `request.time` enforcement and `keys().hasAll(...) && keys().hasOnly(...)`.

## 2. Adversarial Payloads Covered ("Dirty Dozen")
1. Unauthenticated `get` / `list` on `/customers/{uid}`.
2. Cross-user `get` on `/customers/{otherUid}` by a signed-in non-admin customer.
3. Customer `create` with `isBlocked: true` or mismatched `uid`.
4. Customer `create` with spoofed `email != request.auth.token.email`.
5. Customer `create` with unverified email (`email_verified == false`).
6. Customer `create` with shadow field (e.g., `role: 'admin'`).
7. Customer `create` or `update` with client-forged `createdAt` / `updatedAt` timestamp != `request.time`.
8. Customer `update` attempting to set `isBlocked: false` when suspended.
9. Customer `update` attempting to mutate `createdAt`, `uid`, or `email`.
10. Customer `create` with oversized `name` (> 160 chars) or junk `customerId` (> 128 chars / invalid chars).
11. Non-admin attempt to write `/storeConfig/main`.
12. Non-admin attempt to write `/admins/{uid}` or create `/storeConfig/evil`.
