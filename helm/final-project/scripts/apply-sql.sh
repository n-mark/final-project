#!/usr/bin/env bash
# Apply SQL init ConfigMaps for all Postgres databases.
# Each SQL file gets its own ConfigMap to stay under the 1MB limit.
# Uses kubectl create (not apply) to avoid the 256KB annotation limit.
# Run AFTER `helm install` or `helm upgrade`.
# Usage: ./scripts/apply-sql.sh [namespace]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILES_DIR="$SCRIPT_DIR/../files"
NAMESPACE="${1:-final-proj}"

# (db_name dir) pairs – compatible with bash 3.2+
set -- \
  "postgres-shared"       "auth" \
  "postgres-profiles"     "profile" \
  "postgres-orders"       "order" \
  "postgres-billing"      "billing" \
  "postgres-notifications" "notification" \
  "postgres-delivery"     "delivery" \
  "postgres-advertcmd"    "advertcmd" \
  "postgres-dialog"       "dialog" \
  "postgres-validation"   "validation" \
  "postgres-gis"          "gis"

while [ "$#" -gt 0 ]; do
  db="$1"; dir="$2"; shift 2
  sql_dir="$FILES_DIR/$dir"

  if [ ! -d "$sql_dir" ]; then
    echo "[SKIP] $db: no files dir at $sql_dir"
    continue
  fi

  echo "[$db] creating ConfigMaps from $sql_dir..."

  for f in "$sql_dir"/*.sql; do
    base="$(basename "$f" .sql)"
    # Sanitize for K8s: _ -> -. Extension already stripped.
    safe="${base//_/-}"
    cm_name="${db}-init-${safe}"

    # Replace-or-create to avoid annotation-limit issues.
    echo "  -> $cm_name"
    if kubectl get configmap "$cm_name" -n "$NAMESPACE" >/dev/null 2>&1; then
      kubectl delete configmap "$cm_name" -n "$NAMESPACE" >/dev/null 2>&1
    fi
    kubectl create configmap "$cm_name" \
      --namespace="$NAMESPACE" \
      --from-file="$f"
  done

  echo "[$db] restarting Deployment $db..."
  kubectl rollout restart deployment/"$db" --namespace="$NAMESPACE"
done

echo "Done. All SQL ConfigMaps applied."