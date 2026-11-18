# App mobile (Flutter): Android e iOS

App do usuário: escolher endereço (texto ou CEP), buscar por palavra ou categoria, ver
quem atende o endereço e entrar em contato por WhatsApp, telefone ou mapa.
Os projetos `android/` e `ios/` estão versionados e a CI compila os dois a cada PR.

## Rodando

Com a API local no ar (`pnpm dev:api` na raiz) e os dados de demo (`pnpm db:seed:demo`):

```bash
cd apps/mobile
flutter pub get
flutter run            # escolhe o emulador Android ou o simulador do iPhone aberto
```

O app aponta sozinho para a API local: `http://10.0.2.2:3000` no emulador Android e
`http://localhost:3000` no simulador do iPhone. Em **aparelho físico**, use o IP do seu
computador na mesma rede Wi-Fi:

```bash
flutter run --dart-define=API_URL=http://192.168.0.10:3000
```

No app, toque em "Informe seu endereço" e escolha *Condomínio Jardim das Acácias (demo)*.
Num build real, esconda essa opção com `--dart-define=SHOW_DEMO_ADDRESS=false`.

## Plataformas

| | Android | iOS |
|---|---|---|
| ID do app | `br.com.lume.app` | `br.com.lume.app` |
| Nome na tela | L.U.M.E. | L.U.M.E. |
| Orientação | Retrato | Retrato (iPhone) |
| HTTP sem TLS | Só em debug/profile (API local) | Só localhost e IPs locais |
| Links externos | `<queries>` para https e tel | `LSApplicationQueriesSchemes` |

**Produção exige API em `https://`.** Defina a variável de repositório `API_URL` no GitHub
(Settings → Secrets and variables → Actions → Variables) para os builds da CI apontarem para ela.

## Builds da CI

- **Android:** cada PR gera um APK (artefato `lume-android-apk`). Instale no celular para testar.
  Ele é assinado com a chave de debug; para a Play Store é preciso criar a chave de upload.
- **iOS:** a CI compila num Mac sem assinatura, o que prova que o app builda para iPhone.
  Para instalar em aparelho ou usar TestFlight é preciso conta Apple Developer (US$ 99/ano)
  e configurar a assinatura no Xcode (`ios/Runner.xcworkspace`).

## Estrutura

```
lib/main.dart                 app e injeção de dependências (API, abridor de links)
lib/src/api_client.dart       cliente HTTP (contrato em docs/openapi.json)
lib/src/models.dart           modelos e enums (ServiceMode, Eligibility)
lib/src/theme.dart            cores e tema
lib/src/screens/              início, endereço, resultados, detalhe, navegação
lib/src/widgets/              logo, cards, selo de elegibilidade, ícones de categoria
test/                         testes de widget (API simulada)
test_screenshots/             screenshots de revisão (Android e iPhone), gerados na CI
```
