import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { WebView } from 'react-native-webview'

/**
 * Оболочка для Expo Go.
 *
 * «ФОРМА» — веб-приложение, и Expo Go запускает только React Native. Поэтому
 * здесь нативный контейнер с WebView: приложение открывается внутри Expo Go
 * по адресу дев-сервера в локальной сети.
 *
 * Адрес меняется здесь и в app.json → extra.appUrl.
 */
const APP_URL = 'http://192.168.1.111:5190'

export default function App() {
  const webview = useRef(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(null)

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F2" />

      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>Не удалось открыть приложение</Text>
          <Text style={styles.text}>{failed}</Text>
          <Text style={styles.hint}>
            Телефон и компьютер должны быть в одной сети Wi-Fi, а дев-сервер — запущен
            командой npm run dev.
          </Text>
          <Text style={styles.url}>{APP_URL}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setFailed(null)
              setLoading(true)
              webview.current?.reload()
            }}
          >
            <Text style={styles.buttonText}>Попробовать снова</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(APP_URL)}>
            <Text style={styles.linkText}>Открыть в браузере телефона</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webview}
          source={{ uri: APP_URL }}
          style={styles.webview}
          // Съёмка и выбор фотографии из веб-страницы.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => setFailed(event.nativeEvent.description ?? 'Ошибка загрузки')}
          onHttpError={(event) => setFailed(`Сервер ответил ${event.nativeEvent.statusCode}`)}
          // Android: разрешаем странице запрашивать камеру.
          onPermissionRequest={(request) => request.grant?.()}
        />
      )}

      {loading && !failed && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#1A1917" />
          <Text style={styles.loaderText}>Открываем ФОРМУ…</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F5F2' },
  webview: { flex: 1, backgroundColor: '#F7F5F2' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F5F2',
  },
  loaderText: { marginTop: 14, color: '#6B665E', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 19, fontWeight: '600', color: '#1A1917', marginBottom: 10, textAlign: 'center' },
  text: { fontSize: 15, color: '#6B665E', textAlign: 'center' },
  hint: { fontSize: 13, color: '#767065', textAlign: 'center', marginTop: 14, lineHeight: 19 },
  url: { fontSize: 13, color: '#A2542C', marginTop: 12 },
  button: {
    marginTop: 24,
    backgroundColor: '#1A1917',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  link: { marginTop: 14, paddingVertical: 8 },
  linkText: { color: '#3D3A35', fontSize: 14, textDecorationLine: 'underline' },
})

void Platform
