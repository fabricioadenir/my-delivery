# Sakura & Sal — site e gestão

Site de encomendas e plataforma de gestão do Sakura & Sal (sushi com entrega em Vila Nova de Paiva e Sátão).

- **Frontend:** `public/` — HTML, CSS e JavaScript simples, carregados por ordem em `index.html` (`app1.js` … `app27.js`; cada ficheiro acrescenta ou ajusta funcionalidades dos anteriores).
- **Backend:** `api/index.py` expõe a aplicação FastAPI de `backend/` como função Python na Vercel. Todas as rotas ficam em `/api/...` (ver `vercel.json`).
- **Base de dados:** Supabase. Preços, totais, custos e stock são calculados em funções da base de dados; `supabase/migrations/` guarda as alterações feitas a partir daqui.

## Variáveis de ambiente (Vercel)

| Nome | Para quê |
| --- | --- |
| `SUPABASE_URL` | Endereço do projeto Supabase |
| `SUPABASE_KEY` | Chave pública (anon/publishable) do projeto |
| `PHOTO_BUCKET` | Opcional, bucket das fotos (por omissão `fotos`) |
| `SUPABASE_TIMEOUT` | Opcional, segundos de espera (por omissão `20`) |

## Correr localmente

```bash
pip install -r requirements.txt uvicorn
SUPABASE_URL=... SUPABASE_KEY=... uvicorn backend.main:app --reload
```

O frontend usa caminhos relativos (`/api`), por isso em local é mais simples usar `vercel dev`.
