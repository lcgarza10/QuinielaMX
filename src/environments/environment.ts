export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyCEgLk-DPvkFqZj8QwFjnMblrTCoyESx5M",
    authDomain: "quienielalmx.firebaseapp.com",
    projectId: "quienielalmx",
    storageBucket: "quienielalmx.appspot.com",
    messagingSenderId: "91963681658",
    appId: "1:91963681658:web:74bbd27e7c90af981544c3",
    measurementId: "G-GQSKBPKFQZ"
  },
  useEmulators: false,
  emulators: {
    auth: 'localhost:9099',
    firestore: 'localhost:8080',
    functions: 'localhost:5001',
  },
  admob: {
    bannerId: 'ca-app-pub-3940256099942544/6300978111', // Test banner ID
    interstitialId: 'ca-app-pub-3940256099942544/1033173712', // Test interstitial ID
    rewardedId: 'ca-app-pub-3940256099942544/5224354917', // Test rewarded ID
  }
};