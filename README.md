# Проект CRM v22 — GitHub Pages + общая Google база

Эта версия предназначена именно для GitHub Pages.

В корне находятся:
- index.html
- style.css
- app.js

Frontend уже настроен на ваш Google Apps Script:
https://script.google.com/macros/s/AKfycbyitEcLyl1VA4ZadbxoSfGMUIQAWxVwVf6wG7kn_A8xzdMiVRF9_mN24geYzgQTAJHzuA/exec

## Один обязательный шаг перед использованием

Ваш текущий Apps Script умеет только выгружать таблицу. Для общего входа менеджеров с разных устройств ему нужно добавить серверную авторизацию.

1. Откройте вашу Google Таблицу.
2. Расширения → Apps Script.
3. Полностью замените старый код содержимым `google_apps_script_backend.gs`.
4. Deploy → Manage deployments.
5. Нажмите Edit (карандаш).
6. Version → New version.
7. Execute as: Me.
8. Who has access: Anyone.
9. Deploy.

URL менять не нужно — frontend уже использует ваш текущий Web App URL.

После этого:
- администратор создаёт менеджера на одном устройстве;
- менеджер может войти с другого телефона/ПК;
- проекты и комментарии общие;
- данные хранятся в Google Таблице;
- автоматически создаются листы «Проекты», «Блоки», «Комментарии»;
- аккаунты и полное состояние CRM хранятся в скрытом листе CRM_DATA.

Начальный администратор при первом запуске:
admin / admin123

После первого входа рекомендуется сменить пароль администратора.
