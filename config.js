// Ligação do site com o banco de dados (Supabase).
// Troque os dois valores pelos do seu projeto: Supabase > Project Settings > API.
// A chave "anon"/"publishable" é pública por natureza (fica visível no site);
// quem protege os dados são as regras do arquivo supabase.sql.
// NUNCA coloque aqui a chave "service_role" ou "secret".
window.WISHLIST_CONFIG = {
  supabaseUrl: 'https://mwrimjwkauffmfrdiayg.supabase.co',
  supabaseAnonKey: 'sb_publishable_spu_IsKdfLNDriv3FLpPdA_CGcXu58p',
  // ID do cliente do Google (público). A chave secreta do Google fica só no Supabase.
  googleClientId: '825246473430-p2rdd225b7j9vuomlfu9k651llppvo86.apps.googleusercontent.com'
};
