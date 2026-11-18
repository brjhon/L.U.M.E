import type { HealthResponse } from '@lume/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/v1/health`, { cache: 'no-store' });
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  const health = await getHealth();
  return (
    <>
      <header>
        <strong>L.U.M.E.</strong> · Painel
      </header>
      <main>
        <h1>O que você precisa. Onde você está.</h1>
        <p>
          Este painel atende dois públicos com o mesmo login, separados por papel:
          administração da plataforma (moderação, categorias, condomínios) e parceiros
          (perfil, ofertas e áreas de atendimento).
        </p>
        <div className="cards">
          <section className="card">
            <h2>Status da API</h2>
            {health ? (
              <p className={health.status === 'ok' ? 'ok' : 'down'}>
                {health.status} · v{health.version} · PostGIS {health.checks.postgis ?? '—'}
              </p>
            ) : (
              <p className="down">API fora do ar em {API_URL}</p>
            )}
          </section>
          <section className="card">
            <h2>Administração</h2>
            <p>Fila de moderação, categorias e condomínios. (Sprint 2)</p>
          </section>
          <section className="card">
            <h2>Área do parceiro</h2>
            <p>Perfil, ofertas e cobertura de atendimento. (Sprint 2)</p>
          </section>
        </div>
      </main>
    </>
  );
}
