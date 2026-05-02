/**
 * CONFIGURACIÓN FIREBASE (obligatoria para blog + admin)
 *
 * 1. Consola: https://console.firebase.google.com → Crear proyecto (o usar uno existente)
 * 2. Project settings → Tus apps → Web → Registrar app → copiar el objeto firebaseConfig
 * 3. Build → Firestore Database → Crear base en modo producción → Publicar reglas (archivo firestore.rules de este repo)
 * 4. Authentication → Sign-in method → Activar "Correo/contraseña"
 * 5. Authentication → Users → Agregar usuario (email de Enza + contraseña) O crear cuenta desde /admin/ la primera vez
 * 6. Firestore → Índices: si el aviso pide índice compuesto, pulsa el enlace del error o despliega firestore.indexes.json con Firebase CLI
 *
 * Ruta de reglas desde la raíz del proyecto:
 *   npx firebase-tools@latest deploy --only firestore:rules,firestore:indexes
 * (requiere firebase login y firebase use <tu-proyecto>)
 */
window.FIREBASE_CONFIG = {
  apiKey: 'REEMPLAZA_TU_API_KEY',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxx',
};
