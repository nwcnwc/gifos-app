# gifos.app

These are the files served at [gifos.app](https://gifos.app).

Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved. See [LICENSE](LICENSE). Each application under `apps/` keeps the license recorded for that application, and vendored libraries under `js/vendor/` keep their own upstream licenses.

## Contact

Questions, including questions about a payment: [support@gifos.app](mailto:support@gifos.app).

`payments@gifos.app` is the PayPal payee. It is not a contact address.

## version.json: `current` and `latest`

"current" and "emergency" are THREE-part on purpose. Pages from 0.9.12 to 0.9.23 read only "current" and don't understand a 4th digit; a frozen three-part "current" carries them to the last three-part release, whose loader follows "latest". Never set it to four parts, never delete it, never read it from new code. "current" ≠ "latest" is correct. Code in this repository outside `versions/` reads `latest` and `latestEmergency` only.
