# Scripts

## Greenfield (BNB testnet)

1. `npm install`
2. Set `DEPLOYER_PRIVATE_KEY` and Greenfield tBNB in repo root `.env` (see root `.env.example`).
3. Create buckets once: `npm run setup-greenfield-buckets`
4. Upload a file: `npm run upload-greenfield -- --file ./image.png --task-id tk_abc123`

With `USE_GREENFIELD_UPLOAD=true`, the FastAPI `POST /api/v1/tasks/{id}/submit` (multipart file) runs `upload-greenfield.ts` and uses the returned public URL + SHA-256 for `submitEvidence`.

## Contracts

After `cd ../contracts && forge build`: `npm run deploy-contracts`
