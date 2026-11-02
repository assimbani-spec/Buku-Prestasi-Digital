/**
 * Pelaku yang menulis data.
 *
 * Audit log wajib tahu siapa yang menulis. Bentuk ini sengaja kecil dan stabil
 * supaya module fitur tidak bergantung pada tipe Firebase atau Supabase.
 */

export interface Aktor {
  uid: string;
  email?: string | null;
  role?: string | null;
}
