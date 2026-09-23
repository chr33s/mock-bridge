import { render } from 'preact'
import App from './App.tsx'

import '@shopify/polaris/build/esm/styles.css';
import './main.css'

render(<App />, document.getElementById('root')!)
