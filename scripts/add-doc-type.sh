#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/add-doc-type.sh <type-id> <label> <format>
  <type-id>  lowercase identifier, e.g. essay_plus
  <label>    human-readable name, e.g. "论文题 Plus"
  <format>   html | yaml

The script scaffolds doc-types/<type-id>/ with a template file and prints the
YAML snippet to add into doc-types/config.yaml. It does not edit the config for you.
USAGE
}

if [[ $# -lt 3 ]]; then
  usage
  exit 1
fi

TYPE_ID="$1"
LABEL="$2"
FORMAT="$3"

if [[ ! "$TYPE_ID" =~ ^[a-z0-9_\-]+$ ]]; then
  echo "error: type-id must match [a-z0-9_-]+" >&2
  exit 1
fi

if [[ "$FORMAT" != "html" && "$FORMAT" != "yaml" ]]; then
  echo "error: format must be html or yaml" >&2
  exit 1
fi

TARGET_DIR="doc-types/${TYPE_ID}"
if [[ -e "$TARGET_DIR" ]]; then
  echo "error: ${TARGET_DIR} already exists" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

template_path="template.${FORMAT}"
full_template_path="${TARGET_DIR}/${template_path}"

if [[ "$FORMAT" == "html" ]]; then
  cat <<'HTML' > "$full_template_path"
<div class="document">
  <h2>标题</h2>
  <p>在此补充 HTML 内容模板...</p>
</div>
HTML
else
  cat <<'YAML' > "$full_template_path"
title: "文档标题"
description: "在此补充 YAML 内容模板..."
data: {}
YAML
fi

echo "Created ${full_template_path}" >&2

echo "" >&2
echo "Add the following snippet into doc-types/config.yaml:" >&2
cat <<SNIPPET
  - id: ${TYPE_ID}
    label: "${LABEL}"
    content_format: "${FORMAT}"
    template: "${template_path}"
    # backend:
    #   hook_import: "github.com/yjxt/ydms/backend/internal/service/documents/types/${TYPE_ID}"
    # frontend:
    #   hook_import: "../features/documents/typePlugins/${TYPE_ID}/register"
SNIPPET

echo "" >&2
echo "Next steps:" >&2
echo "  1. Update doc-types/config.yaml with the snippet." >&2
echo "  2. Run 'make generate-doc-types'." >&2
echo "  3. Implement optional backend/frontend hooks if needed." >&2
