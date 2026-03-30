import admin from 'firebase-admin';

export function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  const formattedKey = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: formattedKey,
    }),
  });
}

export default admin;