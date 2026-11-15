"""Read-only Alwaysdata preflight; never log credentials or change site settings."""
import base64
import json
import os
import shlex
import urllib.request


def validate_site(site, database_path):
    environment = dict(item.split("=", 1) for item in shlex.split(site.get("environment") or "") if "=" in item)
    if environment.get("DB_STORAGE") != database_path:
        raise ValueError("DB_STORAGE del sitio no coincide con la base persistente configurada")
    if environment.get("ORDER_MAIL_MODE", "demo") != "demo":
        raise ValueError("ORDER_MAIL_MODE debe ser demo antes de desplegar")
    missing = [key for key in ("SMTP_HOST", "SMTP_FROM", "SMTP_USER", "SMTP_PASSWORD") if not environment.get(key)]
    if missing:
        raise ValueError("Falta configuración académica indispensable: " + ", ".join(missing))
    if environment["SMTP_HOST"] != "smtp.ethereal.email":
        raise ValueError("El SMTP del sitio no es Ethereal; no se activa la release")
    return {"mail_mode": "demo", "smtp": "Ethereal", "persistent_database": True, "real_delivery": False}


def main():
    site_id = os.environ["SITE_ID"]
    if not site_id.isdigit():
        raise ValueError("SITE_ID inválido")
    credential = f'{os.environ["API_TOKEN"]} account={os.environ["ACCOUNT"]}:'
    request = urllib.request.Request(f"https://api.alwaysdata.com/v1/site/{site_id}/", headers={"Authorization": "Basic " + base64.b64encode(credential.encode()).decode()})
    with urllib.request.urlopen(request, timeout=30) as response:
        site = json.load(response)
    print(json.dumps(validate_site(site, os.environ["DB_STORAGE"])))


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except Exception:
        raise SystemExit("No se pudo consultar la configuración del sitio; no se imprimen secretos") from None
