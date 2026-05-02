import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            "AIzaSyDQLgUUerUzN-WT8uozqtaaHgzrSrtQz8M",
  authDomain:        "sioujhih-order.firebaseapp.com",
  databaseURL:       "https://sioujhih-order-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "sioujhih-order",
  storageBucket:     "sioujhih-order.firebasestorage.app",
  messagingSenderId: "1081876362890",
  appId:             "1:1081876362890:web:4fd62984c908ebc26e1f73",
  measurementId:     "G-1BE18LD08S"
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
