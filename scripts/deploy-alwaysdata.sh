#!/usr/bin/env bash
set -euo pipefail

operation=${1:-}
commit=${2:-}
app_root=${3:-}
database_path=${4:-}

if [[ ! "$commit" =~ ^[a-f0-9]{40}$ ]]; then
  echo "A full lowercase Git commit SHA is required." >&2
  exit 2
fi
if [[ ! "$app_root" =~ ^/home/[A-Za-z0-9._-]+/apps/ecommerce$ ]]; then
  echo "ALWAYSDATA_APP_DIR must be /home/<account>/apps/ecommerce." >&2
  exit 2
fi

account_home=${app_root%/apps/ecommerce}
if [[ "$database_path" != "$account_home/data/ecommerce.sqlite" ]]; then
  echo "ALWAYSDATA_DB_STORAGE must be /home/<account>/data/ecommerce.sqlite." >&2
  exit 2
fi

releases_dir="$app_root/releases"
release_dir="$releases_dir/$commit"
current_link="$app_root/current"

activate_release() {
  local target=$1
  local temporary_link="$app_root/.current-$commit"
  rm -f -- "$temporary_link"
  ln -s "$target" "$temporary_link"
  mv -Tf -- "$temporary_link" "$current_link"
}

case "$operation" in
  prepare)
    [[ -f "$release_dir/package.json" ]] || {
      echo "Release files were not uploaded." >&2
      exit 1
    }
    printf '%s\n' "$commit" > "$release_dir/DEPLOY_COMMIT"
    cd "$release_dir"
    export NODEJS_VERSION=22
    npm ci --omit=dev
    ;;
  migrate)
    [[ -f "$release_dir/package.json" ]] || {
      echo "Release files were not uploaded." >&2
      exit 1
    }
    mkdir -p "$(dirname "$database_path")"
    cd "$release_dir"
    export NODEJS_VERSION=22
    export DB_STORAGE="$database_path"
    npm run migrate
    ;;
  activate)
    [[ -d "$release_dir/node_modules" ]] || {
      echo "Release dependencies are not installed." >&2
      exit 1
    }
    mkdir -p "$releases_dir"
    previous_release=$(readlink -f "$current_link" 2>/dev/null || true)
    activate_release "$release_dir"
    printf '%s\n' "$previous_release"
    ;;
  rollback)
    previous_release=${5:-}
    [[ "$previous_release" == "$releases_dir/"* && -d "$previous_release" ]] || {
      echo "No valid previous release is available to restore." >&2
      exit 1
    }
    activate_release "$previous_release"
    ;;
  prune)
    current_release=$(readlink -f "$current_link" 2>/dev/null || true)
    [[ -n "$current_release" ]] || {
      echo "There is no active release to retain." >&2
      exit 1
    }
    mapfile -t release_paths < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
    retained_previous=0
    for candidate in "${release_paths[@]}"; do
      [[ "$candidate" != "$current_release" ]] || continue
      if (( retained_previous < 2 )); then
        retained_previous=$((retained_previous + 1))
        continue
      fi
      candidate_name=${candidate##*/}
      [[ "$candidate" == "$releases_dir/$candidate_name" && "$candidate_name" =~ ^[a-f0-9]{40}$ ]] || {
        echo "Refusing to remove an unexpected release path." >&2
        exit 1
      }
      rm -rf -- "$candidate"
    done
    ;;
  *)
    echo "Usage: deploy-alwaysdata.sh {prepare|migrate|activate|rollback|prune} SHA APP_DIR DB_STORAGE [PREVIOUS_RELEASE]" >&2
    exit 2
    ;;
esac
