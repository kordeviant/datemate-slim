#!/usr/bin/env bash
set -e

# Default variables (can be overridden via environment or arguments)
DEFAULT_EMAIL="${1:-pmsa@gmail.com}"
DEFAULT_PASSWORD="${2:-Password123!@#}"

echo "=========================================================="
echo " DateMate OpenAPI & Postman Collection Generator"
echo " Setting default email: ${DEFAULT_EMAIL}"
echo " Setting default password: ${DEFAULT_PASSWORD}"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SWAGGER_FILE="${BACKEND_DIR}/docs/api/swagger.json"
DATEMATE_API_FILE="${BACKEND_DIR}/datemate-api.json"
POSTMAN_COLLECTION_FILE="${BACKEND_DIR}/docs/api/datemate.postman_collection.json"

python3 - <<EOF
import json

def update_defaults(path, email, password):
    with open(path, "r", encoding="utf-8") as f:
        spec = json.load(f)

    schemas = spec.get("components", {}).get("schemas", {})
    count = 0
    for s_name, schema in schemas.items():
        props = schema.get("properties", {})
        for prop_name, prop in props.items():
            if "email" in prop_name.lower():
                prop["default"] = email
                prop["example"] = email
                count += 1
            if prop_name == "password" and s_name in ["SignUpDto", "SignInDto", "ResetPasswordDto"]:
                prop["default"] = password
                prop["example"] = password
                count += 1
            if prop_name == "code" and s_name in ["ValidateCodeDto", "ResetPasswordDto"]:
                prop["default"] = "123456"
                prop["example"] = "123456"
            if prop_name == "packageName" and s_name in ["SignUpDto", "SignInDto"]:
                prop["default"] = "com.datemate.app"
                prop["example"] = "com.datemate.app"
            if prop_name == "device" and s_name in ["SignInDto", "ValidateCodeDto"]:
                prop["default"] = "Google Pixel 8"
                prop["example"] = "Google Pixel 8"
            if prop_name == "userAgent" and s_name in ["SignInDto", "ValidateCodeDto"]:
                prop["default"] = "DateMate-Android/1.0"
                prop["example"] = "DateMate-Android/1.0"
            if prop_name == "integrityToken":
                prop["default"] = "dev-integrity-token"
                prop["example"] = "dev-integrity-token"
            if prop_name == "fcmToken":
                prop["default"] = "mock-fcm-device-token"
                prop["example"] = "mock-fcm-device-token"
            if prop_name == "username" and s_name == "SignInDto":
                prop["default"] = email.split('@')[0]
                prop["example"] = email.split('@')[0]
            if prop_name in ["token", "refreshToken"]:
                prop["default"] = "{{refreshToken}}"
                prop["example"] = "{{refreshToken}}"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Updated defaults in {path}")

update_defaults("${SWAGGER_FILE}", "${DEFAULT_EMAIL}", "${DEFAULT_PASSWORD}")
update_defaults("${DATEMATE_API_FILE}", "${DEFAULT_EMAIL}", "${DEFAULT_PASSWORD}")
EOF

echo "Regenerating Postman collection v2.1.0..."
npx --yes openapi-to-postmanv2 \
  -s "${SWAGGER_FILE}" \
  -o "${POSTMAN_COLLECTION_FILE}" \
  -p

echo "Done! You can now import ${POSTMAN_COLLECTION_FILE} into Postman."
