# final-project

Final deployment repository for the advert-project microservices stack.

## Structure

```text
k8s/            # Kubernetes raw manifests (apply in order)
helm/           # Helm chart for the whole stack
docker/scripts/ # Helper scripts (build & push)
tests/          # Integration / smoke tests
```

## Quick start (raw k8s manifests)

1. Create namespace and secrets:

```bash
kubectl apply -f k8s/01-namespace/namespace.yaml
kubectl apply -f k8s/02-secrets/shared-secrets.yaml
```

2. Apply infrastructure (databases, brokers, opensearch, redis):

```bash
kubectl apply -f k8s/04-databases/
kubectl apply -f k8s/05-brokers/
kubectl apply -f k8s/06-opensearch/
```

3. Apply services:

```bash
kubectl apply -f k8s/03-configmaps/
kubectl apply -f k8s/08-services/
```

4. Apply Traefik and public ingress:

```bash
kubectl apply -f k8s/09-traefik/
```

5. Create the OpenSearch index template:

```bash
kubectl apply -f k8s/07-jobs/opensearch-index-job.yaml
```

## Helm

```bash
helm upgrade --install final-project helm/final-project \
  --namespace final-proj --create-namespace
```

## Traefik access

Add to `/etc/hosts`:

```text
127.0.0.1 finalproj.local
```

Public APIs are exposed on `http://finalproj.local/api/v1/...`.

## BFF

BFF lives in a separate repository: https://github.com/n-mark/advert-proj-bff

Aggregate endpoints:

- `GET /api/v1/bff/adverts/{id}`
- `GET /api/v1/bff/orders/{id}`
- `GET /api/v1/bff/users/{id}/cabinet`

## Build & push images

```bash
./docker/scripts/build-and-push.sh [tag]
```

## Notes

- All services are configured to use `finalproj-latest` Docker tag by default.
- Kafka is deployed in KRaft mode (no Zookeeper).
- RabbitMQ is intentionally omitted; Kafka is used as the primary broker.
- OpenSearch has 3 shards / 2 replicas configured via index template.
