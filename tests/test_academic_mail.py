import importlib.util
import pathlib
import unittest
import shlex

spec = importlib.util.spec_from_file_location("academic_mail", pathlib.Path(__file__).parents[1] / "scripts" / "check-academic-mail.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AcademicMailTest(unittest.TestCase):
    def site(self, extra=""):
        return {"environment": "DB_STORAGE=/home/test/data/ecommerce.sqlite SMTP_HOST=smtp.ethereal.email SMTP_FROM=demo@example.test SMTP_USER=fixture SMTP_PASSWORD='fixture with spaces' " + extra}

    def test_demo_only(self):
        result = module.validate_site(self.site(), "/home/test/data/ecommerce.sqlite")
        self.assertFalse(result["real_delivery"])
        self.assertNotIn("fixture", str(result))

    def test_reject_real_delivery_or_wrong_database(self):
        for site, storage in [(self.site("ORDER_MAIL_MODE=real"), "/home/test/data/ecommerce.sqlite"), (self.site("SMTP_HOST=smtp.real.example"), "/home/test/data/ecommerce.sqlite"), (self.site(), "/tmp/temporary.sqlite"), ({"environment": "DB_STORAGE=/home/test/data/ecommerce.sqlite"}, "/home/test/data/ecommerce.sqlite")]:
            with self.assertRaises(ValueError):
                module.validate_site(site, storage)

    def test_provision_preserves_other_settings_and_quoted_values(self):
        site = self.site("JWT_SECRET='fixture secret = unchanged' PUBLIC_URL=https://example.test ORDER_MAIL_TO=existing@example.test")
        account = {"user": "new@example.test", "pass": "fixture ' password with spaces", "smtp": {"host": "smtp.ethereal.email", "port": 587, "secure": False}}
        updated = module.configure_environment(site, account, "/home/test/data/ecommerce.sqlite")
        environment = dict(item.split("=", 1) for item in shlex.split(updated))
        self.assertEqual(environment["JWT_SECRET"], "fixture secret = unchanged")
        self.assertEqual(environment["ORDER_MAIL_TO"], "existing@example.test")
        self.assertEqual(environment["SMTP_PASSWORD"], account["pass"])
        module.validate_site({"environment": updated}, "/home/test/data/ecommerce.sqlite")

    def test_provision_rejects_wrong_database_or_provider(self):
        account = {"smtp": {"host": "smtp.real.example"}}
        for storage in ("/tmp/other.sqlite", "/home/test/data/ecommerce.sqlite"):
            with self.assertRaises(ValueError):
                module.configure_environment(self.site(), account, storage)


if __name__ == "__main__":
    unittest.main()
