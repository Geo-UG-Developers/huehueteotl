// Guardado local en el teléfono. Todo con try/catch: en modo privado o sin espacio, la app sigue funcionando.
const PREFIJO = 'huehue-';

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v === null ? porDefecto : (JSON.parse(v) as T);
  } catch {
    return porDefecto;
  }
}

export function guardar(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrar(clave: string) {
  try { localStorage.removeItem(PREFIJO + clave); } catch { /* sin almacenamiento */ }
}

export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
