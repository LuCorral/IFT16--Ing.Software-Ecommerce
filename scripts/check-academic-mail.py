"""Alwaysdata mail guard; configuration requires the explicit provisioning flag."""
import base64
import json
import os
import shlex
import subprocess
import sys
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


def configure_environment(site, account, database_path):
    environment = dict(item.split("=", 1) for item in shlex.split(site.get("environment") or "") if "=" in item)
    if environment.get("DB_STORAGE") != database_path:
        raise ValueError("No se configura correo sobre una base inesperada")
    if account["smtp"]["host"] != "smtp.ethereal.email":
        raise ValueError("La cuenta generada no es Ethereal")
    environment.update({"ORDER_MAIL_MODE": "demo", "SMTP_HOST": account["smtp"]["host"], "SMTP_PORT": str(account["smtp"]["port"]), "SMTP_SECURE": str(account["smtp"]["secure"]).lower(), "SMTP_USER": account["user"], "SMTP_PASSWORD": account["pass"], "SMTP_FROM": account["user"]})
    if not environment.get("ORDER_MAIL_TO"):
        environment["ORDER_MAIL_TO"] = account["user"]
    return "\n".join(f"{key}={shlex.quote(value)}" for key, value in environment.items())


def main():
    site_id = os.environ["SITE_ID"]
    if not site_id.isdigit():
        raise ValueError("SITE_ID inválido")
    credential = f'{os.environ["API_TOKEN"]} account={os.environ["ACCOUNT"]}:'
    request = urllib.request.Request(f"https://api.alwaysdata.com/v1/site/{site_id}/", headers={"Authorization": "Basic " + base64.b64encode(credential.encode()).decode()})
    with urllib.request.urlopen(request, timeout=30) as response:
        site = json.load(response)
    if "--configure-ethereal" in sys.argv:
        try:
            validate_site(site, os.environ["DB_STORAGE"])
        except ValueError:
            original = dict(item.split("=", 1) for item in shlex.split(site.get("environment") or "") if "=" in item)
            generated = subprocess.run(["node", "-e", "require('nodemailer').createTestAccount().then(a=>process.stdout.write(JSON.stringify(a))).catch(()=>process.exit(1))"], check=True, capture_output=True, text=True, timeout=45)
            environment = configure_environment(site, json.loads(generated.stdout), os.environ["DB_STORAGE"])
            update = urllib.request.Request(request.full_url, method="PATCH", headers={**dict(request.header_items()), "Content-Type": "application/json"}, data=json.dumps({"environment": environment}).encode())
            with urllib.request.urlopen(update, timeout=30) as response:
                response.read()
            with urllib.request.urlopen(request, timeout=30) as response:
                site = json.load(response)
            actual = dict(item.split("=", 1) for item in shlex.split(site.get("environment") or "") if "=" in item)
            for key, value in original.items():
                if not key.startswith("SMTP_") and key not in ("ORDER_MAIL_MODE", "ORDER_MAIL_TO") and actual.get(key) != value:
                    raise ValueError("La configuración ajena al correo no se conservó")
            print("Cuenta Ethereal configurada; otras variables conservadas; credenciales omitidas")
    print(json.dumps(validate_site(site, os.environ["DB_STORAGE"])))


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except Exception:
        raise SystemExit("No se pudo consultar la configuración del sitio; no se imprimen secretos") from None
