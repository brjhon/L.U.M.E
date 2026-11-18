# App mobile (Flutter)

App do usuário: escolher endereço (texto ou CEP), buscar por palavra ou categoria, ver
quem atende o endereço e entrar em contato por WhatsApp, telefone ou mapa.

As pastas de plataforma (android/, ios/) não são versionadas ainda: gere-as uma vez com

```bash
cd apps/mobile
flutter create --org br.com.lume --project-name lume --platforms android,ios .
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000   # emulador Android
flutter run --dart-define=API_URL=http://localhost:3000  # simulador iOS
```

No Android 11+, para os botões de WhatsApp/telefone/mapa funcionarem, adicione ao
`android/app/src/main/AndroidManifest.xml`, dentro de `<manifest>`:

```xml
<queries>
  <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>
  <intent><action android:name="android.intent.action.DIAL" /><data android:scheme="tel" /></intent>
</queries>
```

**Demonstração:** com a API rodando e `pnpm db:seed:demo` aplicado, toque em "Informe seu
endereço" e escolha *Condomínio Jardim das Acácias (demo)*. Para esconder essa opção num
build real: `--dart-define=SHOW_DEMO_ADDRESS=false`.

Estrutura:

```
lib/main.dart                 app e injeção de dependências (API, abridor de links)
lib/src/api_client.dart       cliente HTTP (contrato em docs/openapi.json)
lib/src/models.dart           modelos e enums (ServiceMode, Eligibility)
lib/src/screens/              início, endereço, resultados, detalhe
lib/src/widgets/              selo de elegibilidade
```

Testes: `flutter test` (a API é simulada com `MockClient`).
