/**
 * CONFIGURACIÓN FIREBASE (obligatoria para blog + admin)
 *
 * 1. Consola: https://console.firebase.google.com → Crear proyecto (o usar uno existente)
 * 2. Project settings → Tus apps → Web → Registrar app → copiar el objeto firebaseConfig
 * 3. Build → Firestore Database → Crear base en modo producción → Publicar reglas (firestore.rules)
 * 3b. Build → Storage → Empezar → Publicar reglas (storage.rules de este repo)
 * 4. Authentication → Sign-in method → Activar "Anónimo" (el /admin usa sesión anónima tras PIN en cliente)
 * 5. Firestore → Índices: si el aviso pide índice compuesto, pulsa el enlace del error o despliega firestore.indexes.json con Firebase CLI
 *
 * Ruta de reglas desde la raíz del proyecto:
 *   npx firebase-tools@latest deploy --only firestore:rules,firestore:indexes,storage
 * (requiere firebase login y firebase use <tu-proyecto>)
 */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCOUyjyKPyl-31BzA6Fl7_C9k1Sn8EwVug',
  authDomain: 'enzapp-dfa3b.firebaseapp.com',
  projectId: 'enzapp-dfa3b',
  storageBucket: 'enzapp-dfa3b.firebasestorage.app',
  messagingSenderId: '238831777498',
  appId: '1:238831777498:web:a930e1cd0aee11bc4fd7e3',
  measurementId: 'G-ZBFVNWFBH7',
};
