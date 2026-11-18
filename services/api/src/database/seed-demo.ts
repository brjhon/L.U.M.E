/**
 * Dados de DEMONSTRAÇÃO para apresentar o fluxo de busca (não use em produção).
 * Região: Vila Mariana, São Paulo, em torno de um condomínio fictício.
 * Todos os nomes são inventados. Os telefones usam o DDD 00, que não existe,
 * a menos que DEMO_PHONE seja definido (ex.: seu próprio número, para testar os botões).
 *
 *   pnpm db:seed:demo        # recria os dados de demo (idempotente)
 */
import { Client } from 'pg';

export const DEMO_ORIGIN = { lat: -23.5893, lng: -46.6346, label: 'Condomínio Jardim das Acácias (demo)' };

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const COMMUNITY_ID = id(900);
const COMMUNITY_ADDRESS_ID = id(901);

type Mode = 'DELIVERY' | 'IN_STORE' | 'AT_HOME' | 'REMOTE';
type Coverage =
  | { type: 'RADIUS'; radiusM: number; verified: boolean; at?: [number, number] }
  | { type: 'POLYGON'; box: [number, number, number, number]; verified: boolean }
  | { type: 'COMMUNITY'; verified: boolean };

interface DemoProvider {
  n: number;
  kind: 'BUSINESS' | 'PROFESSIONAL';
  name: string;
  description: string;
  status?: 'APPROVED' | 'PENDING';
  location?: { address: string; lat: number; lng: number };
  listings: { title: string; description: string; category: string; mode: Mode; coverage?: Coverage[] }[];
}

const PROVIDERS: DemoProvider[] = [
  {
    n: 1,
    kind: 'BUSINESS',
    name: 'Mercadinho Bom Preço',
    description: 'Mercado de bairro com hortifrúti e padaria.',
    location: { address: 'Rua Exemplo, 100 - Vila Mariana', lat: -23.5839, lng: -46.6346 },
    listings: [
      {
        title: 'Entrega de compras do mês',
        description: 'Pedidos por WhatsApp, entrega no mesmo dia.',
        category: 'mercado',
        mode: 'DELIVERY',
        coverage: [{ type: 'RADIUS', radiusM: 2000, verified: true }],
      },
      { title: 'Loja e padaria', description: 'Pão quentinho às 7h e às 17h.', category: 'mercado', mode: 'IN_STORE' },
    ],
  },
  {
    n: 2,
    kind: 'BUSINESS',
    name: 'Farmácia Vida Plena',
    description: 'Medicamentos, perfumaria e aferição de pressão.',
    location: { address: 'Av. Exemplo, 900 - Vila Mariana', lat: -23.5893, lng: -46.6258 },
    listings: [
      {
        title: 'Entrega de medicamentos',
        description: 'Entrega em até 1 hora.',
        category: 'farmacia',
        mode: 'DELIVERY',
        coverage: [{ type: 'RADIUS', radiusM: 3000, verified: true }],
      },
      { title: 'Farmácia 24 horas', description: 'Aberta todos os dias.', category: 'farmacia', mode: 'IN_STORE' },
    ],
  },
  {
    n: 3,
    kind: 'BUSINESS',
    name: 'Pizzaria Forno a Lenha',
    description: 'Pizzas artesanais.',
    location: { address: 'Rua Exemplo, 1500 - Vila Clementino', lat: -23.6028, lng: -46.6346 },
    listings: [
      {
        title: 'Delivery de pizza',
        description: 'Declarou entregar em 4 km (ainda não verificado pela equipe).',
        category: 'alimentacao',
        mode: 'DELIVERY',
        coverage: [{ type: 'RADIUS', radiusM: 4000, verified: false }],
      },
    ],
  },
  {
    n: 4,
    kind: 'BUSINESS',
    name: 'Restaurante Sabor Caseiro',
    description: 'Comida caseira e marmitas.',
    location: { address: 'Rua Exemplo, 50 - Pinheiros', lat: -23.5893, lng: -46.6836 },
    listings: [
      {
        title: 'Marmitas por encomenda',
        description: 'Entrega só nas redondezas do restaurante.',
        category: 'alimentacao',
        mode: 'DELIVERY',
        coverage: [{ type: 'RADIUS', radiusM: 1500, verified: true }],
      },
    ],
  },
  {
    n: 5,
    kind: 'PROFESSIONAL',
    name: 'João Eletricista',
    description: 'Eletricista com 15 anos de experiência.',
    location: { address: 'Vila Mariana', lat: -23.595, lng: -46.64 },
    listings: [
      {
        title: 'Reparos e instalações elétricas',
        description: 'Tomadas, chuveiros, quadros de luz.',
        category: 'eletricista',
        mode: 'AT_HOME',
        coverage: [{ type: 'POLYGON', box: [-46.648, -23.6, -46.622, -23.578], verified: true }],
      },
    ],
  },
  {
    n: 6,
    kind: 'PROFESSIONAL',
    name: 'Maria Diarista',
    description: 'Indicada pelos moradores do condomínio.',
    listings: [
      {
        title: 'Faxina residencial',
        description: 'Diária de 8 horas, às terças e quintas.',
        category: 'diarista',
        mode: 'AT_HOME',
        coverage: [{ type: 'COMMUNITY', verified: true }],
      },
    ],
  },
  {
    n: 7,
    kind: 'PROFESSIONAL',
    name: 'Pet Passeios',
    description: 'Passeios em grupo pequeno.',
    location: { address: 'Vila Mariana', lat: -23.5857, lng: -46.6346 },
    listings: [
      {
        title: 'Passeio com cães',
        description: 'Passeios de 30 ou 60 minutos.',
        category: 'passeador-de-caes',
        mode: 'AT_HOME',
        coverage: [{ type: 'RADIUS', radiusM: 1000, verified: true }],
      },
    ],
  },
  {
    n: 8,
    kind: 'BUSINESS',
    name: 'TecFácil Informática',
    description: 'Manutenção de computadores e redes.',
    location: { address: 'Paraíso', lat: -23.575, lng: -46.64 },
    listings: [
      {
        title: 'Técnico em domicílio',
        description: 'Formatação, rede Wi-Fi e impressoras.',
        category: 'tecnico-informatica',
        mode: 'AT_HOME',
        coverage: [{ type: 'RADIUS', radiusM: 5000, verified: true }],
      },
      {
        title: 'Suporte remoto',
        description: 'Atendimento por acesso remoto.',
        category: 'tecnico-informatica',
        mode: 'REMOTE',
      },
    ],
  },
  {
    n: 9,
    kind: 'PROFESSIONAL',
    name: 'Cuidar Bem',
    description: 'Cuidadora de idosos. Ainda não informou a área de atendimento.',
    location: { address: 'Vila Clementino', lat: -23.607, lng: -46.6346 },
    listings: [
      {
        title: 'Acompanhamento de idosos',
        description: 'Turnos de 12 horas.',
        category: 'cuidador-de-idosos',
        mode: 'AT_HOME',
      },
    ],
  },
  {
    n: 10,
    kind: 'BUSINESS',
    name: 'Hortifrúti Aguardando Aprovação',
    description: 'Cadastro novo, ainda na fila de moderação: não deve aparecer na busca.',
    status: 'PENDING',
    location: { address: 'Vila Mariana', lat: -23.589, lng: -46.634 },
    listings: [
      {
        title: 'Entrega de frutas',
        description: 'Cesta semanal.',
        category: 'mercado',
        mode: 'DELIVERY',
        coverage: [{ type: 'RADIUS', radiusM: 3000, verified: true }],
      },
    ],
  },
];

function phoneFor(n: number): string {
  const own = process.env.DEMO_PHONE?.replace(/\D/g, '');
  return own || `5500000000${n.toString().padStart(3, '0')}`;
}

export async function seedDemo(databaseUrl: string, log = console.log): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    const providerIds = PROVIDERS.map((p) => id(p.n));
    await client.query('DELETE FROM providers WHERE id = ANY($1::uuid[])', [providerIds]);
    await client.query('DELETE FROM communities WHERE id = $1', [COMMUNITY_ID]);
    await client.query('DELETE FROM addresses WHERE id = $1', [COMMUNITY_ADDRESS_ID]);

    await client.query(
      `INSERT INTO addresses (id, formatted_address, location)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
      [COMMUNITY_ADDRESS_ID, 'Rua Exemplo, 1 - Vila Mariana, São Paulo - SP', DEMO_ORIGIN.lng, DEMO_ORIGIN.lat],
    );
    await client.query(`INSERT INTO communities (id, name, slug, address_id) VALUES ($1, $2, 'demo-jardim-acacias', $3)`, [
      COMMUNITY_ID,
      DEMO_ORIGIN.label,
      COMMUNITY_ADDRESS_ID,
    ]);

    let listingN = 0;
    for (const p of PROVIDERS) {
      const pid = id(p.n);
      const phone = phoneFor(p.n);
      await client.query(
        `INSERT INTO providers (id, kind, display_name, description, phone, whatsapp, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ADMIN')`,
        [pid, p.kind, p.name, p.description, `+${phone}`, phone, p.status ?? 'APPROVED'],
      );
      if (p.location) {
        await client.query(
          `INSERT INTO provider_locations (provider_id, address, location)
           VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
          [pid, p.location.address, p.location.lng, p.location.lat],
        );
      }
      await client.query(
        `INSERT INTO community_provider_links (community_id, provider_id, status) VALUES ($1, $2, 'ACTIVE')`,
        [COMMUNITY_ID, pid],
      );

      for (const l of p.listings) {
        const lid = id(100 + ++listingN);
        await client.query(
          `INSERT INTO listings (id, provider_id, category_id, title, description, mode, status)
           SELECT $1, $2, c.id, $3, $4, $5, $6 FROM categories c WHERE c.slug = $7`,
          [lid, pid, l.title, l.description, l.mode, p.status ?? 'APPROVED', l.category],
        );
        for (const cov of l.coverage ?? []) {
          const verifiedAt = cov.verified ? new Date() : null;
          if (cov.type === 'RADIUS') {
            const [lng, lat] = cov.at ?? [p.location!.lng, p.location!.lat];
            await client.query(
              `INSERT INTO coverage_areas (listing_id, type, radius_m, center, verified_at)
               VALUES ($1, 'RADIUS', $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)`,
              [lid, cov.radiusM, lng, lat, verifiedAt],
            );
          } else if (cov.type === 'POLYGON') {
            await client.query(
              `INSERT INTO coverage_areas (listing_id, type, polygon, verified_at)
               VALUES ($1, 'POLYGON', ST_Multi(ST_MakeEnvelope($2, $3, $4, $5, 4326)), $6)`,
              [lid, ...cov.box, verifiedAt],
            );
          } else {
            await client.query(
              `INSERT INTO coverage_areas (listing_id, type, community_id, verified_at)
               VALUES ($1, 'COMMUNITY', $2, $3)`,
              [lid, COMMUNITY_ID, verifiedAt],
            );
          }
        }
      }
    }
    await client.query('COMMIT');
    log(`✓ Demo: ${PROVIDERS.length} fornecedores, ${listingN} ofertas, 1 condomínio.`);
    log(`  Busque em: /v1/search?lat=${DEMO_ORIGIN.lat}&lng=${DEMO_ORIGIN.lng}`);
    log(`  communityId do condomínio demo: ${COMMUNITY_ID}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

export const DEMO_COMMUNITY_ID = COMMUNITY_ID;

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('Recusado: dados de demonstração não rodam com NODE_ENV=production.');
    process.exit(1);
  }
  seedDemo(url).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
