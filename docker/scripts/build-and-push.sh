#!/usr/bin/env bash
set -euo pipefail

# Build and push all final-project service images.
# Usage: ./build-and-push.sh [tag]
# Default tag: finalproj-latest

TAG="${1:-finalproj-latest}"
REGISTRY="mblkuta"

SERVICES=(
  "auth-service:/Users/nikitamarkovskij/Desktop/auth-service"
  "profile-service:/Users/nikitamarkovskij/Desktop/profile-service"
  "ordersvc:/Users/nikitamarkovskij/Desktop/order-svc"
  "billingsvc:/Users/nikitamarkovskij/Desktop/billing-svc"
  "notificationsvc:/Users/nikitamarkovskij/Desktop/notification-svc"
  "delivery-service:/Users/nikitamarkovskij/Desktop/delivery-service"
  "dialog-svc:/Users/nikitamarkovskij/Desktop/dialog-svc"
  "advert-cmd-svc:/Users/nikitamarkovskij/Desktop/advert-cmd-svc"
  "advert-query:/Users/nikitamarkovskij/Desktop/advert-query"
  "advert-validation-svc:/Users/nikitamarkovskij/Desktop/advert-validation-svc"
  "advert-postprocessor:/Users/nikitamarkovskij/Desktop/advert-postprocessor"
)

PLATFORMS="linux/amd64,linux/arm64"

for entry in "${SERVICES[@]}"; do
  image="${entry%%:*}"
  path="${entry##*:}"
  echo "=== Building $image from $path (multi-arch) ==="
  docker buildx build \
    --platform "$PLATFORMS" \
    -t "$REGISTRY/$image:$TAG" \
    --push \
    "$path"
done

echo "=== Building BFF from separate repo (multi-arch) ==="
docker buildx build \
  --platform "$PLATFORMS" \
  -t "$REGISTRY/advert-proj-bff:$TAG" \
  --push \
  /Users/nikitamarkovskij/Desktop/bff-finalproj

echo "=== All images pushed ==="
