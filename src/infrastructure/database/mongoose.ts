import mongoose from 'mongoose';
import { env } from '../../config/env.js';

mongoose.set('strictQuery', true);
// strict: true (default) ya evita que se guarden campos no definidos en el schema,
// lo que junto a express-mongo-sanitize protege contra inyección de operadores NoSQL ($ne, $gt, etc).

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
