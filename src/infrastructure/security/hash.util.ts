import crypto from 'node:crypto';

// Hash simple (sha256) para almacenar el refresh token de forma segura en BD,
// así nunca se guarda el token en texto plano (similar a guardar password hasheado).
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
