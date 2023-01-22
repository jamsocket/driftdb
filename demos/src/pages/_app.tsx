import type { AppProps } from 'next/app'
import '../styles/style.css'

export default function App({ Component, pageProps }: AppProps) {
  return <div id="main">
    <Component {...pageProps} />
  </div>
}
