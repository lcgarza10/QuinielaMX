import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC67mpoSG_NxVGm6kHbpHE5RPwGEuDEtXA",
  authDomain: "quiniela-f6de9.firebaseapp.com",
  projectId: "quiniela-f6de9",
  storageBucket: "quiniela-f6de9.appspot.com",
  messagingSenderId: "440055183729",
  appId: "1:440055183729:web:a2f1c7e3d3d7c88f5d3a5b",
  measurementId: "G-GQSKBPKFQZ"
};

async function updateSeason() {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Crear la nueva temporada
    const seasonsRef = collection(db, 'seasons');
    const seasonDoc = await addDoc(seasonsRef, {
      name: 'Apertura 2022',
      startDate: new Date('2022-07-01').getTime(),
      endDate: new Date('2022-12-31').getTime(),
      isActive: true
    });

    // Actualizar la temporada activa
    const activeSeasonRef = doc(db, 'config', 'activeSeason');
    await setDoc(activeSeasonRef, {
      seasonId: seasonDoc.id
    });

    console.log('Temporada actualizada exitosamente');
  } catch (error) {
    console.error('Error:', error);
  }
}

updateSeason();
