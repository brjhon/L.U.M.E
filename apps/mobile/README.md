# App mobile (Flutter)

Esqueleto do app do usuário. As pastas de plataforma (android/, ios/) não são versionadas
ainda: gere-as uma vez com

```bash
cd apps/mobile
flutter create --org br.com.lume --project-name lume .
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000   # emulador Android
```

Testes: `flutter test`. O cliente de API será gerado a partir de `docs/openapi.json`.
