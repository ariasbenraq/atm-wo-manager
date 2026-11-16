#!/usr/bin/env bash
# Deploys one git SHA to the Swarm stack. Runs on the server as the "deploy" user,
# from the directory that holds docker-stack.yml (/opt/atm).
#
#   bash deploy.sh <40-character git sha>
#
# Steps: pull image -> stack deploy -> wait until the service is healthy.
# If it does not become healthy, Swarm rolls it back by itself
# (failure_action: rollback) and this script exits with an error.
set -euo pipefail

TAG="${1:-}"
if [[ ! "$TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: deploy.sh <40-character git sha>" >&2
  exit 2
fi

cd "$(dirname "$(readlink -f "$0")")"

STACK="${STACK:-atm}"
SERVICE="atm-web"
export REGISTRY="${REGISTRY:-ghcr.io/ariasbenraq}"
export TAG
IMAGE_REPO="$REGISTRY/atm-wo-manager"
IMAGE="$IMAGE_REPO:$TAG"

# Succeeds when a task running the new image is healthy. Fails if Swarm rolled
# the service back (the spec no longer points at the new image) or on timeout.
wait_service() {
  local svc="${STACK}_$1" image state
  for _ in $(seq 1 90); do
    image="$(docker service inspect "$svc" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')"
    if [[ "$image" != *":$TAG"* ]]; then
      echo "FAILED: $svc was rolled back to $image" >&2
      return 1
    fi
    state="$(docker service inspect "$svc" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')"
    case "$state" in
      paused | rollback_started | rollback_completed)
        echo "FAILED: update of $svc ended as $state" >&2
        return 1
        ;;
    esac
    if docker service ps "$svc" --filter desired-state=running \
      --format '{{.Image}} {{.CurrentState}}' | grep -q ":$TAG.* Running"; then
      echo "==> $svc is healthy"
      return 0
    fi
    sleep 2
  done
  echo "FAILED: $svc did not become healthy in time" >&2
  return 1
}

fail_report() {
  local failed
  docker service ps --no-trunc "${STACK}_$1" 2>&1 | head -6 >&2 || true
  failed="$(docker service ps "${STACK}_$1" --filter desired-state=shutdown \
    --format '{{.ID}} {{.Image}}' 2>/dev/null | grep ":$TAG" | head -1 | cut -d' ' -f1)"
  if [ -n "$failed" ]; then
    echo "--- last logs of the failed task $failed" >&2
    docker service logs --tail 20 --no-task-ids "$failed" 2>&1 | tail -20 >&2 || true
  fi
}

# After a failed deploy, put back the previous version if the service still runs the new one.
rollback_new_version() {
  local image
  image="$(docker service inspect "${STACK}_$SERVICE" \
    --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
  if [[ "$image" == *":$TAG"* ]]; then
    echo "==> Rolling back $SERVICE" >&2
    docker service rollback "${STACK}_$SERVICE" >/dev/null 2>&1 || true
  fi
}

echo "==> Pulling image for $TAG"
docker pull "$IMAGE"

echo "==> Deploying stack $STACK"
docker stack deploy --with-registry-auth --resolve-image always --prune \
  -c docker-stack.yml "$STACK"

if ! wait_service "$SERVICE"; then
  fail_report "$SERVICE"
  rollback_new_version
  echo "Deploy of $TAG failed. Still running: $(cat .current_tag 2>/dev/null || echo 'nothing')" >&2
  exit 1
fi

[ -f .current_tag ] && cp .current_tag .previous_tag
echo "$TAG" > .current_tag

# Keep the 4 newest images for quick rollbacks; remove the rest.
# Images still in use are never removed (docker rmi refuses).
docker images "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}' |
  tail -n +5 | xargs -r docker rmi >/dev/null 2>&1 || true

echo "==> Deployed $TAG"
