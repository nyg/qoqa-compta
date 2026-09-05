# Changelog


## [1.0.0](https://github.com/nyg/qoqa-compta/compare/v0.5.0..v1.0.0) - 2026-09-05

### ⛰️  Features

- [`3a7b923`](https://github.com/nyg/qoqa-compta/commit/3a7b923776cc253b013287ebf9c72b830b291c76) *(desktop)* Simplify the app icon so it reads at small sizes ([#166](https://github.com/nyg/qoqa-compta/issues/166))
- [`f515f18`](https://github.com/nyg/qoqa-compta/commit/f515f1850a6384bc5cb82e30bf3c71b05459bc04) *(db)* Create the SQLite file on first sync, not at startup ([#164](https://github.com/nyg/qoqa-compta/issues/164))
- [`d33fbc5`](https://github.com/nyg/qoqa-compta/commit/d33fbc5898e92e36378589c049d79db15b923fa1) *(app)* SQLite deletion, credential test, localised sync log and browser links ([#162](https://github.com/nyg/qoqa-compta/issues/162))
- [`43549d0`](https://github.com/nyg/qoqa-compta/commit/43549d039e1a506fd41f3833a9a5002b7b0e2100) *(secrets)* Make Windows a verified credential-store platform ([#159](https://github.com/nyg/qoqa-compta/issues/159))

### 🐛 Bug Fixes

- [`c38eca2`](https://github.com/nyg/qoqa-compta/commit/c38eca282cfc2daa7abbcf5f906abae99666a8c7) *(calendar)* Replace the native month/year select with a Base UI Select ([#168](https://github.com/nyg/qoqa-compta/issues/168))

### 📚 Documentation

- [`64693e9`](https://github.com/nyg/qoqa-compta/commit/64693e949932a88c3040708e673f0ecff74ed8f8) State that the project is unaffiliated with QoQa ([#165](https://github.com/nyg/qoqa-compta/issues/165))
- [`efa34ad`](https://github.com/nyg/qoqa-compta/commit/efa34ad82653c80971bd12139e8ca7126da2d853) Inventory every storage location and refresh the stale references ([#163](https://github.com/nyg/qoqa-compta/issues/163))

## [0.5.0](https://github.com/nyg/qoqa-compta/compare/v0.4.0..v0.5.0) - 2026-09-02

### ⛰️  Features

- [`8c1a737`](https://github.com/nyg/qoqa-compta/commit/8c1a737b8cf9fc162d246187330780007bcbca56) *(db)* Create the schema on sync, not on save, and store the PostgreSQL URL in the credential store ([#155](https://github.com/nyg/qoqa-compta/issues/155))
- [`c8b5e98`](https://github.com/nyg/qoqa-compta/commit/c8b5e98b46bb2d8cc1deaaf8114e08366a79f30a) *(settings)* OS credential store, tabbed Settings, and a PostgreSQL fix ([#153](https://github.com/nyg/qoqa-compta/issues/153))
- [`2cb7084`](https://github.com/nyg/qoqa-compta/commit/2cb70847c90cd7f510d80cfb79a29bc798fdbef8) *(db)* Make schema.ts the single source of truth via Drizzle migrations ([#150](https://github.com/nyg/qoqa-compta/issues/150))

### 🐛 Bug Fixes

- [`30c8cf2`](https://github.com/nyg/qoqa-compta/commit/30c8cf2e0864ea39abb3337a04d1ab7362c03bc3) *(deps)* Update all stable non-major dependencies ([#158](https://github.com/nyg/qoqa-compta/issues/158))
- [`bdde3f7`](https://github.com/nyg/qoqa-compta/commit/bdde3f791d80aad0130133d8b382efffa1a26f94) *(types)* Give test files their own tsconfig project ([#148](https://github.com/nyg/qoqa-compta/issues/148))
- [`c723305`](https://github.com/nyg/qoqa-compta/commit/c72330591fc4b7a2e3c4c4233c528ba1c8537ca2) *(db)* Read DATABASE_URL only in drizzle.config.ts ([#143](https://github.com/nyg/qoqa-compta/issues/143))
- [`f2bc15f`](https://github.com/nyg/qoqa-compta/commit/f2bc15f7c619e22260f4b97f6d2a84032d8173a4) *(desktop)* Close the macOS installer panel automatically ([#138](https://github.com/nyg/qoqa-compta/issues/138))

### 🚜 Refactor

- [`8ccb34e`](https://github.com/nyg/qoqa-compta/commit/8ccb34e8a57115888dd87258996419fe6051cf2d) *(queries)* Restore Drizzle result typing ([#147](https://github.com/nyg/qoqa-compta/issues/147))
- [`65c1ce5`](https://github.com/nyg/qoqa-compta/commit/65c1ce537cb8af1e61ae87efbb5e23a2e30302bd) Type the Electrobun and Recharts call sites without any ([#142](https://github.com/nyg/qoqa-compta/issues/142))

### 📚 Documentation

- [`6ad6773`](https://github.com/nyg/qoqa-compta/commit/6ad6773aa5f184df1532cf749cca38cdb0161f15) Correct the documented @/* path alias target ([#140](https://github.com/nyg/qoqa-compta/issues/140))

### 🧪 Testing

- [`67f91f2`](https://github.com/nyg/qoqa-compta/commit/67f91f2b26f4d5f3dafe833f932160ffa4b473df) Cover the universe selection model, locale and paths ([#146](https://github.com/nyg/qoqa-compta/issues/146))

### ⚙️ Miscellaneous

- [`6d04b98`](https://github.com/nyg/qoqa-compta/commit/6d04b98b57c690c29ddcf65a976e61634e10c69d) *(types)* Tighten tsconfig strictness ([#149](https://github.com/nyg/qoqa-compta/issues/149))
- [`4c10306`](https://github.com/nyg/qoqa-compta/commit/4c103061facfaecfc1736717dd8a0caf690093da) *(types)* Give each runtime its own tsconfig ([#145](https://github.com/nyg/qoqa-compta/issues/145))
- [`c5c18ee`](https://github.com/nyg/qoqa-compta/commit/c5c18ee86d077cee7f318720f10a0b80d4cf7b2f) *(build)* Drop the inert es-toolkit ESM shim ([#144](https://github.com/nyg/qoqa-compta/issues/144))
- [`f545aaa`](https://github.com/nyg/qoqa-compta/commit/f545aaa3d7700431ef8bfc94911ad694ab3ba44b) Run typecheck, lint and build on pull requests ([#141](https://github.com/nyg/qoqa-compta/issues/141))
- [`1df01bd`](https://github.com/nyg/qoqa-compta/commit/1df01bd5aa349b69a5030b4967cf6635f45840f1) *(deps)* Drop the unused unpdf and @types/three packages ([#139](https://github.com/nyg/qoqa-compta/issues/139))

## [0.4.0](https://github.com/nyg/qoqa-compta/compare/v0.3.0..v0.4.0) - 2026-08-24

### ⛰️  Features

- [`3ab8099`](https://github.com/nyg/qoqa-compta/commit/3ab80996d0170ca4fa29ec7ecebb7b46e4da7264) *(about)* Show the update path that matches the install ([#122](https://github.com/nyg/qoqa-compta/issues/122))

## [0.3.0](https://github.com/nyg/qoqa-compta/compare/v0.2.1..v0.3.0) - 2026-08-24

### ⛰️  Features

- [`eb01d40`](https://github.com/nyg/qoqa-compta/commit/eb01d40f4d3455d6a116d553e9ceb51db28abc1e) *(ui)* Pick the date range with a shadcn calendar ([#118](https://github.com/nyg/qoqa-compta/issues/118))

### 🐛 Bug Fixes

- [`3c72251`](https://github.com/nyg/qoqa-compta/commit/3c72251f0cfd792b81f9411b11c06debe339af74) *(desktop)* Drop the Windows menu bar ([#117](https://github.com/nyg/qoqa-compta/issues/117))
- [`6f195b8`](https://github.com/nyg/qoqa-compta/commit/6f195b8535108a6d2b88948367ffa3541771b5d0) *(release)* Stop publishing the Windows setup ZIP ([#116](https://github.com/nyg/qoqa-compta/issues/116))

## [0.2.1](https://github.com/nyg/qoqa-compta/compare/v0.2.0..v0.2.1) - 2026-08-23

### 🐛 Bug Fixes

- [`68e9c74`](https://github.com/nyg/qoqa-compta/commit/68e9c74741ccc3a268daa687f62465326239dea4) *(desktop)* Let the API server take an OS-assigned port ([#113](https://github.com/nyg/qoqa-compta/issues/113))
- [`7ed9438`](https://github.com/nyg/qoqa-compta/commit/7ed9438b9bfd97364aa6967296c58bb6f0ebf237) *(desktop)* Quieter Windows shell, an About dialog and an update check ([#109](https://github.com/nyg/qoqa-compta/issues/109))
- [`0c0f6c6`](https://github.com/nyg/qoqa-compta/commit/0c0f6c65a46bb4ec6ca009c565e88895b1f9eab1) *(dashboard)* Stop the orders table flickering and clarify the filter labels ([#107](https://github.com/nyg/qoqa-compta/issues/107))
- [`cca5ab5`](https://github.com/nyg/qoqa-compta/commit/cca5ab5091a4407e9485a6c6810528460b4ebc5c) *(dashboard)* Make universe selection explicit and fix assorted UI issues ([#105](https://github.com/nyg/qoqa-compta/issues/105))
- [`f4cda07`](https://github.com/nyg/qoqa-compta/commit/f4cda07214cce556eae18c952d30537dc698e3a6) *(settings)* Give the interface language a single source of truth ([#104](https://github.com/nyg/qoqa-compta/issues/104))

### ⚙️ Miscellaneous

- [`3a4c837`](https://github.com/nyg/qoqa-compta/commit/3a4c837f5654bd9330312d0ceef8b8bd445eb717) *(release)* Ship Windows as a single-file installer ([#110](https://github.com/nyg/qoqa-compta/issues/110))
- [`09b91bd`](https://github.com/nyg/qoqa-compta/commit/09b91bde77b790a7383a72d63251436e270f3cc4) *(desktop)* Migrate to Electrobun 2 ([#108](https://github.com/nyg/qoqa-compta/issues/108))

## [0.2.0](https://github.com/nyg/qoqa-compta/compare/v0.1.2..v0.2.0) - 2026-08-07

### ⛰️  Features

- [`ec52a01`](https://github.com/nyg/qoqa-compta/commit/ec52a01f488347bbae684fdcdb476cb7c360f733) *(desktop)* Remember window geometry and open without the maximize animation ([#103](https://github.com/nyg/qoqa-compta/issues/103))
- [`eff1f8b`](https://github.com/nyg/qoqa-compta/commit/eff1f8bd4e90b2d10be1494eceeea9b7cf7ad6ea) Keep every sub-universe an order is tagged with ([#102](https://github.com/nyg/qoqa-compta/issues/102))

### 🐛 Bug Fixes

- [`bb901a6`](https://github.com/nyg/qoqa-compta/commit/bb901a60f4893beb1c0631aea802144a69e66f96) *(lint)* Add flat ESLint config and repair the lint script ([#101](https://github.com/nyg/qoqa-compta/issues/101))
- [`60abc4d`](https://github.com/nyg/qoqa-compta/commit/60abc4d1fed30f6e40febe0621a6ce1e8898e733) *(format)* Respect the user's locale, resolving the region from the host ([#98](https://github.com/nyg/qoqa-compta/issues/98))
- [`7750032`](https://github.com/nyg/qoqa-compta/commit/7750032aeff63cc01dc273c43289f1009896bd35) *(deps)* Update dependency hono to v4.12.34 [security] ([#96](https://github.com/nyg/qoqa-compta/issues/96))

### ⚙️ Miscellaneous

- [`ec25faa`](https://github.com/nyg/qoqa-compta/commit/ec25faa561d422ae4bd7e00b2b909387615192e2) Retry GitHub release creation on transient API failures ([#97](https://github.com/nyg/qoqa-compta/issues/97))
- [`2051047`](https://github.com/nyg/qoqa-compta/commit/20510476e48944e52c921f90f175fe26606a8e13) *(deps)* Lock file maintenance ([#95](https://github.com/nyg/qoqa-compta/issues/95))

## [0.1.2](https://github.com/nyg/qoqa-compta/compare/v0.1.1..v0.1.2) - 2026-08-03

### 🐛 Bug Fixes

- [`5b53b58`](https://github.com/nyg/qoqa-compta/commit/5b53b584b6182090ba2a67efd0a74dd7b619f412) Give the Scoop bin entry an alias ([#94](https://github.com/nyg/qoqa-compta/issues/94))

### ⚙️ Miscellaneous

- [`44be039`](https://github.com/nyg/qoqa-compta/commit/44be039ee4bdd79819e044befde1d87721c754eb) *(deps)* Lock file maintenance ([#93](https://github.com/nyg/qoqa-compta/issues/93))
- [`92fd965`](https://github.com/nyg/qoqa-compta/commit/92fd965c6efa90411b2aa51c68bf8c0cac2265d5) *(deps)* Lock file maintenance ([#92](https://github.com/nyg/qoqa-compta/issues/92))
- [`f4ea1c8`](https://github.com/nyg/qoqa-compta/commit/f4ea1c8212b9faee44485b5b3275a17f7c2c1ca9) *(deps)* Lock file maintenance ([#91](https://github.com/nyg/qoqa-compta/issues/91))

## [0.1.1](https://github.com/nyg/qoqa-compta/compare/v0.1.0..v0.1.1) - 2026-08-03

### ⛰️  Features

- [`af11b0b`](https://github.com/nyg/qoqa-compta/commit/af11b0b2773d1c3dcb628da8fe7753ce3661892e) Version release assets and name data dirs after the app ([#90](https://github.com/nyg/qoqa-compta/issues/90))

### ⚙️ Miscellaneous

- [`9fc71bf`](https://github.com/nyg/qoqa-compta/commit/9fc71bf9a9c96483f3c88a0202ce6866963f3920) *(deps)* Lock file maintenance ([#89](https://github.com/nyg/qoqa-compta/issues/89))
- [`aefc36b`](https://github.com/nyg/qoqa-compta/commit/aefc36b81679f87ebf1174a2bf711ad37c6aebc4) *(deps)* Lock file maintenance ([#88](https://github.com/nyg/qoqa-compta/issues/88))
- [`d8f4f7b`](https://github.com/nyg/qoqa-compta/commit/d8f4f7bcf70c6ad3b9939d647a04741123c47472) *(deps)* Lock file maintenance ([#87](https://github.com/nyg/qoqa-compta/issues/87))

## [0.1.0](https://github.com/nyg/qoqa-compta/compare/v0.0.11..v0.1.0) - 2026-08-02

### ⛰️  Features

- [`2bfa772`](https://github.com/nyg/qoqa-compta/commit/2bfa7722911c57e2c7f0d6c92aa60080b5167359) Distribute Windows builds via Scoop ([#84](https://github.com/nyg/qoqa-compta/issues/84))

### 🐛 Bug Fixes

- [`d8daeea`](https://github.com/nyg/qoqa-compta/commit/d8daeeaad938370feb0ec17ede3988643397bd4f) Universe grouping, desktop downloads, invoice backfill, sync shortcut ([#85](https://github.com/nyg/qoqa-compta/issues/85))
- [`47cd80d`](https://github.com/nyg/qoqa-compta/commit/47cd80d1d2ef0a2154e31a70f3758b6a67bf0055) *(deps)* Update all stable non-major dependencies ([#86](https://github.com/nyg/qoqa-compta/issues/86))
- [`d8cd341`](https://github.com/nyg/qoqa-compta/commit/d8cd341d4efb3c628670472028c6105f1c61ebbf) *(deps)* Update dependency react-router to v8.3.0 [security] ([#83](https://github.com/nyg/qoqa-compta/issues/83))
- [`af1fed5`](https://github.com/nyg/qoqa-compta/commit/af1fed5e12616d3eaab110bb5aadd0c6aad79b95) *(deps)* Update dependency lucide-react to v1.22.0 ([#76](https://github.com/nyg/qoqa-compta/issues/76))
- [`353106c`](https://github.com/nyg/qoqa-compta/commit/353106c7c531b653101721a71171f6c1c90b4be1) *(deps)* Update all stable non-major dependencies ([#75](https://github.com/nyg/qoqa-compta/issues/75))
- [`3089a38`](https://github.com/nyg/qoqa-compta/commit/3089a386ba01f24b629ae1686a3abd75fc5013c8) *(deps)* Update react-router monorepo to v8 ([#73](https://github.com/nyg/qoqa-compta/issues/73))
- [`791c82c`](https://github.com/nyg/qoqa-compta/commit/791c82c4c22109318a315bb0616fd768df340117) *(deps)* Update dependency hono to v4.12.25 [security] ([#71](https://github.com/nyg/qoqa-compta/issues/71))
- [`18d21b7`](https://github.com/nyg/qoqa-compta/commit/18d21b73e5ab5a8b1757352188eab99093876668) *(deps)* Update all stable non-major dependencies ([#63](https://github.com/nyg/qoqa-compta/issues/63))

### ⚙️ Miscellaneous

- [`be7e048`](https://github.com/nyg/qoqa-compta/commit/be7e048b39804d6ed9305ac2b535a21f7be74c1a) *(deps)* Update dependency typescript to v7 ([#82](https://github.com/nyg/qoqa-compta/issues/82))
- [`ecb3e97`](https://github.com/nyg/qoqa-compta/commit/ecb3e97bc257f175f563256a451ece03f107914b) *(deps)* Lock file maintenance ([#81](https://github.com/nyg/qoqa-compta/issues/81))
- [`1180796`](https://github.com/nyg/qoqa-compta/commit/11807961ab3234abe54856b3f8eda99657a49a9e) *(deps)* Lock file maintenance ([#80](https://github.com/nyg/qoqa-compta/issues/80))
- [`9c15744`](https://github.com/nyg/qoqa-compta/commit/9c15744fe957d581ba837efaf07e3698b299b7bb) *(deps)* Lock file maintenance ([#79](https://github.com/nyg/qoqa-compta/issues/79))
- [`5b94d8b`](https://github.com/nyg/qoqa-compta/commit/5b94d8b0d3996ff942c9c125fd191a5883f2cad7) *(deps)* Lock file maintenance ([#78](https://github.com/nyg/qoqa-compta/issues/78))
- [`1459549`](https://github.com/nyg/qoqa-compta/commit/1459549b08e5fbd2c5bf2a83726ed575fe22c909) *(deps)* Lock file maintenance ([#77](https://github.com/nyg/qoqa-compta/issues/77))
- [`9f461a2`](https://github.com/nyg/qoqa-compta/commit/9f461a2f1c287a4b2a7108c62f094493387b69f3) Add MIT license ([#74](https://github.com/nyg/qoqa-compta/issues/74))
- [`7fc923d`](https://github.com/nyg/qoqa-compta/commit/7fc923df4cf40ee8a45d75c811e661e3f6e0c965) *(deps)* Update actions/checkout action to v7 ([#72](https://github.com/nyg/qoqa-compta/issues/72))
- [`61ddcce`](https://github.com/nyg/qoqa-compta/commit/61ddccee63f9b5fa5309a74abae2c7386756fac4) *(deps)* Update dependency vite to v8.0.16 [security] ([#70](https://github.com/nyg/qoqa-compta/issues/70))
- [`833dd49`](https://github.com/nyg/qoqa-compta/commit/833dd49cbd30bbc0e1791f8b0c57cdf1f4644c0b) *(deps)* Update dependency concurrently to v10 ([#62](https://github.com/nyg/qoqa-compta/issues/62))
- [`a6ded79`](https://github.com/nyg/qoqa-compta/commit/a6ded796ca2713e36843a2e0ce623dd0c8d26226) Add packageManager field for Renovate Bun version detection ([#69](https://github.com/nyg/qoqa-compta/issues/69))
- [`fc7606e`](https://github.com/nyg/qoqa-compta/commit/fc7606ec1a30c72765e7ac6cf899b6810a0f9a45) *(deps)* Pin dependencies ([#64](https://github.com/nyg/qoqa-compta/issues/64))
- [`d79c2c7`](https://github.com/nyg/qoqa-compta/commit/d79c2c7e5b15f5074b0eed1ed47f9fcdabbc01d9) *(deps)* Lock file maintenance ([#68](https://github.com/nyg/qoqa-compta/issues/68))
- [`07e3f24`](https://github.com/nyg/qoqa-compta/commit/07e3f245035c535d21c7b135390364ae0fe9637c) *(deps)* Update actions/checkout digest to df4cb1c ([#67](https://github.com/nyg/qoqa-compta/issues/67))
- [`183b757`](https://github.com/nyg/qoqa-compta/commit/183b7573370383aba70d890d8626704488d955ce) *(deps)* Lock file maintenance ([#66](https://github.com/nyg/qoqa-compta/issues/66))
- [`376b9e6`](https://github.com/nyg/qoqa-compta/commit/376b9e6a47b94e01aa657e9d1cf110b22e02ea21) *(deps)* Lock file maintenance ([#65](https://github.com/nyg/qoqa-compta/issues/65))

## [0.0.11](https://github.com/nyg/qoqa-compta/compare/v0.0.10..v0.0.11) - 2026-05-30

### ⛰️  Features

- [`8ef6df9`](https://github.com/nyg/qoqa-compta/commit/8ef6df9b6a68da6c5ff33b9576754c0efb749052) Dispatch cask update to homebrew-tap on release ([#60](https://github.com/nyg/qoqa-compta/issues/60))

## [0.0.10](https://github.com/nyg/qoqa-compta/compare/v0.0.9..v0.0.10) - 2026-05-30

### 🐛 Bug Fixes

- [`c681809`](https://github.com/nyg/qoqa-compta/commit/c681809424101d3967442b3829653ed1f799a4b1) Open external links in default system browser ([#59](https://github.com/nyg/qoqa-compta/issues/59))

## [0.0.9](https://github.com/nyg/qoqa-compta/compare/v0.0.8..v0.0.9) - 2026-05-21

### ⚙️ Miscellaneous

- [`2103627`](https://github.com/nyg/qoqa-compta/commit/2103627fc97be9a27443fd1812297521fbb58e39) Add git-cliff changelog generation ([#58](https://github.com/nyg/qoqa-compta/issues/58))

## [0.0.8](https://github.com/nyg/qoqa-compta/compare/v0.0.7..v0.0.8) - 2026-05-18

### ⛰️  Features

- [`3cf25be`](https://github.com/nyg/qoqa-compta/commit/3cf25be5aab32a24876b8732a735dfe5c2ce18a2) Screenshot in README, offer link in orders table, DB path in web settings ([#56](https://github.com/nyg/qoqa-compta/issues/56))
- [`1f3d12f`](https://github.com/nyg/qoqa-compta/commit/1f3d12f18890a92bf22a7d73202990039857590d) Desktop UX improvements ([#55](https://github.com/nyg/qoqa-compta/issues/55))

### 📚 Documentation

- [`072f226`](https://github.com/nyg/qoqa-compta/commit/072f226aa31c4fb74cc601229ef1b2c13c699b5d) Misc updates ([#57](https://github.com/nyg/qoqa-compta/issues/57))

## [0.0.7](https://github.com/nyg/qoqa-compta/compare/v0.0.6..v0.0.7) - 2026-05-15

### 🐛 Bug Fixes

- [`6b1f434`](https://github.com/nyg/qoqa-compta/commit/6b1f4349d3500df50eb7df211f1486e66709f3c3) *(release)* Ship Windows zip directly instead of wrapping in NSIS ([#54](https://github.com/nyg/qoqa-compta/issues/54))

## [0.0.6](https://github.com/nyg/qoqa-compta/compare/v0.0.5..v0.0.6) - 2026-05-15

### 🐛 Bug Fixes

- [`ae7ca6c`](https://github.com/nyg/qoqa-compta/commit/ae7ca6c08a691781261026f19413b352f65dbfd6) *(release)* Install NSIS on Windows runner ([#53](https://github.com/nyg/qoqa-compta/issues/53))

## [0.0.5](https://github.com/nyg/qoqa-compta/compare/v0.0.4..v0.0.5) - 2026-05-15

### 🐛 Bug Fixes

- [`1a14ddb`](https://github.com/nyg/qoqa-compta/commit/1a14ddba088ae86629ff52a89d76ea051f044c4c) *(release)* Wrap Windows artifacts in NSIS installer ([#52](https://github.com/nyg/qoqa-compta/issues/52))

## [0.0.4](https://github.com/nyg/qoqa-compta/compare/v0.0.3..v0.0.4) - 2026-05-15

### 🐛 Bug Fixes

- [`9eb0328`](https://github.com/nyg/qoqa-compta/commit/9eb0328be1ca1fbae58502a08606f730aec7dd0f) Misc UI and release workflow fixes ([#51](https://github.com/nyg/qoqa-compta/issues/51))

## [0.0.3](https://github.com/nyg/qoqa-compta/compare/v0.0.2..v0.0.3) - 2026-05-14

### ⚙️ Miscellaneous

- [`d29c38c`](https://github.com/nyg/qoqa-compta/commit/d29c38c8ae21ce211017c321f40bccebdc1f39f9) *(ci)* Drop deprecated macos-13 runner from release matrix ([#50](https://github.com/nyg/qoqa-compta/issues/50))

## 0.0.2 - 2026-05-14

### ⛰️  Features

- [`2ebda50`](https://github.com/nyg/qoqa-compta/commit/2ebda506e2dc3ecf7cdf2d4eb1001fc783fc3458) Add ElectroBun desktop integration and release workflow ([#42](https://github.com/nyg/qoqa-compta/issues/42))
- [`f6b17b4`](https://github.com/nyg/qoqa-compta/commit/f6b17b4a1f2e0cdde9e3e54ebacb31aabad454c1) Refactor to Vite SPA + Hono/Bun backend (ElectroBun-ready) ([#36](https://github.com/nyg/qoqa-compta/issues/36))
- [`fc0f0bb`](https://github.com/nyg/qoqa-compta/commit/fc0f0bb939f812ac8056f2126f2ef9422febce0f) Add spending repartition pie chart ([#32](https://github.com/nyg/qoqa-compta/issues/32))
- [`7d6cef5`](https://github.com/nyg/qoqa-compta/commit/7d6cef567f3014f843a642f297dd72f7d0f60f4b) In-app invoice PDF viewer ([#31](https://github.com/nyg/qoqa-compta/issues/31))
- [`0cb04b8`](https://github.com/nyg/qoqa-compta/commit/0cb04b830ac82585b6162954cc087f87774491ee) Universe/subuniverse overhaul with hierarchical picker ([#29](https://github.com/nyg/qoqa-compta/issues/29))
- [`dbdde75`](https://github.com/nyg/qoqa-compta/commit/dbdde7573d1f669722cd9527e3ecdd4da0c71b20) Rename offer_category→universe, add qoqa_universes lookup table ([#28](https://github.com/nyg/qoqa-compta/issues/28))
- [`9fb592f`](https://github.com/nyg/qoqa-compta/commit/9fb592f90d703ca9f088dbc69cb78a0654d1b352) Add multi-select category filter to dashboard ([#25](https://github.com/nyg/qoqa-compta/issues/25))
- [`85e7c5a`](https://github.com/nyg/qoqa-compta/commit/85e7c5a756dcaf4f07d5753aef623ede98033035) Add i18n support (EN/DE/FR/IT/Romansh) ([#22](https://github.com/nyg/qoqa-compta/issues/22))
- [`e7706fc`](https://github.com/nyg/qoqa-compta/commit/e7706fcc7a07917b322da50e82c0af6b3a4bb23e) Enrich orders schema, add UI columns, locale-aware formatting, and QoQa branding ([#21](https://github.com/nyg/qoqa-compta/issues/21))
- [`e883bea`](https://github.com/nyg/qoqa-compta/commit/e883beafa442e5a0d714ce653265116bfcf0ce22) SQLite as default local DB, PostgreSQL optional ([#18](https://github.com/nyg/qoqa-compta/issues/18))
- [`df68f6a`](https://github.com/nyg/qoqa-compta/commit/df68f6a4b26ad1c7ca3068a1efa9d1f63d53a26e) Switch crawler to API-driven sync (no page scraping) ([#10](https://github.com/nyg/qoqa-compta/issues/10))
- [`25188d1`](https://github.com/nyg/qoqa-compta/commit/25188d1015a86665666d6a9a9ab06c11dffa48ed) Initial project setup ([#1](https://github.com/nyg/qoqa-compta/issues/1))

### 🐛 Bug Fixes

- [`21e26ab`](https://github.com/nyg/qoqa-compta/commit/21e26ab6db18922da1a6613543af0bbf1dee0df3) *(deps)* Pin dependencies ([#30](https://github.com/nyg/qoqa-compta/issues/30))
- [`64d3e7d`](https://github.com/nyg/qoqa-compta/commit/64d3e7dbd2cccc64007c5f18d0c02216325a99a4) *(deps)* Update dependency next to v16.2.6 [security] ([#34](https://github.com/nyg/qoqa-compta/issues/34))
- [`4330375`](https://github.com/nyg/qoqa-compta/commit/4330375a5be9c2ca9ca542bef1a19b2594c81a20) *(deps)* Pin dependencies ([#27](https://github.com/nyg/qoqa-compta/issues/27))
- [`42faa24`](https://github.com/nyg/qoqa-compta/commit/42faa248cd845f5f29b3ae993e49ee54477f9f36) Convert StatsCards to server component ([#23](https://github.com/nyg/qoqa-compta/issues/23))
- [`458964e`](https://github.com/nyg/qoqa-compta/commit/458964ee5b50a58fd9bda6b519ad4de8238d640f) *(deps)* Update all stable non-major dependencies ([#16](https://github.com/nyg/qoqa-compta/issues/16))
- [`12ce50a`](https://github.com/nyg/qoqa-compta/commit/12ce50a693d1c9f4733e576d328f547dc1bd72ad) *(deps)* Update dependency next to v16.2.3 [security] ([#13](https://github.com/nyg/qoqa-compta/issues/13))
- [`8fb331d`](https://github.com/nyg/qoqa-compta/commit/8fb331d974415bd670fa23b555e288e7819fadc2) *(deps)* Pin dependencies ([#7](https://github.com/nyg/qoqa-compta/issues/7))

### 🚜 Refactor

- [`13a2eb8`](https://github.com/nyg/qoqa-compta/commit/13a2eb8b8d3bbb2f248dfb2311839c5b28f1d891) *(crawler)* Replace SeleniumBase with pure requests auth ([#35](https://github.com/nyg/qoqa-compta/issues/35))
- [`f4270fe`](https://github.com/nyg/qoqa-compta/commit/f4270fe84379871d31e38645e7968859a951c1ee) Pnpm, English, dep upgrades, env cleanup ([#8](https://github.com/nyg/qoqa-compta/issues/8))

### 📚 Documentation

- [`d94f418`](https://github.com/nyg/qoqa-compta/commit/d94f418414d3171f05219fb376cede40792cedf4) Update for Bun/Hono/Vite refactor ([#40](https://github.com/nyg/qoqa-compta/issues/40))
- [`fb7c347`](https://github.com/nyg/qoqa-compta/commit/fb7c347519eb304dc3cd4b8e3aaee3aefc6363f6) Extract architecture to docs/ + fix SQLite directory warnings ([#20](https://github.com/nyg/qoqa-compta/issues/20))
- [`bc382d4`](https://github.com/nyg/qoqa-compta/commit/bc382d4dd4d673388b0127e5066dd2eae6d3deab) Add Copilot instructions for repository ([#6](https://github.com/nyg/qoqa-compta/issues/6))

### ⚙️ Miscellaneous

- [`5c790e9`](https://github.com/nyg/qoqa-compta/commit/5c790e9c979303949204286abd0a7d3c8ff8448c) *(deps)* Update actions/checkout action to v6 ([#48](https://github.com/nyg/qoqa-compta/issues/48))
- [`e07b8ec`](https://github.com/nyg/qoqa-compta/commit/e07b8ecf53f7cfb84f5766438d383659a8919f4f) *(deps)* Pin oven-sh/setup-bun action to v2 ([#47](https://github.com/nyg/qoqa-compta/issues/47))
- [`c61d055`](https://github.com/nyg/qoqa-compta/commit/c61d055303cbfd5f8716918297f44ddce5f999d8) *(deps)* Update actions/download-artifact action to v8 ([#46](https://github.com/nyg/qoqa-compta/issues/46))
- [`82d2fed`](https://github.com/nyg/qoqa-compta/commit/82d2fed33290a91614a9ebe49525c0123500bf62) *(deps)* Update github artifact actions to v7 ([#45](https://github.com/nyg/qoqa-compta/issues/45))
- [`390a90b`](https://github.com/nyg/qoqa-compta/commit/390a90bc30f4dd4b05cd2c04181c32ad795227f8) *(deps)* Pin dependencies ([#43](https://github.com/nyg/qoqa-compta/issues/43))
- [`530bc22`](https://github.com/nyg/qoqa-compta/commit/530bc22b51844e976c22ada6f5099d54831f07f1) *(deps)* Update actions/checkout action to v5 ([#44](https://github.com/nyg/qoqa-compta/issues/44))
- [`021d843`](https://github.com/nyg/qoqa-compta/commit/021d843118659a611fbeb03d976b89e03281fecc) Track bun.lock in repository ([#41](https://github.com/nyg/qoqa-compta/issues/41))
- [`a4f3e00`](https://github.com/nyg/qoqa-compta/commit/a4f3e00838da07fdf6b933449aa9257aefafffd6) *(deps)* Pin dependencies ([#37](https://github.com/nyg/qoqa-compta/issues/37))
- [`8489e32`](https://github.com/nyg/qoqa-compta/commit/8489e32f53364cf73fc27f499489e6f98df2c375) *(deps)* Update all dependencies to latest ([#39](https://github.com/nyg/qoqa-compta/issues/39))
- [`bf1dc44`](https://github.com/nyg/qoqa-compta/commit/bf1dc448195e42c4f776dd13328cbb717badfcdc) *(deps)* Lock file maintenance ([#33](https://github.com/nyg/qoqa-compta/issues/33))
- [`c13f9c7`](https://github.com/nyg/qoqa-compta/commit/c13f9c7ea20cbf83a078b86b412071aba3a5079b) *(frontend)* Migrate to latest shadcn/ui (Mira preset, Base UI) ([#24](https://github.com/nyg/qoqa-compta/issues/24))
- [`12d938b`](https://github.com/nyg/qoqa-compta/commit/12d938bc2403c02b0305d5eca36e716401ecb347) *(deps)* Lock file maintenance ([#19](https://github.com/nyg/qoqa-compta/issues/19))
- [`17cea9a`](https://github.com/nyg/qoqa-compta/commit/17cea9ab61f06da12ae07b33c91c64d52bc6b0d6) *(deps)* Update pnpm to v11 ([#17](https://github.com/nyg/qoqa-compta/issues/17))
- [`ecc6b1a`](https://github.com/nyg/qoqa-compta/commit/ecc6b1a7c8b1a044f20a768654a2f660678b1b71) *(deps)* Update dependency rich to v15 ([#14](https://github.com/nyg/qoqa-compta/issues/14))
- [`3e2e454`](https://github.com/nyg/qoqa-compta/commit/3e2e45466dc4dba1a43a8af9827f6c0d6e8efc36) *(deps)* Lock file maintenance ([#12](https://github.com/nyg/qoqa-compta/issues/12))
- [`6f641d3`](https://github.com/nyg/qoqa-compta/commit/6f641d3d825bd34b10b37fc107b9a99193f42c53) *(deps)* Update dependency postcss to v8.5.10 [security] ([#15](https://github.com/nyg/qoqa-compta/issues/15))
- [`4af6643`](https://github.com/nyg/qoqa-compta/commit/4af66437f9304245decc07445f03e48479a90e68) Gitignore next-env.d.ts and remove from tracking ([#11](https://github.com/nyg/qoqa-compta/issues/11))
- [`9df38e7`](https://github.com/nyg/qoqa-compta/commit/9df38e76fee01180d774c4ad38e91587fc0c69db) Configure Renovate ([#2](https://github.com/nyg/qoqa-compta/issues/2))
- [`ee8760c`](https://github.com/nyg/qoqa-compta/commit/ee8760cd05df72299f937382120a02421b928c7a) *(deps)* Pin dependencies ([#3](https://github.com/nyg/qoqa-compta/issues/3))

### Others

- [`f4d9df3`](https://github.com/nyg/qoqa-compta/commit/f4d9df3c57f264968292e6b51d83bed6bc49e67b) Set version to 0.0.1 ([#49](https://github.com/nyg/qoqa-compta/issues/49))
- [`dfe0879`](https://github.com/nyg/qoqa-compta/commit/dfe0879a8b074d6e71ed3a708f54ade9cd4eee06) Initial commit

<!-- generated by git-cliff -->
