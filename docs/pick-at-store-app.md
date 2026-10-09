# Local Store Stories inside the Pick at Store app

This is for whoever builds the Pick at Store app for the App Store and Play
Store. It explains how to show Local Store Stories inside the app so that
everything works, including Google sign-in, photos and the map.

The site's address today is `https://local-store-stories.vercel.app`. It will
move to its own domain before launch, so keep it in one constant (`SITE`
below) and update it then.

## Pick one of two ways

| | Way 1: open in the phone's browser | Way 2: a screen inside the app |
|---|---|---|
| Work in the app | One line of code | A web view screen plus the sign-in bridge below |
| Google sign-in | Works as it does on the web | The app signs in with Google and hands the site the result |
| Feels like | Leaves the app for Safari or Chrome | Stays inside the app |

Don't use an in-app browser tab (SFSafariViewController, Chrome Custom Tabs,
Capacitor Browser, expo-web-browser) and don't put the site in an iframe.
Google's sign-in window can't open from an in-app tab on iPhone, and the site
refuses to be shown in another site's frame.

## Way 1: open the site in the phone's browser

| App built with | Code |
|---|---|
| Flutter (`url_launcher`) | `launchUrl(Uri.parse(SITE), mode: LaunchMode.externalApplication)` |
| React Native | `Linking.openURL(SITE)` |
| Android (Kotlin) | `startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SITE)))` |
| iOS (Swift) | `UIApplication.shared.open(URL(string: SITE)!)` |

Nothing else is needed.

## Way 2: a web view screen with the app's own Google sign-in

Google blocks its sign-in page inside web views (the error is
`disallowed_useragent`). So inside the app, the app signs in with Google itself
and passes the Google ID token to the page. The site already does its half in
`src/lib/google-sign-in.ts`.

### 1. Mark the web view as the Pick at Store app

Add `PickAtStoreApp` to the end of the web view's user agent. The site only
talks to the app when it sees this.

| App built with | How |
|---|---|
| React Native (`react-native-webview`) | `applicationNameForUserAgent="PickAtStoreApp"` |
| Flutter (`webview_flutter`) | `controller.setUserAgent('${await controller.getUserAgent() ?? ''} PickAtStoreApp')` |
| Flutter (`flutter_inappwebview`) | `InAppWebViewSettings(applicationNameForUserAgent: 'PickAtStoreApp')` |
| Android (Kotlin) | `webView.settings.userAgentString += " PickAtStoreApp"` |
| iOS (Swift) | `configuration.applicationNameForUserAgent = "Mobile/15E148 PickAtStoreApp"` |

### 2. Give the page a way to message the app

The page looks for these, in this order, and sends the text
`{"type":"googleSignIn"}` when someone taps **Continue with Google**:

| App built with | What the page calls | Set up in the app |
|---|---|---|
| React Native | `window.ReactNativeWebView.postMessage` | an `onMessage` prop on the `WebView` |
| iOS (Swift) | `window.webkit.messageHandlers.pickAtStore.postMessage` | `userContentController.add(handler, name: "pickAtStore")` |
| Android (Kotlin), Flutter (`webview_flutter`) | `window.PickAtStore.postMessage` | `WebViewCompat.addWebMessageListener` named `PickAtStore`, or `addJavaScriptChannel('PickAtStore', ...)` |
| Flutter (`flutter_inappwebview`) | `window.flutter_inappwebview.callHandler("pickAtStore", text)` | `addJavaScriptHandler(handlerName: 'pickAtStore', ...)` |

### 3. Answer with a Google ID token

When the message arrives, and only when the web view is showing a page on
`SITE`:

1. Run Google sign-in in the app and get the person's Google **ID token**.
2. Run this in the web view, with the token as a JavaScript string:
   `window.localStoreStories && window.localStoreStories.googleIdToken("<ID token>")`
3. If the person cancels or sign-in fails, run:
   `window.localStoreStories && window.localStoreStories.signInFailed()`

The page waits up to five minutes, then lets the person try again.

**Keep the token safe.** The ID token lets anyone who holds it sign in to Local
Store Stories as that person for about an hour. So:

- Answer only messages from pages on `SITE` (check the origin, as in the
  examples below), never from any other page the web view might show.
- Keep the web view on `SITE`. Open every other link (Instagram posts, map
  directions, WhatsApp) in the phone's browser or app.
- Don't log the token or send it anywhere else.

### 4. Let Firebase accept the app's tokens

The site uses the Firebase project `pas-prod-c8190`. Request the ID token with
your app's **Web client ID** (called `serverClientId` or `webClientId` in the
Google sign-in libraries). If your app's Google sign-in lives in a different
Google Cloud or Firebase project, which is likely, the site's owner adds your
client IDs to `pas-prod-c8190`:

Firebase console, **Authentication**, **Sign-in method**, **Google**, then
**Safelist client IDs from external projects**. Add the app's Web client ID and
its iOS client ID, then **Save**.

Until then the page shows "Google sign-in wasn't accepted"
(`auth/invalid-credential`).

### 5. Web view settings the site needs

- **JavaScript and storage on.** Android: `javaScriptEnabled` and
  `domStorageEnabled`. The person stays signed in through the web view's own
  storage.
- **Photos.** The Share page uses a normal photo picker
  (`<input type="file" accept="image/*">`). Android web views need a file
  chooser (`WebChromeClient.onShowFileChooser`; `react-native-webview` and
  `flutter_inappwebview` include one, `webview_flutter` needs
  `setOnShowFileSelector` on Android). iOS needs `NSPhotoLibraryUsageDescription`
  and `NSCameraUsageDescription` in `Info.plist`.
- **My location on the map.** The map uses the browser's location, only when
  the person taps the locate button. Android: location permission and
  `WebChromeClient.onGeolocationPermissionsShowPrompt`
  (`geolocationEnabled` in `react-native-webview`). iOS:
  `NSLocationWhenInUseUsageDescription`.
- **Links that open a new window** (`target="_blank"`, `window.open`): open them
  in the phone's browser or app.
- **Sharing.** Android web views have no share sheet; the site then offers
  WhatsApp and Copy link instead, so nothing is needed.
- **Screen edges.** The site already keeps clear of the notch and the home bar.
  On phones it shows its own bottom bar, so if the app has a tab bar, place the
  web view above it.

### Examples

These show only the bridge. Fit them into your own screens.

**React Native** (`react-native-webview`, `@react-native-google-signin/google-signin` 13 or later)

```tsx
const SITE = "https://local-store-stories.vercel.app";
GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

function StoreStories() {
  const web = useRef<WebView>(null);

  async function onMessage(event: WebViewMessageEvent) {
    if (!event.nativeEvent.url.startsWith(SITE + "/")) return;
    if (event.nativeEvent.data !== JSON.stringify({ type: "googleSignIn" })) return;
    let js = "window.localStoreStories && window.localStoreStories.signInFailed();";
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = isSuccessResponse(response) ? response.data.idToken : null;
      if (idToken) {
        js = `window.localStoreStories && window.localStoreStories.googleIdToken(${JSON.stringify(idToken)});`;
      }
    } catch {
      // Cancelled or failed: the page is told so below.
    }
    web.current?.injectJavaScript(js + " true;");
  }

  return (
    <WebView
      ref={web}
      source={{ uri: SITE }}
      applicationNameForUserAgent="PickAtStoreApp"
      onMessage={onMessage}
      geolocationEnabled
    />
  );
}
```

**Flutter** (`webview_flutter`, `google_sign_in` 7)

```dart
const site = 'https://local-store-stories.vercel.app';

await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
await controller.setUserAgent('${await controller.getUserAgent() ?? ''} PickAtStoreApp');
await controller.addJavaScriptChannel('PickAtStore', onMessageReceived: (message) async {
  final url = await controller.currentUrl();
  if (url == null || !url.startsWith('$site/')) return;
  if (message.message != '{"type":"googleSignIn"}') return;
  var js = 'window.localStoreStories && window.localStoreStories.signInFailed();';
  try {
    // GoogleSignIn.instance.initialize(serverClientId: webClientId) runs once at app start.
    final account = await GoogleSignIn.instance.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken != null) {
      js = 'window.localStoreStories && window.localStoreStories.googleIdToken(${jsonEncode(idToken)});';
    }
  } catch (_) {
    // Cancelled or failed: the page is told so below.
  }
  await controller.runJavaScript(js);
});
await controller.loadRequest(Uri.parse(site));
```

**Android** (Kotlin, `androidx.webkit` and Credential Manager)

```kotlin
const val SITE = "https://local-store-stories.vercel.app"

webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.settings.userAgentString += " PickAtStoreApp"
if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
  // Only pages on SITE get window.PickAtStore.
  WebViewCompat.addWebMessageListener(webView, "PickAtStore", setOf(SITE)) { view, message, _, isMainFrame, _ ->
    if (!isMainFrame || message.data != """{"type":"googleSignIn"}""") return@addWebMessageListener
    lifecycleScope.launch {
      val js = try {
        val option = GetGoogleIdOption.Builder()
          .setServerClientId(WEB_CLIENT_ID)
          .setFilterByAuthorizedAccounts(false)
          .build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val result = CredentialManager.create(this@MainActivity).getCredential(this@MainActivity, request)
        val idToken = GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        "window.localStoreStories && window.localStoreStories.googleIdToken(${JSONObject.quote(idToken)});"
      } catch (e: Exception) {
        "window.localStoreStories && window.localStoreStories.signInFailed();"
      }
      view.evaluateJavascript(js, null)
    }
  }
}
webView.loadUrl(SITE)
```

**iOS** (Swift, `WKWebView` and GoogleSignIn 7 or later)

```swift
let siteHost = "local-store-stories.vercel.app"

// When creating the web view:
configuration.applicationNameForUserAgent = "Mobile/15E148 PickAtStoreApp"
configuration.userContentController.add(self, name: "pickAtStore")

// WKScriptMessageHandler
func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
  let origin = message.frameInfo.securityOrigin
  guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == siteHost,
        message.body as? String == #"{"type":"googleSignIn"}"# else { return }
  GIDSignIn.sharedInstance.signIn(withPresenting: self) { result, _ in
    var js = "window.localStoreStories && window.localStoreStories.signInFailed();"
    if let token = result?.user.idToken?.tokenString,
       let data = try? JSONEncoder().encode(token), let quoted = String(data: data, encoding: .utf8) {
      js = "window.localStoreStories && window.localStoreStories.googleIdToken(\(quoted));"
    }
    self.webView.evaluateJavaScript(js)
  }
}
```

### Try it on a real phone

1. Open the screen, tap **Continue with Google**, pick an account. You land on
   the welcome screen (first time) or back on the page you were on.
2. Share a memory with a photo.
3. On the map, tap the locate button and allow location.
4. Open an Instagram post on Home and map directions: they open outside the app.
5. Close the app, open it again: you're still signed in.
6. Profile, Delete my account: it asks you to sign in again, and that works too.

## Later: open shared links in the app

Shared memory links (`SITE/memories/...`) can open straight in the app with
Android App Links and iOS Universal Links. The site needs the app's Android
package name with its signing certificate SHA-256 fingerprint, and the Apple
Team ID with the bundle ID. Send those to the site's owner when you want it.
